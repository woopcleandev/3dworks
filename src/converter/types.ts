export interface MeshBody {
  name: string;
  pos: Float32Array;
  idx: Uint32Array;
}

export interface ModelInfo {
  name: string;
  ext: string;
  bodies: number;
  tris: number;
  vertices: number;
  dims: [number, number, number]; // [width, depth, height]
  size: number;
  groups: Float32Array[];
  floor: number;
}

export type SupportedFormat = 'step' | 'stl' | 'obj' | 'ply' | 'off';

export interface FormatMeta {
  id: SupportedFormat;
  label: string;
  fullName: string;
  description: string;
  compatibility: string;
  badge: string;
  approxMultiplier: number;
}

export interface ConversionResult {
  blob: Blob;
  url: string;
  faces: number;
  bodies: number;
  ext: string;
  size: number;
  filename: string;
}
