import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Clock, AlertTriangle, X } from 'lucide-react';

const DEFAULT_FEE = 2990;

/**
 * SubscriptionBanner — shown on all seller pages.
 *
 *  > 7 days remaining   → nothing
 *  0 < days <= 7        → info (soft amber)
 *  0 < days <= 3        → warning (amber)
 *  days === 0           → warning ("expires today")
 *  -3 < days < 0        → danger (red, grace period)
 *  days <= -3           → nothing (full lockout page takes over)
 */
export default function SubscriptionBanner({ seller }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  const sellerId = seller?.id;
  const todayKey = new Date().toISOString().slice(0, 10);
  const storageKey = sellerId ? `ordy_sub_banner_${sellerId}_${todayKey}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      if (localStorage.getItem(storageKey) === '1') setDismissed(true);
      else setDismissed(false);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  // Never show on the renewal page itself
  if (location.pathname === '/renew') return null;

  if (!seller || seller.is_super_admin) return null;
  if (dismissed) return null;

  const expiryDate = seller.subscription_expires_at
    ? new Date(seller.subscription_expires_at)
    : null;
  if (!expiryDate) return null;

  const msRemaining = expiryDate.getTime() - Date.now();
  const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

  // Beyond 7 days away → no banner
  if (daysRemaining > 7) return null;

  // Locked out → ProtectedShell renders the full lockout page, no banner needed
  if (daysRemaining <= -3) return null;

  // Determine state
  let tone, Icon, title, message;

  if (daysRemaining > 3) {
    tone = 'info';
    Icon = Clock;
    title = `${daysRemaining} days left in your trial`;
    message = 'Renew to keep your store live and orders flowing.';
  } else if (daysRemaining > 0) {
    tone = 'warning';
    Icon = Clock;
    title = `Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`;
    message = 'Renew now to avoid interruption to your store.';
  } else if (daysRemaining === 0) {
    tone = 'warning';
    Icon = AlertTriangle;
    title = 'Your subscription expires today';
    message = 'Renew now to avoid downtime.';
  } else {
    // -1 or -2
    const past = Math.abs(daysRemaining);
    tone = 'danger';
    Icon = AlertTriangle;
    title = `Subscription expired ${past} day${past === 1 ? '' : 's'} ago`;
    message = 'You are in a grace period. Renew now or your store will be locked.';
  }

  const TONES = {
    info: {
      wrapper: 'bg-amber-50 border-amber-200',
      iconColor: 'text-amber-600',
      titleColor: 'text-amber-900',
      msgColor: 'text-amber-800',
      cta: 'bg-amber-700 hover:bg-amber-800',
    },
    warning: {
      wrapper: 'bg-amber-100 border-amber-300',
      iconColor: 'text-amber-700',
      titleColor: 'text-amber-900',
      msgColor: 'text-amber-800',
      cta: 'bg-amber-700 hover:bg-amber-800',
    },
    danger: {
      wrapper: 'bg-rose-50 border-rose-300',
      iconColor: 'text-rose-600',
      titleColor: 'text-rose-900',
      msgColor: 'text-rose-800',
      cta: 'bg-rose-600 hover:bg-rose-700',
    },
  };

  const style = TONES[tone];

  const handleDismiss = () => {
    if (storageKey) {
      try { localStorage.setItem(storageKey, '1'); } catch { /* ignore */ }
    }
    setDismissed(true);
  };

  return (
    <div className={`mb-4 border rounded-[20px] p-3.5 flex items-center gap-3 shadow-xs ${style.wrapper}`}>
      <div className="w-8 h-8 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
        <Icon className={`w-4 h-4 ${style.iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`font-black text-xs ${style.titleColor} truncate`}>{title}</div>
        <div className={`text-[10px] ${style.msgColor} truncate`}>{message}</div>
      </div>
      <button
        onClick={() => navigate('/renew')}
        className={`px-3 py-1.5 rounded-xl text-[11px] font-bold text-white shrink-0 transition active:scale-95 ${style.cta}`}
      >
        Renew Now
      </button>
      <button
        onClick={handleDismiss}
        className={`p-1.5 rounded-lg hover:bg-white/60 transition shrink-0 ${style.iconColor}`}
        aria-label="Dismiss for today"
        title="Dismiss for today"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}