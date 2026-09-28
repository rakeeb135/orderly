import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Imperative confirm API                                             */
/*                                                                     */
/*  Usage:                                                             */
/*    const ok = await confirm({ title, message, tone: 'danger' });    */
/*    if (!ok) return;                                                 */
/*                                                                     */
/*  Only one confirm can be open at a time. If a second fires while    */
/*  one is open, the first is auto-cancelled (rare, acceptable).       */
/* ------------------------------------------------------------------ */

const listeners = new Set();
let pending = null;

function emit() {
  listeners.forEach((fn) => fn(pending));
}

export function confirm(options = {}) {
  // If another confirm is already pending, resolve it as false first
  if (pending?.resolve) {
    try { pending.resolve(false); } catch { /* ignore */ }
  }
  return new Promise((resolve) => {
    pending = { options, resolve };
    emit();
  });
}

/* ------------------------------------------------------------------ */
/*  The host component — mount once at the root                        */
/* ------------------------------------------------------------------ */
export default function ConfirmHost() {
  const [state, setState] = useState(null);

  useEffect(() => {
    const fn = (s) => setState(s ? { ...s } : null);
    listeners.add(fn);
    if (pending) setState({ ...pending });
    return () => listeners.delete(fn);
  }, []);

  const respond = (result) => {
    if (pending?.resolve) {
      try { pending.resolve(result); } catch { /* ignore */ }
    }
    pending = null;
    setState(null);
    emit();
  };

  // Escape key = cancel
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === 'Escape') respond(false);
      if (e.key === 'Enter') respond(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  if (!state) return null;

  const {
    title = 'Are you sure?',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    tone = 'default',
  } = state.options || {};

  const TONES = {
    danger: {
      iconBg: 'bg-rose-50',
      iconColor: 'text-rose-600',
      confirmBg: 'bg-rose-600 hover:bg-rose-700',
    },
    warning: {
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      confirmBg: 'bg-amber-600 hover:bg-amber-700',
    },
    default: {
      iconBg: 'bg-[#E8F0E9]',
      iconColor: 'text-[#006241]',
      confirmBg: 'bg-[#006241] hover:bg-[#004F34]',
    },
  };
  const t = TONES[tone] || TONES.default;

  return (
    <div
      className="fixed inset-0 z-[110] bg-[#18181B]/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => respond(false)}
    >
      <div
        className="bg-white rounded-[28px] max-w-sm w-full shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${t.iconBg}`}>
              <AlertTriangle className={`w-5 h-5 ${t.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <h3 className="font-black text-sm text-[#18181B] leading-tight">{title}</h3>
              {message && (
                <p className="text-[11px] text-[#71717A] mt-1.5 leading-relaxed whitespace-pre-line">
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 p-4 pt-0">
          <button
            type="button"
            onClick={() => respond(false)}
            className="py-3 bg-[#F4F4F5] hover:bg-stone-200 text-[#18181B] rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => respond(true)}
            className={`py-3 text-white rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer ${t.confirmBg}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}