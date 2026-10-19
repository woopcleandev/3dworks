import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-14 sm:top-auto sm:bottom-4 left-3 sm:left-4 right-3 sm:right-auto z-50 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/90 px-3.5 py-2 text-xs font-medium text-amber-200 shadow-2xl backdrop-blur-md">
      <WifiOff className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
      <span className="truncate">Modo Offline — O conversor funciona localmente no navegador</span>
    </div>
  );
};
