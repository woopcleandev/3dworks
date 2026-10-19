import { MeshBody } from './types';

const safe = (n?: string) => (n || '').replace(/[^\w.\-]/g, '_').slice(0, 60) || 'corpo';
const txt = (buf: ArrayBuffer) => new TextDecoder().decode(buf);

export function parseWad(buf: ArrayBuffer): MeshBody[] {
  const dv = new DataView(buf);
  const n = buf.byteLength;
  const name = (o: number) => {
    let s = '';
    while (o + 1 < n) {
      const c = dv.getUint16(o, true);
      if (!c || s.length > 80) break;
      s += String.fromCharCode(c);
      o += 2;
    }
    return s;
  };

  if (!name(0).startsWith('ecdmodel')) {
    throw new Error('Cabeçalho "ecdmodel" não encontrado: este arquivo .wad não possui o formato de malha 3D suportado.');
  }

  const bodies: MeshBody[] = [];
  let M = 0xc68;
  while (M + 0x404 < n) {
    const nv = dv.getUint32(M + 0x400, true);
    const vs = M + 0x404;
    const io = vs + nv * 56;
    if (io + 4 > n) break;

    const ni = dv.getUint32(io, true);
    const E = io + 4 + ni * 4;
    if (E > n || ni % 3 !== 0) break;

    const pos = new Float32Array(nv * 3);
    for (let i = 0; i < nv; i++) {
      const o = vs + i * 56;
      pos[i * 3] = dv.getFloat32(o, true);
      pos[i * 3 + 1] = dv.getFloat32(o + 4, true);
      pos[i * 3 + 2] = dv.getFloat32(o + 8, true);
    }

    const idx = new Uint32Array(ni);
    for (let i = 0; i < ni; i++) {
      idx[i] = dv.getUint32(io + 4 + i * 4, true);
    }

    const bodyName = name(E) || `corpo_${bodies.length + 1}`;
    bodies.push({ name: bodyName, pos, idx });
    M = E + 0x1050;
  }

  if (!bodies.length) {
    throw new Error('Nenhuma malha geométrica foi encontrada no arquivo WAD.');
  }
  return bodies;
}

export function parseObj(buf: ArrayBuffer): MeshBody[] {
  const V: [number, number, number][] = [];
  interface RawMesh {
    name: string;
    pos: number[];
    idx: number[];
    map: Map<number, number>;
  }
  const meshes: RawMesh[] = [];
  let cur: RawMesh | null = null;

  const start = (n: string) => {
    cur = {
      name: safe(n) + (meshes.length ? `_${meshes.length}` : ''),
      pos: [],
      idx: [],
      map: new Map<number, number>(),
    };
    meshes.push(cur);
  };

  const text = txt(buf);
  const lines = text.split(/\r?\n/);

  for (let lIdx = 0; lIdx < lines.length; lIdx++) {
    const ln = lines[lIdx];
    const t = ln.trim().split(/\s+/);
    if (t[0] === 'v') {
      V.push([+t[1], +t[2], +t[3]]);
    } else if (t[0] === 'o' || t[0] === 'g') {
      const lastMesh = meshes[meshes.length - 1];
      if (lastMesh && !lastMesh.idx.length) meshes.pop();
      start(t.slice(1).join('_'));
    } else if (t[0] === 'f') {
      if (!meshes.length) start('obj');
      const curRef = meshes[meshes.length - 1];
      const id = t.slice(1).map((x) => {
        let k = parseInt(x.split('/')[0], 10);
        k = k < 0 ? V.length + k : k - 1;
        let j = curRef.map.get(k);
        if (j === undefined) {
          j = curRef.pos.length / 3;
          curRef.map.set(k, j);
          if (V[k]) {
            curRef.pos.push(...V[k]);
          } else {
            curRef.pos.push(0, 0, 0);
          }
        }
        return j;
      });

      for (let i = 1; i + 1 < id.length; i++) {
        curRef.idx.push(id[0], id[i], id[i + 1]);
      }
    }
  }

  return meshes
    .filter((m) => m.idx.length > 0)
    .map((m) => ({
      name: m.name,
      pos: Float32Array.from(m.pos),
      idx: Uint32Array.from(m.idx),
    }));
}

export function parseStl(buf: ArrayBuffer): MeshBody[] {
  const dv = new DataView(buf);
  let pos: Float32Array;

  // Check if binary STL
  if (buf.byteLength >= 84 && 84 + dv.getUint32(80, true) * 50 === buf.byteLength) {
    const n = dv.getUint32(80, true);
    pos = new Float32Array(n * 9);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 9; k++) {
        pos[i * 9 + k] = dv.getFloat32(84 + i * 50 + 12 + k * 4, true);
      }
    }
  } else {
    // ASCII STL
    const a: number[] = [];
    const re = /vertex\s+(\S+)\s+(\S+)\s+(\S+)/g;
    const t = txt(buf);
    let m: RegExpExecArray | null;
    while ((m = re.exec(t)) !== null) {
      a.push(+m[1], +m[2], +m[3]);
    }
    pos = Float32Array.from(a);
  }

  const numTris = Math.floor(pos.length / 9);
  const idx = new Uint32Array(numTris * 3);
  for (let i = 0; i < idx.length; i++) {
    idx[i] = i;
  }

  return [{ name: 'stl_model', pos, idx }];
}

export function parseOff(buf: ArrayBuffer): MeshBody[] {
  const t = txt(buf).replace(/#.*$/gm, '').trim().split(/\s+/);
  if (!/^OFF/.test(t[0])) {
    throw new Error('Formato OFF inválido: cabeçalho "OFF" ausente.');
  }

  let p = 1;
  const nv = +t[p++];
  const nf = +t[p++];
  p++; // skip edge count

  const pos = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) {
    pos[i] = +t[p++];
  }

  const idx: number[] = [];
  for (let i = 0; i < nf; i++) {
    const n = +t[p++];
    const f = t.slice(p, p + n).map(Number);
    p += n;
    for (let k = 1; k + 1 < n; k++) {
      idx.push(f[0], f[k], f[k + 1]);
    }
  }

  return [{ name: 'off_model', pos, idx: Uint32Array.from(idx) }];
}

export function parsePly(buf: ArrayBuffer): MeshBody[] {
  const u8 = new Uint8Array(buf);
  const h = txt(buf.slice(0, Math.min(buf.byteLength, 20000)));
  const e = h.indexOf('end_header');
  if (!h.startsWith('ply') || e < 0) {
    throw new Error('Cabeçalho PLY inválido: "ply" ou "end_header" não encontrados.');
  }

  let off = e + 'end_header'.length;
  while (u8[off] !== 10 && off < u8.length) off++;
  off++;

  const lines = h.slice(0, e).split(/\r?\n/).map((l) => l.trim().split(/\s+/));
  interface PlyProp {
    list?: number;
    ct?: string;
    t: string;
    n: string;
  }
  interface PlyElement {
    n: string;
    c: number;
    p: PlyProp[];
  }
  const els: PlyElement[] = [];
  let fmt = 'ascii';

  for (const l of lines) {
    if (l[0] === 'format') {
      fmt = l[1];
    } else if (l[0] === 'element') {
      els.push({ n: l[1], c: +l[2], p: [] });
    } else if (l[0] === 'property' && els.length) {
      els[els.length - 1].p.push(
        l[1] === 'list'
          ? { list: 1, ct: l[2], t: l[3], n: l[4] }
          : { t: l[1], n: l[2] }
      );
    }
  }

  const sz: Record<string, number> = {
    char: 1, int8: 1, uchar: 1, uint8: 1,
    short: 2, int16: 2, ushort: 2, uint16: 2,
    int: 4, int32: 4, uint: 4, uint32: 4,
    float: 4, float32: 4, double: 8, float64: 8,
  };

  const dv = new DataView(buf);
  const le = fmt !== 'binary_big_endian';
  const asc = fmt === 'ascii';

  const rd = (tName: string, offset: number): number => {
    switch (tName) {
      case 'char':
      case 'int8':
        return dv.getInt8(offset);
      case 'uchar':
      case 'uint8':
        return dv.getUint8(offset);
      case 'short':
      case 'int16':
        return dv.getInt16(offset, le);
      case 'ushort':
      case 'uint16':
        return dv.getUint16(offset, le);
      case 'int':
      case 'int32':
        return dv.getInt32(offset, le);
      case 'uint':
      case 'uint32':
        return dv.getUint32(offset, le);
      case 'float':
      case 'float32':
        return dv.getFloat32(offset, le);
      default:
        return dv.getFloat64(offset, le);
    }
  };

  let tk: string[] = [];
  let ti = 0;
  if (asc) {
    tk = txt(buf.slice(off)).trim().split(/\s+/);
  }

  const nxt = (tName: string): number => {
    if (asc) return +tk[ti++];
    const v = rd(tName, off);
    off += sz[tName] || 4;
    return v;
  };

  let pos = new Float32Array(0);
  const idx: number[] = [];

  for (const el of els) {
    if (el.n === 'vertex') {
      pos = new Float32Array(el.c * 3);
      for (let i = 0; i < el.c; i++) {
        for (const p of el.p) {
          if (p.list) {
            const c = nxt(p.ct!);
            for (let k = 0; k < c; k++) nxt(p.t);
            continue;
          }
          const v = nxt(p.t);
          const k = p.n === 'x' ? 0 : p.n === 'y' ? 1 : p.n === 'z' ? 2 : undefined;
          if (k !== undefined) pos[i * 3 + k] = v;
        }
      }
    } else {
      for (let i = 0; i < el.c; i++) {
        for (const p of el.p) {
          if (p.list) {
            const c = nxt(p.ct!);
            const f: number[] = [];
            for (let k = 0; k < c; k++) f.push(nxt(p.t));
            if (el.n === 'face' && (p.n === 'vertex_indices' || p.n === 'vertex_index')) {
              for (let k = 1; k + 1 < c; k++) {
                idx.push(f[0], f[k], f[k + 1]);
              }
            }
          } else {
            nxt(p.t);
          }
        }
      }
    }
  }

  return [{ name: 'ply_model', pos, idx: Uint32Array.from(idx) }];
}

export function parseMesh(buf: ArrayBuffer, ext: string): MeshBody[] {
  const cleanExt = (ext || '').toLowerCase().replace(/^\./, '');
  const parserMap: Record<string, (b: ArrayBuffer) => MeshBody[]> = {
    wad: parseWad,
    obj: parseObj,
    stl: parseStl,
    ply: parsePly,
    off: parseOff,
  };

  const fn = parserMap[cleanExt];
  if (!fn) {
    throw new Error(`Formato ".${cleanExt}" não suportado. Por favor, utilize arquivos WAD, OBJ, STL, PLY ou OFF.`);
  }

  const meshes = fn(buf).filter((x) => x.idx.length >= 3);
  if (!meshes.length) {
    throw new Error('Nenhuma malha triangular válida foi encontrada no arquivo.');
  }
  return meshes;
}
