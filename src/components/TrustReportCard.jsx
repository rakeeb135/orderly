import React, { useState, useEffect } from 'react';
import { ShieldCheck, ShieldAlert, Shield, Loader2 } from 'lucide-react';
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

export default function TrustReportCard({ phone, compact = false }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;
    if (!phone || phone.replace(/[^0-9]/g, '').length < 9) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    getBuyerTrust(phone)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [phone]);

  // Not enough digits yet — don't show anything
  if (!phone || phone.replace(/[^0-9]/g, '').length < 9) return null;

  if (loading) {
    return (
      <div className="bg-white border border-[#E7EBE7] rounded-2xl p-3 text-xs text-[#71717A] flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#006241]" />
        <span>Checking buyer history on the network…</span>
      </div>
    );
  }

  if (!data) return null;

  const { total_flags, distinct_sellers, last_flag_at, top_reason } = data;

  // Three tiers based on flag count and seller diversity
  let tier = 'clean';
  if (total_flags >= 3 || (total_flags >= 2 && distinct_sellers >= 2)) {
    tier = 'danger';
  } else if (total_flags >= 1) {
    tier = 'caution';
  }

  const CONFIG = {
    clean: {
      wrapper: 'bg-[#E8F0E9] border-[#C2D6C5]',
      iconBg: 'bg-white',
      iconColor: 'text-[#006241]',
      titleColor: 'text-[#006241]',
      Icon: ShieldCheck,
      title: 'Clean record',
      subtitle: 'No issues reported on the network in the last 12 months.',
    },
    caution: {
      wrapper: 'bg-amber-50 border-amber-200',
      iconBg: 'bg-white',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      Icon: ShieldAlert,
      title: `${total_flags} report${total_flags === 1 ? '' : 's'} in the last 12 months`,
      subtitle:
        distinct_sellers > 1
          ? `Flagged by ${distinct_sellers} different sellers`
          : 'Flagged by 1 seller',
    },
    danger: {
      wrapper: 'bg-rose-50 border-rose-200',
      iconBg: 'bg-white',
      iconColor: 'text-rose-600',
      titleColor: 'text-rose-900',
      Icon: ShieldAlert,
      title: `High risk — ${total_flags} reports`,
      subtitle:
        distinct_sellers > 1
          ? `Flagged by ${distinct_sellers} different sellers`
          : 'Flagged by 1 seller',
    },
  }[tier];

  const { Icon } = CONFIG;

  // Compact mode for POS — smaller, more scannable
  if (compact) {
    return (
      <div className={`${CONFIG.wrapper} border rounded-2xl p-3 flex items-center gap-2.5`}>
        <div className={`w-7 h-7 rounded-lg ${CONFIG.iconBg} flex items-center justify-center shrink-0`}>
          <Icon className={`w-3.5 h-3.5 ${CONFIG.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] font-black ${CONFIG.titleColor} truncate`}>
            {CONFIG.title}
          </div>
          <div className={`text-[10px] ${CONFIG.titleColor} opacity-75 truncate`}>
            {CONFIG.subtitle}
          </div>
        </div>
      </div>
    );
  }

  // Full mode for OrderDetail — includes top reason + last flag time
  return (
    <div className={`${CONFIG.wrapper} border rounded-[24px] p-4 space-y-3 shadow-xs`}>
      <div className="flex items-center gap-2">
        <Shield className={`w-3.5 h-3.5 ${CONFIG.iconColor}`} />
        <span className={`text-[10px] font-black uppercase tracking-wider ${CONFIG.titleColor} opacity-70`}>
          Buyer Trust Report
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl ${CONFIG.iconBg} flex items-center justify-center shrink-0 shadow-xs`}>
          <Icon className={`w-4 h-4 ${CONFIG.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`font-black text-sm ${CONFIG.titleColor} leading-tight`}>
            {CONFIG.title}
          </div>
          <div className={`text-[11px] ${CONFIG.titleColor} opacity-75 mt-0.5`}>
            {CONFIG.subtitle}
          </div>
        </div>
      </div>

      {tier !== 'clean' && (top_reason || last_flag_at) && (
        <div className={`pt-3 border-t ${CONFIG.titleColor} opacity-100 space-y-1.5 text-[11px]`}>
          {top_reason && (
            <div className="flex justify-between gap-3">
              <span className="opacity-70">Most common</span>
              <span className={`font-bold text-right ${CONFIG.titleColor}`}>
                {flagReasonLabel(top_reason)}
              </span>
            </div>
          )}
          {last_flag_at && (
            <div className="flex justify-between gap-3">
              <span className="opacity-70">Last report</span>
              <span className={`font-bold ${CONFIG.titleColor}`}>
                {relativeTime(last_flag_at)}
              </span>
            </div>
          )}
        </div>
      )}

      {tier === 'clean' && (
        <div className={`text-[10px] ${CONFIG.titleColor} opacity-70 pt-1`}>
          This buyer has no reported issues across the Ordy network.
        </div>
      )}
    </div>
  );
}