import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Package,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  fetchNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../services/dbService';

/* ------------------------------------------------------------------ */
/*  Relative timestamp helper ("2m ago", "3h ago", "Yesterday")        */
/* ------------------------------------------------------------------ */
function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));

  if (diff < 45) return 'just now';
  if (diff < 60 * 60) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 60 * 60 * 24) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 60 * 60 * 48) return 'Yesterday';
  if (diff < 60 * 60 * 24 * 7) return `${Math.floor(diff / (3600 * 24))}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export default function NotificationCenter({ sellerId }) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');

  const buttonRef = useRef(null);
  const panelRef = useRef(null);
  const audioCtxRef = useRef(null);

  /* ---------------------------------------------------------------- */
  /*  Audio chime                                                      */
  /* ---------------------------------------------------------------- */
  const playChime = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {
      /* autoplay policy / unavailable */
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Initial fetch + realtime subscription                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!sellerId) return;
    let isMounted = true;

    const load = async () => {
      try {
        const data = await fetchNotifications(sellerId);
        if (isMounted) setNotifications(data || []);
      } catch (err) {
        console.error('[NotificationCenter] initial fetch failed:', err);
      }
    };

    load();

    // Refetch when tab regains focus (catch anything missed)
    const onFocus = () => { load(); };
    window.addEventListener('focus', onFocus);

    // Unique channel name — StrictMode double-mount safe
    const channelName = `seller-alerts-${sellerId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `seller_id=eq.${sellerId}`,
        },
        (payload) => {
          if (!isMounted || !payload?.new) return;
          setNotifications((prev) => {
            if (prev.some((n) => n.id === payload.new.id)) return prev;
            return [payload.new, ...prev];
          });
          playChime();
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[NotificationCenter] realtime status:', status);
        }
      });

    return () => {
      isMounted = false;
      window.removeEventListener('focus', onFocus);
      supabase.removeChannel(channel);
    };
  }, [sellerId, playChime]);

  /* ---------------------------------------------------------------- */
  /*  Close on outside click / Escape                                   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!isOpen) return;

    const onDocMouseDown = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setIsOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [isOpen]);

  /* ---------------------------------------------------------------- */
  /*  Derived + actions                                                 */
  /* ---------------------------------------------------------------- */
  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const filteredNotifs =
    filter === 'unread' ? notifications.filter((n) => !n.is_read) : notifications;

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await markNotificationAsRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
      } catch (e) {
        console.error('Failed to mark read:', e);
      }
    }
    setIsOpen(false);
    if (notif.link) navigate(notif.link);
  };

  const handleMarkAllRead = async () => {
    if (!sellerId || unreadCount === 0) return;
    try {
      await markAllNotificationsAsRead(sellerId);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error('Failed to mark all read:', e);
    }
  };

  const renderIcon = (type) => {
    switch (type) {
      case 'verification':
        return <CheckCircle2 className="w-4 h-4 text-[#006241]" />;
      case 'stock':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Package className="w-4 h-4 text-blue-500" />;
    }
  };

  return (
    <>
      {/* Bell trigger */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="relative p-2.5 bg-white hover:bg-stone-100 border border-[#E4E4E7] rounded-2xl text-stone-700 transition active:scale-95 shadow-2xs cursor-pointer flex items-center justify-center"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[#006241] text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center border-2 border-white shadow-2xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Portaled panel */}
      {isOpen &&
        createPortal(
          <>
            {/* Mobile backdrop */}
            <div
              className="fixed inset-0 bg-black/40 z-[80] md:hidden backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
            />

            <div
              ref={panelRef}
              className={[
                // shared
                'fixed z-[90] bg-white border border-[#E4E4E7] shadow-2xl overflow-hidden flex flex-col',
                // mobile: bottom sheet
                'inset-x-3 bottom-4 max-h-[80vh] rounded-[24px]',
                // desktop: top-right dropdown
                'md:inset-auto md:top-[76px] md:right-6 md:w-96 md:max-h-[560px] md:rounded-[20px]',
              ].join(' ')}
            >
              {/* Header */}
              <div className="p-4 border-b border-[#E4E4E7] flex justify-between items-center bg-[#FAFAF9] shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-black text-sm">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-[#006241] border border-emerald-200 rounded-full text-[10px] font-bold">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] font-bold text-[#006241] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="text-stone-400 hover:text-black p-1 rounded-lg hover:bg-stone-100 cursor-pointer"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Filter tabs */}
              <div className="flex gap-1 p-2.5 border-b border-[#E4E4E7] bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => setFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    filter === 'all'
                      ? 'bg-[#18181B] text-white'
                      : 'text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilter('unread')}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition cursor-pointer ${
                    filter === 'unread'
                      ? 'bg-[#18181B] text-white'
                      : 'text-stone-500 hover:bg-stone-100'
                  }`}
                >
                  Unread ({unreadCount})
                </button>
              </div>

              {/* Feed */}
              <div className="overflow-y-auto divide-y divide-[#E4E4E7] flex-1">
                {filteredNotifs.length === 0 ? (
                  <div className="p-10 text-center text-[#71717A] space-y-2">
                    <div className="w-10 h-10 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-400">
                      <Bell className="w-5 h-5" />
                    </div>
                    <p className="font-bold text-xs text-stone-800">All caught up</p>
                    <p className="text-[11px]">No alerts waiting for your review.</p>
                  </div>
                ) : (
                  filteredNotifs.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleItemClick(notif)}
                      className={`p-3.5 transition flex items-start gap-3 cursor-pointer ${
                        !notif.is_read
                          ? 'bg-emerald-50/40 hover:bg-emerald-50/60'
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="p-2 bg-white rounded-xl border border-[#E4E4E7] shrink-0 mt-0.5 shadow-2xs">
                        {renderIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex justify-between items-baseline gap-2">
                          <div className="font-black text-xs truncate text-[#18181B]">
                            {notif.title}
                          </div>
                          <span className="text-[10px] text-stone-400 shrink-0 font-medium">
                            {relativeTime(notif.created_at)}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#52525B] leading-snug line-clamp-2">
                          {notif.message}
                        </div>
                      </div>
                      {!notif.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#006241] shrink-0 mt-1.5" />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}