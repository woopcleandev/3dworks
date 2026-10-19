import { MeshBody } from './types';

export interface SampleModelDef {
  id: string;
  name: string;
  description: string;
  ext: string;
  generate: () => { buffer: ArrayBuffer; bodies: MeshBody[] };
}

// Helper to convert MeshBody array to OBJ buffer
function bodiesToObjBuffer(bodies: MeshBody[]): ArrayBuffer {
  let text = '# Sample 3D Model\n';
  let vOffset = 0;
  for (const b of bodies) {
    text += `o ${b.name}\n`;
    for (let i = 0; i < b.pos.length; i += 3) {
      text += `v ${b.pos[i].toFixed(4)} ${b.pos[i + 1].toFixed(4)} ${b.pos[i + 2].toFixed(4)}\n`;
    }
    for (let i = 0; i < b.idx.length; i += 3) {
      text += `f ${b.idx[i] + 1 + vOffset} ${b.idx[i + 1] + 1 + vOffset} ${b.idx[i + 2] + 1 + vOffset}\n`;
    }
    vOffset += b.pos.length / 3;
  }
  return new TextEncoder().encode(text).buffer as ArrayBuffer;
}

// 1. Mechanical Gear (Engrenagem com dentes e eixo)
export function createGearMesh(): { buffer: ArrayBuffer; bodies: MeshBody[] } {
  const teeth = 16;
  const rRoot = 30;
  const rTip = 42;
  const rHole = 12;
  const height = 15;
  const segments = teeth * 4;

  const ptsTopOuter: [number, number][] = [];
  const ptsTopInner: [number, number][] = [];

  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const toothStep = i % 4;
    const r = (toothStep === 1 || toothStep === 2) ? rTip : rRoot;
    ptsTopOuter.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    ptsTopInner.push([Math.cos(angle) * rHole, Math.sin(angle) * rHole]);
  }

  const pos: number[] = [];
  const idx: number[] = [];

  // Top vertices: 0..segments-1 (outer), segments..2*segments-1 (inner)
  for (let i = 0; i < segments; i++) {
    pos.push(ptsTopOuter[i][0], ptsTopOuter[i][1], height / 2);
  }
  for (let i = 0; i < segments; i++) {
    pos.push(ptsTopInner[i][0], ptsTopInner[i][1], height / 2);
  }
  // Bottom vertices: 2*segments..3*segments-1 (outer), 3*segments..4*segments-1 (inner)
  for (let i = 0; i < segments; i++) {
    pos.push(ptsTopOuter[i][0], ptsTopOuter[i][1], -height / 2);
  }
  for (let i = 0; i < segments; i++) {
    pos.push(ptsTopInner[i][0], ptsTopInner[i][1], -height / 2);
  }

  const s = segments;
  // Top face ring
  for (let i = 0; i < s; i++) {
    const next = (i + 1) % s;
    const o1 = i;
    const o2 = next;
    const i1 = s + i;
    const i2 = s + next;
    idx.push(o1, o2, i2);
    idx.push(o1, i2, i1);
  }

  // Bottom face ring
  for (let i = 0; i < s; i++) {
    const next = (i + 1) % s;
    const o1 = 2 * s + i;
    const o2 = 2 * s + next;
    const i1 = 3 * s + i;
    const i2 = 3 * s + next;
    idx.push(o2, o1, i1);
    idx.push(o2, i1, i2);
  }

  // Outer wall (teeth)
  for (let i = 0; i < s; i++) {
    const next = (i + 1) % s;
    const t1 = i;
    const t2 = next;
    const b1 = 2 * s + i;
    const b2 = 2 * s + next;
    idx.push(t1, b1, b2);
    idx.push(t1, b2, t2);
  }

  // Inner wall (hole)
  for (let i = 0; i < s; i++) {
    const next = (i + 1) % s;
    const t1 = s + i;
    const t2 = s + next;
    const b1 = 3 * s + i;
    const b2 = 3 * s + next;
    idx.push(t2, b2, b1);
    idx.push(t2, b1, t1);
  }

  const bodies: MeshBody[] = [{
    name: 'engrenagem_dentes',
    pos: Float32Array.from(pos),
    idx: Uint32Array.from(idx),
  }];

  return { buffer: bodiesToObjBuffer(bodies), bodies };
}

// 2. Torus CAD (Anel Técnico)
export function createTorusMesh(): { buffer: ArrayBuffer; bodies: MeshBody[] } {
  const R = 35; // Major radius
  const r = 12; // Minor radius
  const segR = 24;
  const segr = 14;

  const pos: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i < segR; i++) {
    const u = (i / segR) * Math.PI * 2;
    const cu = Math.cos(u);
    const su = Math.sin(u);

    for (let j = 0; j < segr; j++) {
      const v = (j / segr) * Math.PI * 2;
      const cv = Math.cos(v);
      const sv = Math.sin(v);

      const x = (R + r * cv) * cu;
      const y = (R + r * cv) * su;
      const z = r * sv;
      pos.push(x, y, z);
    }
  }

  for (let i = 0; i < segR; i++) {
    const nextI = (i + 1) % segR;
    for (let j = 0; j < segr; j++) {
      const nextJ = (j + 1) % segr;

      const p1 = i * segr + j;
      const p2 = nextI * segr + j;
      const p3 = nextI * segr + nextJ;
      const p4 = i * segr + nextJ;

      idx.push(p1, p2, p3);
      idx.push(p1, p3, p4);
    }
  }

  const bodies: MeshBody[] = [{
    name: 'torus_cad',
    pos: Float32Array.from(pos),
    idx: Uint32Array.from(idx),
  }];

  return { buffer: bodiesToObjBuffer(bodies), bodies };
}

// 3. Tech Chamfered Cube (Cubo Chanfrado Técnico)
export function createTechCubeMesh(): { buffer: ArrayBuffer; bodies: MeshBody[] } {
  const s = 25; // half size
  const c = 6;  // chamfer

  // 24 vertices for chamfered corners/edges
  const V: [number, number, number][] = [
    // Top face chamfered octagonal vertices (z = +s)
    [-s + c, -s, s], [s - c, -s, s], [s, -s + c, s], [s, s - c, s],
    [s - c, s, s], [-s + c, s, s], [-s, s - c, s], [-s, -s + c, s],
    // Bottom face chamfered octagonal vertices (z = -s)
    [-s + c, -s, -s], [s - c, -s, -s], [s, -s + c, -s], [s, s - c, -s],
    [s - c, s, -s], [-s + c, s, -s], [-s, s - c, -s], [-s, -s + c, -s],
  ];

  const pos: number[] = [];
  for (const v of V) pos.push(...v);

  const idx: number[] = [];
  // Top face fan (0..7)
  for (let i = 1; i < 7; i++) {
    idx.push(0, i, i + 1);
  }
  // Bottom face fan (8..15)
  for (let i = 1; i < 7; i++) {
    idx.push(8, 8 + i + 1, 8 + i);
  }
  // Side faces
  for (let i = 0; i < 8; i++) {
    const next = (i + 1) % 8;
    const t1 = i;
    const t2 = next;
    const b1 = 8 + i;
    const b2 = 8 + next;
    idx.push(t1, b1, b2);
    idx.push(t1, b2, t2);
  }

  const bodies: MeshBody[] = [{
    name: 'cubo_chanfrado',
    pos: Float32Array.from(pos),
    idx: Uint32Array.from(idx),
  }];

  return { buffer: bodiesToObjBuffer(bodies), bodies };
}

export const SAMPLE_MODELS: SampleModelDef[] = [
  {
    id: 'gear',
    name: 'Engrenagem Mecânica',
    description: '16 dentes, furo central de precisão e chanfros CAD.',
    ext: 'obj',
    generate: createGearMesh,
  },
  {
    id: 'torus',
    name: 'Torus / Anel CAD',
    description: 'Geometria de revolução suave com 672 triângulos.',
    ext: 'obj',
    generate: createTorusMesh,
  },
  {
    id: 'cube',
    name: 'Cubo Chanfrado',
    description: 'Bloco usinado com bordas chanfradas industriais.',
    ext: 'obj',
    generate: createTechCubeMesh,
  },
];
