import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';

export default function InstallAppModal({ shopName = 'Ordy' }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) return;

    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (isIosDevice && !localStorage.getItem('ordy_pwa_dismissed')) {
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('ordy_pwa_dismissed', 'true');
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 max-w-sm mx-auto bg-[#18181B] text-white p-4 rounded-[24px] shadow-2xl z-50 border border-stone-800 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#006241] flex items-center justify-center text-white font-black text-sm shadow-xs shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-black text-xs">Install {shopName}</h4>
            <p className="text-[11px] text-stone-400">Add to your home screen for fast 1-tap access.</p>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-stone-400 hover:text-white p-1">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isIOS ? (
        <div className="mt-3 pt-3 border-t border-stone-800 text-[11px] text-stone-300 space-y-1.5">
          <div className="flex items-center gap-2">
            <span>1. Tap the Share icon below</span>
            <Share className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="flex items-center gap-2">
            <span>2. Scroll down & select</span>
            <span className="font-bold text-white flex items-center gap-1">
              <PlusSquare className="w-3.5 h-3.5" /> Add to Home Screen
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-3 pt-3 border-t border-stone-800 flex gap-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 py-2 text-stone-400 hover:text-white text-xs font-semibold"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={handleInstallClick}
            className="flex-1 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-xs"
          >
            Install App
          </button>
        </div>
      )}
    </div>
  );
}