import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, X, Undo2 } from 'lucide-react';

export const notify = (message, type = 'success', options = {}) => {
  window.dispatchEvent(new CustomEvent('ordy-toast', {
    detail: { message, type, ...options },
  }));
};

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type, undo, undoLabel = 'Undo', duration } = e.detail;
      const id = Date.now() + Math.random();
      const ttl = duration ?? (undo ? 5500 : 3500);
      setToasts((prev) => [...prev, { id, message, type, undo, undoLabel }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ttl);
    };
    window.addEventListener('ordy-toast', handleToast);
    return () => window.removeEventListener('ordy-toast', handleToast);
  }, []);

  const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

  const handleUndo = (t) => {
    try { t.undo?.(); } catch (err) { console.error('[Toast undo]', err); }
    dismiss(t.id);
  };

  return (
    <div className="fixed top-20 left-4 right-4 mx-auto max-w-sm sm:top-4 sm:left-auto sm:right-4 sm:mx-0 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl text-xs font-semibold shadow-lg border backdrop-blur-md transition-all duration-300 ${
            t.type === 'error'
              ? 'bg-rose-50/95 text-rose-900 border-rose-200'
              : 'bg-[#E8F0E9]/95 text-[#006241] border-[#C2D6C5]'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#006241] shrink-0" />
            )}
            <span className="leading-snug truncate">{t.message}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            {t.undo && (
              <button
                type="button"
                onClick={() => handleUndo(t)}
                className="px-2.5 py-1 rounded-lg bg-white/80 hover:bg-white text-[#006241] font-bold text-[11px] transition active:scale-95 flex items-center gap-1 cursor-pointer"
              >
                <Undo2 className="w-3 h-3" />
                {t.undoLabel}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="text-[#5A655D] hover:text-[#111813] p-1 cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}