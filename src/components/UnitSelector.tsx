import React from 'react';
import { Ruler, Maximize } from 'lucide-react';

interface Props {
  scale: number;
  onScaleChange: (scale: number) => void;
  dims: [number, number, number];
}

export const UNIT_OPTIONS = [
  { value: 1, label: 'Milímetros (mm)', desc: '1 un = 1 mm (CAD & STL Padrão)' },
  { value: 10, label: 'Centímetros (cm)', desc: '1 un = 10 mm (Maya / 3ds Max)' },
  { value: 1000, label: 'Metros (m)', desc: '1 un = 1000 mm (Arquitetura / WAD)' },
  { value: 25.4, label: 'Polegadas (in)', desc: '1 un = 25,4 mm (Imperial)' },
  { value: 0.001, label: 'Micrômetros (µm)', desc: '1 un = 0,001 mm (Microescala)' },
];

export const UnitSelector: React.FC<Props> = ({ scale, onScaleChange, dims }) => {
  const [dx, dy, dz] = dims;
  const scaledX = (dx * scale).toFixed(2);
  const scaledY = (dy * scale).toFixed(2);
  const scaledZ = (dz * scale).toFixed(2);

  // Volume approximation of bounding box in cm³
  const volumeCm3 = ((dx * scale * dy * scale * dz * scale) / 1000).toFixed(1);

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="unit-select" className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
          Unidade de Medida Original
        </label>
        <span className="text-[10px] sm:text-[11px] text-cyan-400 font-medium">Saída padronizada em mm</span>
      </div>

      <div className="relative">
        <select
          id="unit-select"
          value={scale}
          onChange={(e) => onScaleChange(+e.target.value)}
          className="w-full appearance-none rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 text-xs font-medium text-slate-100 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 transition cursor-pointer min-h-[44px]"
        >
          {UNIT_OPTIONS.map((u) => (
            <option key={u.value} value={u.value} className="bg-slate-900 text-slate-100">
              {u.label} — {u.desc}
            </option>
          ))}
        </select>
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <Ruler className="h-4 w-4" />
        </div>
      </div>

      {dims.some((d) => d > 0) && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 space-y-1.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <Maximize className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
              <span>Dimensões Finais (X × Y × Z):</span>
            </span>
            <span className="font-mono text-cyan-300 font-semibold text-xs sm:text-right">
              {scaledX} × {scaledY} × {scaledZ} mm
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-slate-500 pt-0.5 border-t border-slate-800/40">
            <span>Caixa envolvente:</span>
            <span>Aprox. {volumeCm3} cm³</span>
          </div>
        </div>
      )}
    </div>
  );
};
