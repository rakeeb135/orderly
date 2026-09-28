import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const notify = (message, type = 'success') => {
  window.dispatchEvent(new CustomEvent('ordy-toast', { detail: { message, type } }));
};

export default function Toast() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type } = e.detail;
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3500);
    };

    window.addEventListener('ordy-toast', handleToast);
    return () => window.removeEventListener('ordy-toast', handleToast);
  }, []);

  return (
    <div
      className={[
        'fixed z-[100] pointer-events-none flex gap-2',
        // Mobile: anchored above the mobile bottom dock, full width padded
        'inset-x-3 bottom-24 flex-col-reverse',
        // Desktop: anchored top-right, narrower, newest at top
        'sm:inset-x-auto sm:right-4 sm:top-4 sm:bottom-auto sm:flex-col sm:w-80',
      ].join(' ')}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-2xl text-xs font-semibold shadow-lg border backdrop-blur-md transition-all duration-300 ${
            t.type === 'error'
              ? 'bg-rose-50/95 text-rose-900 border-rose-200'
              : 'bg-[#E8F0E9]/95 text-[#006241] border-[#C2D6C5]'
          }`}
        >
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#006241] shrink-0 mt-0.5" />
            )}
            <span className="leading-snug">{t.message}</span>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-[#5A655D] hover:text-[#111813] shrink-0 p-0.5 -m-0.5 cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}