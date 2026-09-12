import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export const notify = (message, type = 'success') => {
  window.dispatchEvent(new CustomEvent('orderly-toast', { detail: { message, type } }));
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

    window.addEventListener('orderly-toast', handleToast);
    return () => window.removeEventListener('orderly-toast', handleToast);
  }, []);

  return (
    <div className="fixed top-4 right-4 left-4 sm:left-auto z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none mx-auto">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-2xl text-xs font-semibold shadow-lg border backdrop-blur-md transition-all duration-300 ${
            t.type === 'error'
              ? 'bg-rose-50/95 text-rose-900 border-rose-200'
              : 'bg-[#E8F0E9]/95 text-[#006241] border-[#C2D6C5]'
          }`}
        >
          <div className="flex items-center gap-2">
            {t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[#006241] shrink-0" />
            )}
            <span>{t.message}</span>
          </div>
          <button
            onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            className="text-[#5A655D] hover:text-[#111813] ml-2"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}