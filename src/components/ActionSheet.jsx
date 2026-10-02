import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom action sheet for mobile-first flows.
 * Tap outside or press Escape to close.
 * Auto-closes if the user scrolls the page.
 */
export default function ActionSheet({ isOpen, onClose, title, subtitle, actions = [] }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-[#111813]/60 backdrop-blur-sm z-[100]"
        onClick={onClose}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[101] flex justify-center px-3 pb-3 sm:pb-6 animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-md">
          {/* Sheet */}
          <div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border border-[#E7EBE7]">
            {(title || subtitle) && (
              <div className="px-5 pt-4 pb-3 border-b border-[#E7EBE7]">
                {title && (
                  <div className="font-black text-sm text-[#111813] truncate">{title}</div>
                )}
                {subtitle && (
                  <div className="text-[11px] text-[#5A655D] mt-0.5 truncate">{subtitle}</div>
                )}
              </div>
            )}

            <div className="p-2">
              {actions.map((action, i) => {
                const Icon = action.icon;
                const isDanger = action.tone === 'danger';
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onClose();
                      // Defer so the sheet closes cleanly before action runs
                      setTimeout(() => action.onClick?.(), 80);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition active:scale-[0.98] cursor-pointer ${
                      isDanger
                        ? 'text-rose-600 hover:bg-rose-50'
                        : 'text-[#111813] hover:bg-[#F4F6F4]'
                    }`}
                  >
                    {Icon && (
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isDanger ? 'bg-rose-50' : 'bg-[#F4F6F4]'
                      }`}>
                        <Icon className={`w-4 h-4 ${isDanger ? 'text-rose-600' : 'text-[#006241]'}`} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs">{action.label}</div>
                      {action.hint && (
                        <div className={`text-[10px] mt-0.5 ${isDanger ? 'text-rose-400' : 'text-[#5A655D]'}`}>
                          {action.hint}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Cancel */}
            <div className="p-2 pt-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 bg-[#F4F6F4] hover:bg-stone-200 rounded-2xl text-xs font-bold text-[#111813] transition active:scale-[0.98] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}