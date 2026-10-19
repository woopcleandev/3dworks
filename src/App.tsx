/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Box,
  Layers,
  Boxes,
  ArrowRightLeft,
  Download,
  RotateCcw,
  ShieldCheck,
  CheckCircle,
  FileCode,
  HardDrive,
  AlertTriangle,
  FileUp,
  X,
  Cog,
} from 'lucide-react';

import { MeshBody, SupportedFormat, ModelInfo, ConversionResult } from './converter/types';
import { parseMesh } from './converter/meshParsers';
import { exportMesh } from './converter/meshExporters';
import { SAMPLE_MODELS, SampleModelDef } from './converter/sampleModels';
import { Viewer3D } from './components/Viewer3D';
import { FormatSelector } from './components/FormatSelector';
import { UnitSelector } from './components/UnitSelector';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';

export default function App() {
  const [modelBuffer, setModelBuffer] = useState<ArrayBuffer | null>(null);
  const [modelBodies, setModelBodies] = useState<MeshBody[]>([]);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);

  const [targetFormat, setTargetFormat] = useState<SupportedFormat>('step');
  const [unitScale, setUnitScale] = useState<number>(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [result, setResult] = useState<ConversionResult | null>(null);
  const [showSamplesModal, setShowSamplesModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Clean up object URLs when result changes or unmounts
  useEffect(() => {
    return () => {
      if (result?.url) {
        URL.revokeObjectURL(result.url);
      }
    };
  }, [result]);

  const resetConversionState = () => {
    if (result?.url) {
      URL.revokeObjectURL(result.url);
    }
    setResult(null);
    setErrorMsg('');
    setProgress(0);
    setProgressMsg('');
  };

  const processLoadedBuffer = (buf: ArrayBuffer, name: string, ext: string) => {
    resetConversionState();
    setErrorMsg('');

    try {
      const meshes = parseMesh(buf, ext);

      let minX = Infinity, minY = Infinity, minZ = Infinity;
      let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

      for (const b of meshes) {
        for (let i = 0; i < b.pos.length; i += 3) {
          const x = b.pos[i];
          const y = b.pos[i + 1];
          const z = b.pos[i + 2];
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (z < minZ) minZ = z;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
          if (z > maxZ) maxZ = z;
        }
      }

      const dims: [number, number, number] = [
        Math.max(0, maxX - minX),
        Math.max(0, maxY - minY),
        Math.max(0, maxZ - minZ),
      ];

      const maxDim = Math.max(...dims) || 1;
      const cz = (minZ + maxZ) / 2;
      const floor = ((minZ - cz) * 2) / maxDim;

      const trisCount = meshes.reduce((acc, m) => acc + m.idx.length / 3, 0);
      const vertsCount = meshes.reduce((acc, m) => acc + m.pos.length / 3, 0);

      // Default unit scale: WAD files often use meters (1000), others default to mm (1)
      if (ext.toLowerCase() === 'wad') {
        setUnitScale(1000);
      } else {
        setUnitScale(1);
      }

      setModelBuffer(buf);
      setModelBodies(meshes);
      setModelInfo({
        name,
        ext: ext.toLowerCase(),
        bodies: meshes.length,
        tris: trisCount,
        vertices: vertsCount,
        dims,
        size: buf.byteLength,
        groups: [],
        floor,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Erro ao analisar arquivo: ${msg}`);
      setModelBuffer(null);
      setModelBodies([]);
      setModelInfo(null);
    }
  };

  const handleFileUpload = async (file: File) => {
    const ext = file.name.split('.').pop() || '';
    const buf = await file.arrayBuffer();
    processLoadedBuffer(buf, file.name, ext);
  };

  const handleLoadSample = (sample: SampleModelDef) => {
    setShowSamplesModal(false);
    const { buffer } = sample.generate();
    processLoadedBuffer(buffer, `${sample.name}.${sample.ext}`, sample.ext);
  };

  const handleConvert = async () => {
    if (!modelBuffer || !modelInfo) return;

    resetConversionState();
    setIsProcessing(true);
    setErrorMsg('');
    setProgress(0.05);
    setProgressMsg('Iniciando processamento geométrico...');

    try {
      const baseName = modelInfo.name.replace(/\.[^/.]+$/, '').replace(/[^\w-]/g, '_') || 'modelo3d';

      const exportRes = await exportMesh(
        modelBuffer,
        modelInfo.ext,
        targetFormat,
        unitScale,
        baseName,
        (p, msg) => {
          setProgress(p);
          setProgressMsg(msg);
        }
      );

      const downloadUrl = URL.createObjectURL(exportRes.blob);
      const finalFileName = `${baseName}.${exportRes.ext}`;

      setResult({
        blob: exportRes.blob,
        url: downloadUrl,
        faces: exportRes.faces,
        bodies: exportRes.bodies,
        ext: exportRes.ext,
        size: exportRes.blob.size,
        filename: finalFileName,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Falha na conversão: ${msg}. Dica: Para malhas com milhões de polígonos, o formato STL binário ou OBJ oferece conversão mais rápida.`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes >= 1048576) {
      return `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src="/icon.svg"
              alt="3D Work Suite Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl shadow-md shadow-cyan-950/40 border border-cyan-500/30 object-contain bg-slate-900"
            />
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-bold tracking-tight text-sm sm:text-lg text-slate-100">
                  3D Work Suite
                </span>
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/25 px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold text-cyan-300">
                  PWA
                </span>
              </div>
              <p className="hidden sm:block text-[11px] text-slate-400">
                WAD • OBJ • STL • PLY • OFF • STEP
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSamplesModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/80 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:text-white transition cursor-pointer min-h-[36px]"
              title="Abrir modelos 3D de teste"
            >
              <Boxes className="h-4 w-4 text-cyan-400" />
              <span className="hidden sm:inline">Modelos de</span> Demonstração
            </button>

            {/* In-App PWA Install Button */}
            <PWAInstallButton variant="nav" />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 pb-28 lg:pb-8">
        {/* PWA Install Banner (shown when applicable) */}
        <PWAInstallButton variant="banner" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
          {/* Left Column: 3D Viewport & Model Inspection */}
          <div className="lg:col-span-7 space-y-3 sm:space-y-4">
            <Viewer3D
              bodies={modelBodies}
              floor={modelInfo?.floor || -1}
              dims={modelInfo?.dims || [0, 0, 0]}
              fileName={modelInfo?.name}
              onDropFile={handleFileUpload}
              onPickFile={() => fileInputRef.current?.click()}
            />

            {/* Model Metadata Information Card */}
            {modelInfo && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3.5 sm:p-4 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <FileCode className="h-4 w-4" />
                    </div>
                    <div className="overflow-hidden">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
                        {modelInfo.name}
                      </h4>
                      <p className="text-[10px] sm:text-[11px] text-slate-400 uppercase font-mono">
                        Formato .{modelInfo.ext} • {formatFileSize(modelInfo.size)}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer min-h-[34px]"
                  >
                    <FileUp className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Trocar</span>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 sm:p-2.5">
                    <span className="block text-[10px] sm:text-[11px] text-slate-400">Corpos</span>
                    <strong className="text-xs sm:text-base font-bold text-slate-100 font-mono">
                      {modelInfo.bodies.toLocaleString('pt-BR')}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 sm:p-2.5">
                    <span className="block text-[10px] sm:text-[11px] text-slate-400">Triângulos</span>
                    <strong className="text-xs sm:text-base font-bold text-cyan-400 font-mono">
                      {modelInfo.tris.toLocaleString('pt-BR')}
                    </strong>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-slate-950/40 p-2 sm:p-2.5">
                    <span className="block text-[10px] sm:text-[11px] text-slate-400">Vértices</span>
                    <strong className="text-xs sm:text-base font-bold text-slate-100 font-mono">
                      {modelInfo.vertices.toLocaleString('pt-BR')}
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Converter Controls, Formats & Actions */}
          <div className="lg:col-span-5 space-y-4 sm:space-y-5">
            {/* If no model is loaded yet, show upload dropzone card */}
            {!modelInfo && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="group relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-500/70 bg-slate-900/40 hover:bg-slate-900/70 p-6 sm:p-8 text-center transition cursor-pointer"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 group-hover:scale-110 transition duration-200">
                  <Upload className="h-6 w-6" />
                </div>
                <h4 className="mt-3 text-xs sm:text-sm font-semibold text-slate-100">
                  Carregar modelo para converter
                </h4>
                <p className="mt-1 text-[11px] sm:text-xs text-slate-400">
                  Toque para selecionar do dispositivo ou arraste o arquivo
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                  {['.WAD', '.OBJ', '.STL', '.PLY', '.OFF'].map((fmt) => (
                    <span
                      key={fmt}
                      className="rounded-md border border-slate-700/60 bg-slate-800/50 px-2 py-0.5 text-[10px] font-mono text-slate-300"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Format Selection Card */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 sm:p-5 backdrop-blur-sm space-y-4 sm:space-y-5">
              <FormatSelector
                selectedFormat={targetFormat}
                onSelectFormat={(f) => {
                  setTargetFormat(f);
                  resetConversionState();
                }}
                triangleCount={modelInfo?.tris || 0}
              />

              <div className="border-t border-slate-800/80 pt-3 sm:pt-4">
                <UnitSelector
                  scale={unitScale}
                  onScaleChange={(s) => {
                    setUnitScale(s);
                    resetConversionState();
                  }}
                  dims={modelInfo?.dims || [0, 0, 0]}
                />
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-950/40 p-3.5 sm:p-4 text-xs text-rose-200">
                <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <strong className="block text-rose-100 mb-0.5">Aviso</strong>
                  {errorMsg}
                </div>
              </div>
            )}

            {/* Desktop / Large Screen Conversion Box */}
            <div className="hidden lg:block rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm space-y-4">
              {/* Progress State */}
              {isProcessing && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{progressMsg}</span>
                    <span className="font-mono text-cyan-400 font-bold">
                      {Math.round(progress * 100)}%
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200 ease-out"
                      style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Success Result State */}
              {result && !isProcessing && (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3.5">
                    <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-xs font-semibold text-emerald-200 truncate">
                        Conversão para .{result.ext.toUpperCase()} concluída!
                      </p>
                      <p className="text-[11px] text-emerald-400/80">
                        {result.bodies} {result.bodies > 1 ? 'corpos' : 'corpo'} •{' '}
                        {result.faces.toLocaleString('pt-BR')} faces • {formatFileSize(result.size)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <a
                      href={result.url}
                      download={result.filename}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 active:scale-95 transition-all cursor-pointer text-center min-h-[44px]"
                    >
                      <Download className="h-4 w-4" />
                      <span>Baixar {result.filename}</span>
                    </a>
                    <button
                      onClick={resetConversionState}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition cursor-pointer min-h-[44px]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Refazer</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Desktop Main Action Button */}
              {!result && (
                <button
                  type="button"
                  onClick={handleConvert}
                  disabled={!modelInfo || isProcessing}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3.5 text-xs sm:text-sm font-bold text-white shadow-xl shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 active:scale-98 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer min-h-[48px]"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  <span>
                    {isProcessing
                      ? 'Processando Geometria...'
                      : modelInfo
                      ? `Converter para .${targetFormat.toUpperCase()}`
                      : 'Carregue um arquivo para começar'}
                  </span>
                </button>
              )}

              {/* Privacy Guarantee Note */}
              <div className="flex items-center justify-center gap-2 pt-1 text-center text-[11px] text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>
                  Privacidade Total: Seus arquivos são convertidos 100% no seu dispositivo.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Highlights Section */}
        <section className="border-t border-slate-800/80 pt-6 mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold">
              <HardDrive className="h-4 w-4" />
              <span>Offline e PWA</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
              Instale no celular ou desktop e utilize em qualquer lugar, mesmo sem conexão à internet.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center gap-2 text-blue-400 text-xs font-semibold">
              <Layers className="h-4 w-4" />
              <span>Suporte a STEP (ISO-10303)</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
              Gera arquivos compatíveis com SolidWorks, Autodesk Fusion, Inventor e softwares de engenharia mecânica.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-3.5 sm:p-4 space-y-1">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>Processamento no Navegador</span>
            </div>
            <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed">
              Nenhum dado é enviado para a nuvem. Conversão segura de projetos proprietários e sigilosos.
            </p>
          </div>
        </section>
      </main>

      {/* MOBILE STICKY BOTTOM ACTION BAR (Shown on screens < lg when a model is active) */}
      {modelInfo && (
        <aside aria-label="Ações de conversão" className="block lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/90 bg-slate-950/95 backdrop-blur-xl px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl">
          {isProcessing ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-medium truncate">{progressMsg}</span>
                <span className="font-mono text-cyan-400 font-bold ml-2">
                  {Math.round(progress * 100)}%
                </span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200"
                  style={{ width: `${Math.min(100, Math.max(5, progress * 100))}%` }}
                />
              </div>
            </div>
          ) : result ? (
            <div className="flex items-center gap-2">
              <a
                href={result.url}
                download={result.filename}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all min-h-[46px]"
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="truncate">Baixar .{result.ext.toUpperCase()} ({formatFileSize(result.size)})</span>
              </a>
              <button
                onClick={resetConversionState}
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800 px-3 py-3 text-xs text-slate-300 hover:text-white transition min-h-[46px] min-w-[46px]"
                title="Refazer conversão"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex flex-col justify-center px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 shrink-0">
                <span className="text-[9px] uppercase tracking-wider text-slate-400">Destino</span>
                <span className="text-xs font-bold font-mono text-cyan-400">
                  .{targetFormat.toUpperCase()}
                </span>
              </div>
              <button
                type="button"
                onClick={handleConvert}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 active:scale-95 transition-all min-h-[46px]"
              >
                <ArrowRightLeft className="h-4 w-4" />
                <span>Converter para .{targetFormat.toUpperCase()}</span>
              </button>
            </div>
          )}
        </aside>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".wad,.obj,.stl,.ply,.off"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />

      {/* Demo Models Selection Modal */}
      {showSamplesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3.5 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Boxes className="h-5 w-5 text-cyan-400" />
                <h3 className="text-sm sm:text-base font-semibold text-slate-100">
                  Modelos 3D de Demonstração
                </h3>
              </div>
              <button
                onClick={() => setShowSamplesModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-slate-200 min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Selecione uma geometria para testar a visualização e conversão determinística para STEP, STL, OBJ, PLY ou OFF:
            </p>

            <div className="space-y-2.5">
              {SAMPLE_MODELS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handleLoadSample(sample)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3 sm:p-3.5 hover:border-cyan-500/50 hover:bg-slate-800/80 transition text-left cursor-pointer group min-h-[52px]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition shrink-0">
                      <Box className="h-5 w-5" />
                    </div>
                    <div>
                      <h5 className="text-xs font-bold text-slate-100 group-hover:text-cyan-300 transition">
                        {sample.name}
                      </h5>
                      <p className="text-[11px] text-slate-400">{sample.description}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-1 rounded-md shrink-0">
                    Carregar
                  </span>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowSamplesModal(false)}
                className="w-full sm:w-auto rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-700 transition min-h-[44px]"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Offline Connectivity Notification Banner */}
      <OfflineIndicator />
    </div>
  );
}
