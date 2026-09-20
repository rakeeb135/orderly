import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { getBuyerTrust, flagReasonLabel } from '../services/dbService';

/* ------------------------------------------------------------------ */
/*  Relative timestamp helper                                          */
/* ------------------------------------------------------------------ */
function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));

  if (diff < 60) return 'just now';
  if (diff < 60 * 60) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 60 * 60 * 24) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 60 * 60 * 24 * 7) return `${Math.floor(diff / (3600 * 24))}d ago`;
  if (diff < 60 * 60 * 24 * 30) return `${Math.floor(diff / (3600 * 24 * 7))}w ago`;
  if (diff < 60 * 60 * 24 * 365) return `${Math.floor(diff / (3600 * 24 * 30))}mo ago`;
  return `${Math.floor(diff / (3600 * 24 * 365))}y ago`;
}

/**
 * TrustReportCard — SILENT by default.
 *
 * Only renders when there is something concrete to report.
 * If the number has no flags, this component returns null.
 * It never claims a buyer is "safe" — it only surfaces warnings
 * from other Ordy sellers.
 */
export default function TrustReportCard({ phone, compact = false }) {
  const [data, setData] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Need at least 9 digits to bother querying
    if (!phone || phone.replace(/[^0-9]/g, '').length < 9) {
      setData(null);
      setVisible(false);
      return;
    }

    setVisible(false); // hide while checking — no flash of stale data
    getBuyerTrust(phone)
      .then((res) => {
        if (!mounted) return;
        setData(res);
        setVisible(Boolean(res && res.total_flags > 0));
      })
      .catch(() => {
        if (mounted) setVisible(false);
      });

    return () => { mounted = false; };
  }, [phone]);

  // Nothing to say → say nothing
  if (!visible || !data || data.total_flags === 0) return null;

  const { total_flags, distinct_sellers, last_flag_at, top_reason } = data;

  // Severity: multiple independent reports = high risk
  const isHighRisk =
    total_flags >= 3 || (total_flags >= 2 && distinct_sellers >= 2);

  const reportLabel =
    total_flags === 1
      ? '1 report'
      : `${total_flags} reports`;

  const sourceLabel =
    distinct_sellers === 1
      ? 'from another seller'
      : `from ${distinct_sellers} sellers`;

  // ---------- Compact mode (POS) ----------
  if (compact) {
    return (
      <div
        className={`border rounded-2xl px-3 py-2.5 flex items-center gap-2.5 animate-in fade-in duration-200 ${
          isHighRisk
            ? 'bg-rose-50 border-rose-300'
            : 'bg-amber-50 border-amber-300'
        }`}
      >
        <AlertTriangle
          className={`w-4 h-4 shrink-0 ${
            isHighRisk ? 'text-rose-600' : 'text-amber-600'
          }`}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`text-[11px] font-black truncate ${
              isHighRisk ? 'text-rose-900' : 'text-amber-900'
            }`}
          >
            {reportLabel} {sourceLabel}
          </div>
          {top_reason && (
            <div
              className={`text-[10px] truncate mt-0.5 ${
                isHighRisk ? 'text-rose-700' : 'text-amber-700'
              }`}
            >
              Most common: {flagReasonLabel(top_reason)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Full mode (OrderDetail) ----------
  return (
    <div
      className={`border-2 rounded-[20px] p-3.5 space-y-2 animate-in fade-in duration-200 ${
        isHighRisk
          ? 'bg-rose-50 border-rose-300'
          : 'bg-amber-50 border-amber-300'
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            isHighRisk ? 'bg-rose-100' : 'bg-amber-100'
          }`}
        >
          <AlertTriangle
            className={`w-4 h-4 ${
              isHighRisk ? 'text-rose-700' : 'text-amber-700'
            }`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`text-sm font-black leading-tight ${
              isHighRisk ? 'text-rose-900' : 'text-amber-900'
            }`}
          >
            {reportLabel} {sourceLabel}
          </div>
          <div
            className={`text-[11px] mt-0.5 ${
              isHighRisk ? 'text-rose-700' : 'text-amber-700'
            }`}
          >
            Buyer has been flagged before
          </div>
        </div>
      </div>

      {(top_reason || last_flag_at) && (
        <div
          className={`pt-2 border-t text-[11px] space-y-1 ${
            isHighRisk ? 'border-rose-200' : 'border-amber-200'
          }`}
        >
          {top_reason && (
            <div className="flex justify-between gap-3">
              <span
                className={isHighRisk ? 'text-rose-700' : 'text-amber-700'}
              >
                Most common
              </span>
              <span
                className={`font-bold text-right ${
                  isHighRisk ? 'text-rose-900' : 'text-amber-900'
                }`}
              >
                {flagReasonLabel(top_reason)}
              </span>
            </div>
          )}
          {last_flag_at && (
            <div className="flex justify-between gap-3">
              <span
                className={isHighRisk ? 'text-rose-700' : 'text-amber-700'}
              >
                Last report
              </span>
              <span
                className={`font-bold ${
                  isHighRisk ? 'text-rose-900' : 'text-amber-900'
                }`}
              >
                {relativeTime(last_flag_at)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}