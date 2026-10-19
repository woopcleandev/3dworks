import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle2, X, Share2, PlusSquare } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface Props {
  variant?: 'nav' | 'banner';
}

export const PWAInstallButton: React.FC<Props> = ({ variant = 'nav' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [showGenericGuide, setShowGenericGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'banner') return null;
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
        <span>PWA Ativo</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      await install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    } else {
      setShowGenericGuide(true);
    }
  };

  return (
    <>
      {variant === 'banner' ? (
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-blue-950/40 p-4 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-slate-100">Instalar 3D Work Suite</h4>
                <p className="text-xs text-slate-400">
                  Acesse offline, sem barra de navegador e com velocidade nativa no seu celular ou computador.
                </p>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-500/20 hover:from-cyan-400 hover:to-blue-500 active:scale-95 transition-all cursor-pointer whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Instalar Agora</span>
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/40 px-3.5 py-1.5 text-xs font-medium text-cyan-300 shadow-sm hover:bg-cyan-900/40 hover:text-cyan-100 hover:border-cyan-400/60 active:scale-95 transition-all cursor-pointer"
          title="Instalar como aplicativo PWA no dispositivo"
        >
          <Download className="h-3.5 w-3.5 text-cyan-400" />
          <span>Instalar PWA</span>
        </button>
      )}

      {/* iOS Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Smartphone className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Instalar no iPhone / iPad</h3>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <Share2 className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-slate-100 mb-0.5">1. Toque em Compartilhar</strong>
                  No navegador Safari, clique no botão de compartilhamento no rodapé.
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <PlusSquare className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-slate-100 mb-0.5">2. Adicionar à Tela de Início</strong>
                  Role o menu de ações e selecione a opção &quot;Adicionar à Tela de Início&quot;.
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-slate-100 mb-0.5">3. Pronto!</strong>
                  O ícone do 3D Work Suite aparecerá na tela do seu aparelho com inicialização instantânea e suporte offline.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full rounded-xl bg-slate-800 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Desktop / Other browsers guide when prompt hasn't triggered */}
      {showGenericGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
                  <Download className="h-4 w-4" />
                </div>
                <h3 className="text-base font-semibold text-slate-100">Instalação Direta</h3>
              </div>
              <button
                onClick={() => setShowGenericGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Você pode instalar este app diretamente pelo seu navegador:
            </p>
            <ul className="space-y-2 text-xs text-slate-300 mb-4 list-disc pl-4">
              <li>
                <strong>No Chrome ou Edge (Desktop):</strong> Clique no ícone de instalação (computadorzinho com seta para baixo) na barra de endereços (lado direito).
              </li>
              <li>
                <strong>No Chrome (Android):</strong> Abra o menu (três pontinhos) e clique em <em>&quot;Instalar aplicativo&quot;</em> ou <em>&quot;Adicionar à tela inicial&quot;</em>.
              </li>
            </ul>
            <button
              onClick={() => setShowGenericGuide(false)}
              className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </>
  );
};
