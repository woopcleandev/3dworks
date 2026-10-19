import { MeshBody, SupportedFormat } from './types';
import { parseMesh } from './meshParsers';

const f5g = (x: number) => (+x.toFixed(5)).toString();

export function weldBody(b: MeshBody, scale: number): { P: [number, number, number][]; tri: number[] } {
  const map = new Map<string, number>();
  const P: [number, number, number][] = [];
  const rem = new Int32Array(b.pos.length / 3).fill(-1);

  const wv = (i: number): number => {
    const existing = rem[i];
    if (existing >= 0) return existing;
    const x = b.pos[i * 3];
    const y = b.pos[i * 3 + 1];
    const z = b.pos[i * 3 + 2];
    const k = `${Math.round(x * 1e6)},${Math.round(y * 1e6)},${Math.round(z * 1e6)}`;
    let j = map.get(k);
    if (j === undefined) {
      j = P.length;
      map.set(k, j);
      P.push([x * scale, y * scale, z * scale]);
    }
    rem[i] = j;
    return j;
  };

  const tri: number[] = [];
  for (let t = 0; t + 2 < b.idx.length; t += 3) {
    tri.push(wv(b.idx[t]), wv(b.idx[t + 1]), wv(b.idx[t + 2]));
  }
  return { P, tri };
}

export async function toStep(
  buf: ArrayBuffer,
  scale: number,
  fname: string,
  progress: (p: number, msg: string) => void,
  ext: string
): Promise<{ blob: Blob; faces: number; bodies: number; ext: string }> {
  const bodies = parseMesh(buf, ext || 'wad');
  const parts: string[] = [];
  let id = 0;
  const out: string[] = [];

  const E = (s: string) => {
    out.push(`#${++id}=${s};\n`);
    return id;
  };

  const f5 = (x: number) => (+x.toFixed(5)).toString();
  const f9 = (x: number) => (+x.toPrecision(9)).toString();
  const D = (v: [number, number, number]) => E(`DIRECTION('',(${f9(v[0])},${f9(v[1])},${f9(v[2])}))`);

  const head = `ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Convertido via Conversor 3D Pro - ISO 10303-214'),'2;1');\nFILE_NAME('${fname}.step','${new Date().toISOString().slice(0, 19)}',('Conversor 3D Pro'),(''),'Conversor 3D Pro','','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 3 1 1 }'));\nENDSEC;\nDATA;\n`;

  const app = E("APPLICATION_CONTEXT('automotive design')");
  E(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${app})`);
  const pc = E(`PRODUCT_CONTEXT('',#${app},'mechanical')`);
  const pdc = E(`PRODUCT_DEFINITION_CONTEXT('part definition',#${app},'design')`);
  const prod = E(`PRODUCT('${fname}','${fname}','',(#${pc}))`);
  const pdf = E(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`);
  const pdef = E(`PRODUCT_DEFINITION('design','',#${pdf},#${pdc})`);
  const pds = E(`PRODUCT_DEFINITION_SHAPE('','',#${pdef})`);

  const lu = E('( LENGTH_UNIT() NAMED_UNIT(*) SI_UNIT(.MILLI.,.METRE.) )');
  const au = E('( NAMED_UNIT(*) PLANE_ANGLE_UNIT() SI_UNIT($,.RADIAN.) )');
  const su = E('( NAMED_UNIT(*) SI_UNIT($,.STERADIAN.) SOLID_ANGLE_UNIT() )');
  const unc = E(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-03),#${lu},'distance_accuracy_value','')`);
  const ctx = E(
    `( GEOMETRIC_REPRESENTATION_CONTEXT(3) GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${unc})) GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lu},#${au},#${su})) REPRESENTATION_CONTEXT('','') )`
  );

  parts.push(out.join(''));
  out.length = 0;

  const sbsms: string[] = [];
  let totF = 0;

  for (let bi = 0; bi < bodies.length; bi++) {
    const b = bodies[bi];
    progress(bi / bodies.length, `Processando corpo ${bi + 1}/${bodies.length}: ${b.name}`);
    await new Promise((r) => setTimeout(r, 0));

    const { P, tri } = weldBody(b, scale);
    const nw = P.length;
    const pt = new Array(nw);
    const vp = new Array(nw);

    for (let i = 0; i < nw; i++) {
      pt[i] = E(`CARTESIAN_POINT('',(${f5(P[i][0])},${f5(P[i][1])},${f5(P[i][2])}))`);
      vp[i] = E(`VERTEX_POINT('',#${pt[i]})`);
    }

    const edges = new Map<number, number>();
    const faces: string[] = [];

    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t];
      const bb = tri[t + 1];
      const c = tri[t + 2];
      if (a === bb || bb === c || a === c) continue;

      const A = P[a];
      const B = P[bb];
      const C = P[c];
      const u: [number, number, number] = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const v: [number, number, number] = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      const n: [number, number, number] = [
        u[1] * v[2] - u[2] * v[1],
        u[2] * v[0] - u[0] * v[2],
        u[0] * v[1] - u[1] * v[0],
      ];
      const nl = Math.hypot(...n);
      const ul = Math.hypot(...u);
      if (nl < 1e-9 || ul < 1e-9) continue;

      const ax = E(
        `AXIS2_PLACEMENT_3D('',#${pt[a]},#${D([n[0] / nl, n[1] / nl, n[2] / nl])},#${D([u[0] / ul, u[1] / ul, u[2] / ul])})`
      );
      const pl = E(`PLANE('',#${ax})`);

      const pairs: [number, number][] = [
        [a, bb],
        [bb, c],
        [c, a],
      ];

      const oe = pairs.map(([p, q]) => {
        const lo = p < q ? p : q;
        const hi = p < q ? q : p;
        const k = lo * nw + hi;
        let e = edges.get(k);
        if (e === undefined) {
          const d: [number, number, number] = [
            P[hi][0] - P[lo][0],
            P[hi][1] - P[lo][1],
            P[hi][2] - P[lo][2],
          ];
          const L = Math.hypot(...d);
          const dir: [number, number, number] = L > 1e-9 ? [d[0] / L, d[1] / L, d[2] / L] : [0, 0, 1];
          const vec = E(`VECTOR('',#${D(dir)},${f5(L)})`);
          const ln = E(`LINE('',#${pt[lo]},#${vec})`);
          e = E(`EDGE_CURVE('',#${vp[lo]},#${vp[hi]},#${ln},.T.)`);
          edges.set(k, e);
        }
        return `#${E(`ORIENTED_EDGE('',*,*,#${e},${p < q ? '.T.' : '.F.'})`)}`;
      });

      const lp = E(`EDGE_LOOP('',(${oe.join(',')}))`);
      const fb = E(`FACE_OUTER_BOUND('',#${lp},.T.)`);
      faces.push(`#${E(`ADVANCED_FACE('',(#${fb}),#${pl},.T.)`)}`);
    }

    totF += faces.length;
    const sh = E(`OPEN_SHELL('${b.name}',(${faces.join(',')}))`);
    sbsms.push(`#${E(`SHELL_BASED_SURFACE_MODEL('${b.name}',(#${sh}))`)}`);
    parts.push(out.join(''));
    out.length = 0;
  }

  const rep = E(`SHAPE_REPRESENTATION('${fname}',(${sbsms.join(',')}),#${ctx})`);
  E(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`);
  parts.push(out.join(''));

  progress(1, 'Geração STEP concluída com sucesso!');
  return {
    blob: new Blob([head, ...parts, 'ENDSEC;\nEND-ISO-10303-21;\n'], { type: 'model/step' }),
    faces: totF,
    bodies: bodies.length,
    ext: 'step',
  };
}

export async function exportMesh(
  buf: ArrayBuffer,
  ext: string,
  fmt: SupportedFormat,
  scale: number,
  fname: string,
  progress: (p: number, msg: string) => void
): Promise<{ blob: Blob; faces: number; bodies: number; ext: string }> {
  if (fmt === 'step') {
    return toStep(buf, scale, fname, progress, ext);
  }

  const src = parseMesh(buf, ext);
  interface WeldedMesh {
    name: string;
    P: [number, number, number][];
    tri: number[];
  }
  const W: WeldedMesh[] = [];

  for (let i = 0; i < src.length; i++) {
    progress((i / src.length) * 0.8, `Otimizando malha ${i + 1}/${src.length}: ${src[i].name}`);
    await new Promise((r) => setTimeout(r, 0));

    const w = weldBody(src[i], scale);
    const t: number[] = [];
    for (let k = 0; k + 2 < w.tri.length; k += 3) {
      const a = w.tri[k];
      const b = w.tri[k + 1];
      const c = w.tri[k + 2];
      if (a !== b && b !== c && a !== c) {
        t.push(a, b, c);
      }
    }
    W.push({ name: src[i].name, P: w.P, tri: t });
  }

  progress(0.9, 'Codificando arquivo de saída...');
  await new Promise((r) => setTimeout(r, 0));

  const nv = W.reduce((s, b) => s + b.P.length, 0);
  const nt = W.reduce((s, b) => s + b.tri.length / 3, 0);
  let blob: Blob;

  if (fmt === 'obj') {
    const parts = [`# Convertido com Conversor 3D Pro\n# Vértices: ${nv}, Faces: ${nt}\n`];
    let off = 0;
    for (const b of W) {
      const v = b.P.map((p) => `v ${f5g(p[0])} ${f5g(p[1])} ${f5g(p[2])}`);
      const f: string[] = [];
      for (let i = 0; i < b.tri.length; i += 3) {
        f.push(`f ${b.tri[i] + 1 + off} ${b.tri[i + 1] + 1 + off} ${b.tri[i + 2] + 1 + off}`);
      }
      parts.push(`o ${b.name}\n${v.join('\n')}\n${f.join('\n')}\n`);
      off += b.P.length;
    }
    blob = new Blob(parts, { type: 'text/plain' });
  } else if (fmt === 'off') {
    const parts = [`OFF\n${nv} ${nt} 0\n`];
    let off = 0;
    for (const b of W) {
      parts.push(b.P.map((p) => `${f5g(p[0])} ${f5g(p[1])} ${f5g(p[2])}`).join('\n') + '\n');
    }
    for (const b of W) {
      const f: string[] = [];
      for (let i = 0; i < b.tri.length; i += 3) {
        f.push(`3 ${b.tri[i] + off} ${b.tri[i + 1] + off} ${b.tri[i + 2] + off}`);
      }
      parts.push(f.join('\n') + '\n');
      off += b.P.length;
    }
    blob = new Blob(parts, { type: 'text/plain' });
  } else if (fmt === 'stl') {
    // Binary STL (standard for 3D printing slicers: Cura, PrusaSlicer, Bambu Studio)
    const ab = new ArrayBuffer(84 + 50 * nt);
    const dv = new DataView(ab);
    let o = 84;
    new Uint8Array(ab).set(new TextEncoder().encode('Conversor 3D Pro - Export'));
    dv.setUint32(80, nt, true);

    for (const b of W) {
      for (let i = 0; i < b.tri.length; i += 3) {
        const A = b.P[b.tri[i]];
        const B = b.P[b.tri[i + 1]];
        const C = b.P[b.tri[i + 2]];
        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
        const v = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
        const n = [
          u[1] * v[2] - u[2] * v[1],
          u[2] * v[0] - u[0] * v[2],
          u[0] * v[1] - u[1] * v[0],
        ];
        const l = Math.hypot(...n) || 1;
        const normalAndVerts = [
          n[0] / l, n[1] / l, n[2] / l,
          ...A, ...B, ...C
        ];
        for (let k = 0; k < 12; k++) {
          dv.setFloat32(o + k * 4, normalAndVerts[k], true);
        }
        dv.setUint16(o + 48, 0, true); // attribute byte count
        o += 50;
      }
    }
    blob = new Blob([ab], { type: 'model/stl' });
  } else if (fmt === 'ply') {
    const hd = `ply\nformat binary_little_endian 1.0\ncomment Gerado por Conversor 3D Pro\nelement vertex ${nv}\nproperty float x\nproperty float y\nproperty float z\nelement face ${nt}\nproperty list uchar int vertex_indices\nend_header\n`;
    const vb = new DataView(new ArrayBuffer(nv * 12));
    const fb = new DataView(new ArrayBuffer(nt * 13));
    let vi = 0;
    let fi = 0;
    let off = 0;

    for (const b of W) {
      for (const p of b.P) {
        vb.setFloat32(vi, p[0], true);
        vb.setFloat32(vi + 4, p[1], true);
        vb.setFloat32(vi + 8, p[2], true);
        vi += 12;
      }
      for (let i = 0; i < b.tri.length; i += 3) {
        fb.setUint8(fi, 3);
        for (let k = 0; k < 3; k++) {
          fb.setInt32(fi + 1 + k * 4, b.tri[i + k] + off, true);
        }
        fi += 13;
      }
      off += b.P.length;
    }
    blob = new Blob([hd, vb.buffer, fb.buffer], { type: 'application/octet-stream' });
  } else {
    throw new Error('Formato de exportação desconhecido.');
  }

  progress(1, 'Exportação finalizada com sucesso!');
  return { blob, faces: nt, bodies: W.length, ext: fmt };
}
