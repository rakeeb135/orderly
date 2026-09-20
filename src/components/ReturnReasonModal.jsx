import React, { useState } from 'react';
import { AlertTriangle, X, Loader2, ShieldAlert } from 'lucide-react';

const REASONS = [
  { id: 'no_answer', label: "Buyer didn't answer phone", hint: 'Tried multiple times' },
  { id: 'refused', label: 'Buyer refused delivery', hint: 'Rider was turned away' },
  { id: 'wrong_address', label: 'Wrong / fake address', hint: 'Address was invalid' },
  { id: 'changed_mind', label: 'Buyer changed mind', hint: 'Cancelled after dispatch' },
  { id: 'other', label: 'Other reason', hint: 'Explain below' },
];

export default function ReturnReasonModal({ isOpen, order, onClose, onConfirm, submitting }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const reset = () => {
    setReason(null);
    setNote('');
    setError('');
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleConfirm = () => {
    if (!reason) {
      setError('Please pick a reason before confirming.');
      return;
    }
    setError('');
    onConfirm({ reason, note: note.trim() });
  };

  return (
    <div className="fixed inset-0 bg-[#111813]/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto text-[#111813]">

        {/* Header */}
        <div className="flex justify-between items-start gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-black text-sm">Mark Order as Returned</h3>
              <p className="text-[11px] text-[#5A655D] mt-0.5 font-mono">
                #{order?.order_code || order?.id?.slice(0, 4)}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="text-stone-400 hover:text-black p-1 -m-1 transition disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Why this matters */}
        <div className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-2xl p-3.5 text-[11px] text-[#5A655D] leading-relaxed">
          <strong className="text-[#111813]">Why did this order fail?</strong>
          <br />
          Your answer helps every other Ordy seller spot this buyer before they waste a trip. You'll never see who else reported them — only the total.
        </div>

        {/* Reason options */}
        <div className="space-y-2">
          {REASONS.map((r) => {
            const active = reason === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setReason(r.id);
                  setError('');
                }}
                className={`w-full text-left px-3.5 py-3 rounded-xl border transition active:scale-[0.98] cursor-pointer ${
                  active
                    ? 'bg-[#006241] text-white border-[#006241] shadow-xs'
                    : 'bg-white text-[#111813] border-[#E7EBE7] hover:border-stone-400'
                }`}
              >
                <div className="font-bold text-xs">{r.label}</div>
                <div className={`text-[10px] mt-0.5 ${active ? 'text-white/70' : 'text-[#5A655D]'}`}>
                  {r.hint}
                </div>
              </button>
            );
          })}
        </div>

        {/* Optional note */}
        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5A655D] mb-1.5">
            Private note <span className="font-normal normal-case tracking-normal opacity-70">(optional)</span>
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Rang twice, no answer, then phone switched off."
            maxLength={200}
            className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-xs resize-none outline-none transition"
          />
          <div className="text-[10px] text-[#5A655D] mt-1">
            Only you can see this note. It's never shared with other sellers.
          </div>
        </div>

        {/* Confirm intent */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-start gap-2 text-[11px] text-amber-800 leading-relaxed">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            This will mark the order as returned, restore stock, and add this phone number to the Ordy trust network.
          </span>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-2 rounded-xl">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7EBE7]">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="py-3 bg-[#F4F6F4] hover:bg-stone-200 text-[#111813] rounded-2xl text-xs font-bold active:scale-95 transition disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !reason}
            className="py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Return & Flag'}
          </button>
        </div>
      </div>
    </div>
  );
}