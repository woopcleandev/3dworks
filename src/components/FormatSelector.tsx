import React from 'react';
import { SupportedFormat, FormatMeta } from '../converter/types';
import { Cpu, Printer, Palette, Scan, Binary, Check } from 'lucide-react';

export const FORMAT_OPTIONS: FormatMeta[] = [
  {
    id: 'step',
    label: 'STEP',
    fullName: 'ISO-10303-21 CAD',
    description: 'Padrão profissional para CAD mecânico.',
    compatibility: 'SolidWorks, Fusion 360, Inventor, FreeCAD',
    badge: 'CAD / Engenharia',
    approxMultiplier: 870,
  },
  {
    id: 'stl',
    label: 'STL',
    fullName: 'Binário 3D Print',
    description: 'Otimizado para fatiadores e impressão 3D.',
    compatibility: 'Bambu Studio, Cura, PrusaSlicer',
    badge: 'Impressão 3D',
    approxMultiplier: 50,
  },
  {
    id: 'obj',
    label: 'OBJ',
    fullName: 'Wavefront Mesh',
    description: 'Padrão para renderização e animação.',
    compatibility: 'Blender, 3ds Max, Maya, Unreal',
    badge: 'Modelagem / Render',
    approxMultiplier: 45,
  },
  {
    id: 'ply',
    label: 'PLY',
    fullName: 'Polygon File',
    description: 'Compacto para escaneamento 3D.',
    compatibility: 'MeshLab, CloudCompare, Blender',
    badge: 'Nuvem de Pontos',
    approxMultiplier: 20,
  },
  {
    id: 'off',
    label: 'OFF',
    fullName: 'Object File',
    description: 'Texto puro para geometria computacional.',
    compatibility: 'Pesquisa, CGAL, Geometria',
    badge: 'Acadêmico',
    approxMultiplier: 40,
  },
];

interface Props {
  selectedFormat: SupportedFormat;
  onSelectFormat: (format: SupportedFormat) => void;
  triangleCount: number;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes >= 1048576) {
    return `${(bytes / 1048576).toFixed(bytes > 1e7 ? 0 : 1).replace('.', ',')} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export const FormatSelector: React.FC<Props> = ({
  selectedFormat,
  onSelectFormat,
  triangleCount,
}) => {
  const getFormatIcon = (id: SupportedFormat) => {
    switch (id) {
      case 'step':
        return <Cpu className="h-4 w-4" />;
      case 'stl':
        return <Printer className="h-4 w-4" />;
      case 'obj':
        return <Palette className="h-4 w-4" />;
      case 'ply':
        return <Scan className="h-4 w-4" />;
      case 'off':
        return <Binary className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">
          Formato de Destino
        </label>
        {triangleCount > 0 && (
          <span className="text-[10px] sm:text-[11px] text-slate-400">
            Tamanho aprox:{' '}
            <strong className="text-cyan-400 font-mono font-medium">
              {formatBytes(
                triangleCount *
                  (FORMAT_OPTIONS.find((f) => f.id === selectedFormat)?.approxMultiplier || 50)
              )}
            </strong>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-2.5">
        {FORMAT_OPTIONS.map((fmt) => {
          const isSelected = selectedFormat === fmt.id;
          return (
            <button
              key={fmt.id}
              type="button"
              onClick={() => onSelectFormat(fmt.id)}
              className={`group relative flex flex-col text-left p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer min-h-[58px] active:scale-[0.99] ${
                isSelected
                  ? 'border-cyan-500 bg-cyan-950/35 shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900/90'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg border transition ${
                      isSelected
                        ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-300'
                        : 'border-slate-700 bg-slate-800/80 text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {getFormatIcon(fmt.id)}
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-100 font-mono">
                      .{fmt.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-sans hidden sm:inline">
                      {fmt.fullName}
                    </span>
                  </div>
                </div>

                {isSelected ? (
                  <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded-full bg-cyan-500 text-slate-950">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="rounded-md border border-slate-700/80 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-medium text-slate-400">
                    {fmt.badge}
                  </span>
                )}
              </div>

              <p className="text-[11px] sm:text-xs text-slate-300 line-clamp-1">{fmt.description}</p>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">
                <span className="text-slate-500">Compatível:</span> {fmt.compatibility}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
