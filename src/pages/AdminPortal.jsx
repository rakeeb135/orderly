import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Calendar,
  ExternalLink,
  Search,
  Loader2,
  Power,
  Trash2,
  X,
  History,
  DollarSign,
  MessageCircle,
  AlertTriangle,
  TrendingUp,
  Store,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  fetchAllSellersAdmin,
  fetchCurrentSeller,
  extendSubscription,
  setCustomSubscriptionExpiry,
  toggleStoreActiveStatus,
  deleteSellerAdmin,
  fetchSubscriptionHistory,
  updateSellerFee,
  formatLKR
} from '../services/dbService';
import { notify } from '../components/Toast';
import { confirm } from '../components/ConfirmModal';

const DEFAULT_FEE = 2990;

const RENEWAL_TEMPLATE = (shop) => {
  const expiry = shop.subscription_expires_at
    ? new Date(shop.subscription_expires_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'today';
  const fee = Number(shop.monthly_fee) || DEFAULT_FEE;

  return `Hi ${shop.shop_name}! 👋

Your Ordy subscription expires on ${expiry}. To keep your store live and orders flowing, please renew for Rs. ${fee.toLocaleString('en-LK')} for 30 days.

Bank: Commercial Bank of Ceylon
Account Name: M.T.M Rakeeb
Account Number: 8012055155
Branch: Kandy

Once you transfer, send me the slip on this WhatsApp and I'll extend your access right away.

Thanks for using Ordy!`;
};

function daysRemaining(shop) {
  if (!shop.subscription_expires_at) return -9999;
  const exp = new Date(shop.subscription_expires_at).getTime();
  const diff = exp - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getStatusMeta(shop) {
  if (shop.is_active === false) {
    return {
      tone: 'suspended',
      pill: 'bg-stone-100 text-stone-600 border-stone-300',
      label: 'Suspended',
    };
  }
  const days = daysRemaining(shop);
  if (days < 0) {
    return {
      tone: 'expired',
      pill: 'bg-rose-50 text-rose-700 border-rose-300',
      label: `Expired ${Math.abs(days)}d ago`,
    };
  }
  if (days <= 3) {
    return {
      tone: 'expiring',
      pill: 'bg-amber-50 text-amber-800 border-amber-300',
      label: `${days}d left`,
    };
  }
  if (days <= 7) {
    return {
      tone: 'expiring',
      pill: 'bg-amber-50 text-amber-800 border-amber-200',
      label: `${days}d left`,
    };
  }
  return {
    tone: 'active',
    pill: 'bg-[#E8F0E9] text-[#006241] border-[#C2D6C5]',
    label: `${days}d left`,
  };
}

/* ------------------------------------------------------------------ */
/*  Shop card — used on both mobile and desktop                        */
/* ------------------------------------------------------------------ */
function ShopCard({
  shop,
  me,
  isBusy,
  onExtend,
  onSetExpiry,
  onOpenFee,
  onOpenHistory,
  onToggleActive,
  onDelete,
}) {
  const status = getStatusMeta(shop);
  const expiry = shop.subscription_expires_at
    ? new Date(shop.subscription_expires_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Never';
  const fee = Number(shop.monthly_fee) || DEFAULT_FEE;
  const isMe = me && shop.id === me.id;

  const waLink = `https://wa.me/${
    (shop.whatsapp_number || '').replace(/[^0-9]/g, '').replace(/^0/, '94')
  }?text=${encodeURIComponent(RENEWAL_TEMPLATE(shop))}`;

  return (
    <div className="bg-white border border-[#E7EBE7] rounded-[20px] p-4 shadow-xs hover:border-stone-300 transition">
      {/* Top row: identity + status pill */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="w-7 h-7 rounded-lg bg-[#F4F6F4] flex items-center justify-center shrink-0 overflow-hidden">
              {shop.logo_url ? (
                <img src={shop.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <Store className="w-3.5 h-3.5 text-[#006241]" />
              )}
            </div>
            <div className="font-extrabold text-sm text-[#111813] truncate">
              {shop.shop_name}
            </div>
            <Link
              to={`/${shop.handle}`}
              target="_blank"
              className="text-stone-400 hover:text-[#006241] shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="text-[10px] text-[#5A655D] font-mono mt-0.5 truncate">
            /{shop.handle}
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border whitespace-nowrap shrink-0 ${status.pill}`}>
          {status.label}
        </span>
      </div>

      {/* Contact row */}
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#71717A]">
        <span className="font-mono font-bold text-[#111813]">{shop.whatsapp_number}</span>
        {shop.email && (
          <>
            <span className="text-stone-300">·</span>
            <span className="truncate">{shop.email}</span>
          </>
        )}
      </div>

      {/* Facts row */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
        <div className="bg-[#F4F6F4] rounded-xl px-2.5 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#5A655D]">Fee</div>
          <div className="font-black text-[#111813] font-mono">Rs. {fee.toLocaleString('en-LK')}</div>
        </div>
        <div className="bg-[#F4F6F4] rounded-xl px-2.5 py-1.5">
          <div className="text-[9px] font-bold uppercase tracking-wider text-[#5A655D]">Expires</div>
          <div className="font-black text-[#111813] font-mono text-[10px]">{expiry}</div>
        </div>
      </div>

      {/* Primary actions */}
      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onExtend(shop, 30)}
          disabled={isBusy}
          className="flex-1 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-[11px] font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          +30d
        </button>
        <button
          type="button"
          onClick={() => onExtend(shop, 60)}
          disabled={isBusy}
          className="flex-1 py-2 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] text-[#111813] rounded-xl text-[11px] font-bold transition active:scale-95 disabled:opacity-40 cursor-pointer"
        >
          +60d
        </button>
        <button
          type="button"
          onClick={() => onSetExpiry(shop)}
          disabled={isBusy}
          className="p-2 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] text-[#5A655D] hover:text-[#006241] rounded-xl transition active:scale-95 disabled:opacity-40 cursor-pointer"
          title="Set custom expiry date"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-xl transition active:scale-95 cursor-pointer"
          title="Send renewal reminder on WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Secondary actions */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onOpenFee(shop)}
          disabled={isBusy}
          className="flex-1 py-1.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] text-[#5A655D] hover:text-[#111813] rounded-lg text-[10px] font-bold transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
        >
          <DollarSign className="w-3 h-3" /> Fee
        </button>
        <button
          type="button"
          onClick={() => onOpenHistory(shop)}
          disabled={isBusy}
          className="flex-1 py-1.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] text-[#5A655D] hover:text-[#111813] rounded-lg text-[10px] font-bold transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1 cursor-pointer"
        >
          <History className="w-3 h-3" /> History
        </button>
        <button
          type="button"
          onClick={() => onToggleActive(shop)}
          disabled={isBusy}
          className={`p-1.5 rounded-lg border transition disabled:opacity-40 cursor-pointer ${
            shop.is_active !== false
              ? 'bg-[#E8F0E9] text-[#006241] border-[#C2D6C5] hover:bg-[#D5E5D7]'
              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
          }`}
          title={shop.is_active !== false ? 'Suspend store' : 'Reactivate store'}
        >
          <Power className="w-3.5 h-3.5" />
        </button>
        {!isMe && (
          <button
            type="button"
            onClick={() => onDelete(shop)}
            disabled={isBusy}
            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-[#E7EBE7] text-stone-400 hover:text-rose-600 transition disabled:opacity-40 cursor-pointer"
            title="Delete shop permanently"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function AdminPortal() {
  const [sellers, setSellers] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [updatingId, setUpdatingId] = useState(null);

  const [customDatePickerShop, setCustomDatePickerShop] = useState(null);
  const [customDate, setCustomDate] = useState('');

  const [historyShop, setHistoryShop] = useState(null);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [feeEditorShop, setFeeEditorShop] = useState(null);
  const [newFee, setNewFee] = useState('');

  const navigate = useNavigate();

  const loadAllShops = async () => {
    try {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const authUserId = sessionData?.session?.user?.id;

      if (!authUserId) {
        navigate('/login');
        return;
      }

      const meSeller = await fetchCurrentSeller(authUserId);

      if (!meSeller || !meSeller.is_super_admin) {
        notify('Access denied: Super-Admin authorization required.', 'error');
        navigate('/dashboard');
        return;
      }

      setMe(meSeller);
      const data = await fetchAllSellersAdmin();
      setSellers(data);
    } catch (err) {
      notify(err.message || 'Failed to load shops', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllShops();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Actions                                                          */
  /* ---------------------------------------------------------------- */
  const handleQuickExtend = async (shop, days) => {
    setUpdatingId(shop.id);
    try {
      const updated = await extendSubscription(shop.id, days);
      setSellers((prev) => prev.map((s) => (s.id === shop.id ? { ...s, ...updated } : s)));
      notify(`Extended ${shop.shop_name} by +${days} days.`);
    } catch (err) {
      notify('Extension failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCustomDateSubmit = async (e) => {
    e.preventDefault();
    if (!customDatePickerShop || !customDate) return;
    setUpdatingId(customDatePickerShop.id);
    try {
      const updated = await setCustomSubscriptionExpiry(customDatePickerShop.id, customDate);
      setSellers((prev) => prev.map((s) => (s.id === customDatePickerShop.id ? { ...s, ...updated } : s)));
      notify(`Expiry date updated for ${customDatePickerShop.shop_name}.`);
      setCustomDatePickerShop(null);
      setCustomDate('');
    } catch (err) {
      notify('Update failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenHistory = async (shop) => {
    setHistoryShop(shop);
    setHistoryLoading(true);
    try {
      const events = await fetchSubscriptionHistory(shop.id, 50);
      setHistoryEvents(events);
    } catch {
      setHistoryEvents([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenFeeEditor = (shop) => {
    setFeeEditorShop(shop);
    setNewFee(String(shop.monthly_fee ?? DEFAULT_FEE));
  };

  const handleFeeSave = async (e) => {
    e.preventDefault();
    if (!feeEditorShop) return;
    const parsed = parseInt(newFee, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      notify('Please enter a valid amount greater than 0.', 'error');
      return;
    }
    setUpdatingId(feeEditorShop.id);
    try {
      const updated = await updateSellerFee(feeEditorShop.id, parsed);
      setSellers((prev) => prev.map((s) => (s.id === feeEditorShop.id ? { ...s, ...updated } : s)));
      notify(`Fee updated to Rs. ${parsed.toLocaleString('en-LK')} for ${feeEditorShop.shop_name}.`);
      setFeeEditorShop(null);
      setNewFee('');
    } catch (err) {
      notify('Update failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (shop) => {
    const isSuspending = shop.is_active !== false;

    const ok = await confirm({
      title: isSuspending ? `Suspend "${shop.shop_name}"?` : `Reactivate "${shop.shop_name}"?`,
      message: isSuspending
        ? 'The storefront will go offline. Orders already placed will not be affected.'
        : 'The storefront will be brought back online immediately.',
      confirmLabel: isSuspending ? 'Suspend' : 'Reactivate',
      cancelLabel: 'Cancel',
      tone: isSuspending ? 'warning' : 'default',
    });
    if (!ok) return;

    setUpdatingId(shop.id);
    try {
      const updated = await toggleStoreActiveStatus(shop.id, shop.is_active !== false);
      setSellers((prev) => prev.map((s) => (s.id === shop.id ? { ...s, ...updated } : s)));
      notify(`Shop is now ${updated.is_active ? 'Active' : 'Suspended'}.`);
    } catch (err) {
      notify('Toggle failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteShop = async (shop) => {
    if (!me || shop.id === me.id) {
      notify('Cannot delete your own super-admin account.', 'error');
      return;
    }

    const ok = await confirm({
      title: `Permanently delete "${shop.shop_name}"?`,
      message: `Handle: /${shop.handle}\n\nAll products, orders, and customer data for this store will be wiped.\n\nThis CANNOT be undone.`,
      confirmLabel: 'Delete Forever',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;

    setUpdatingId(shop.id);
    try {
      await deleteSellerAdmin(shop.id);
      setSellers((prev) => prev.filter((s) => s.id !== shop.id));
      notify(`Deleted "${shop.shop_name}" successfully.`);
    } catch (err) {
      notify('Failed to delete shop: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Derived                                                          */
  /* ---------------------------------------------------------------- */
  // Super admins are not customers — hide them from the admin panel entirely.
  // They don't pay, they don't expire, and they shouldn't inflate MRR.
  const customerSellers = useMemo(
    () => sellers.filter((s) => !s.is_super_admin),
    [sellers]
  );

  const stats = useMemo(() => {
    const total = customerSellers.length;
    let active = 0;
    let expiringSoon = 0;
    let expired = 0;
    let suspended = 0;
    let mrr = 0;

    customerSellers.forEach((s) => {
      const isSuspended = s.is_active === false;
      const days = daysRemaining(s);
      const fee = Number(s.monthly_fee) || DEFAULT_FEE;

      if (isSuspended) {
        suspended += 1;
        return;
      }
      if (days < 0) {
        expired += 1;
        return;
      }
      if (days <= 7) expiringSoon += 1;
      active += 1;
      mrr += fee;
    });

    return { total, active, expiringSoon, expired, suspended, mrr };
  }, [customerSellers]);

  const needsAttention = useMemo(() => {
    return customerSellers
      .filter((s) => {
        if (s.is_active === false) return false;
        const days = daysRemaining(s);
        return days < 3; // expired OR <= 2 days left
      })
      .sort((a, b) => daysRemaining(a) - daysRemaining(b));
  }, [customerSellers]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customerSellers.filter((s) => {
      // Filter chip
      if (filter !== 'all') {
        const isSuspended = s.is_active === false;
        const days = daysRemaining(s);
        if (filter === 'active' && (isSuspended || days < 0)) return false;
        if (filter === 'expiring' && (isSuspended || days < 0 || days > 7)) return false;
        if (filter === 'expired' && (isSuspended || days >= 0)) return false;
        if (filter === 'suspended' && !isSuspended) return false;
      }
      // Search
      if (!q) return true;
      return (
        s.shop_name?.toLowerCase().includes(q) ||
        s.handle?.toLowerCase().includes(q) ||
        s.whatsapp_number?.includes(q) ||
        s.email?.toLowerCase().includes(q)
      );
    });
  }, [customerSellers, filter, search]);

  const FILTERS = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'active', label: 'Active', count: stats.active },
    { id: 'expiring', label: 'Expiring', count: stats.expiringSoon },
    { id: 'expired', label: 'Expired', count: stats.expired },
    { id: 'suspended', label: 'Suspended', count: stats.suspended },
  ];

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] font-sans pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5">

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#111813] text-white flex items-center justify-center font-black shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#25D366]" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black tracking-tight">Platform Operator</h1>
              <p className="text-[11px] text-[#5A655D] truncate">Super-Admin Console</p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-white hover:bg-stone-50 border border-[#E7EBE7] rounded-xl text-xs font-bold transition text-center shrink-0"
          >
            ← My Shop
          </Link>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#E7EBE7] rounded-[20px] p-3.5 space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5A655D]">Total Shops</span>
            <div className="text-2xl font-black text-[#111813]">{stats.total}</div>
            <span className="text-[10px] text-[#006241] font-bold">{stats.active} active</span>
          </div>

          <div className="bg-white border border-[#E7EBE7] rounded-[20px] p-3.5 space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5A655D]">Monthly Revenue</span>
            <div className="text-xl font-black text-[#006241] font-mono truncate">
              {formatLKR(stats.mrr)}
            </div>
            <span className="text-[10px] text-[#5A655D]">Recurring</span>
          </div>

          <div className={`border rounded-[20px] p-3.5 space-y-0.5 ${
            needsAttention.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#E7EBE7]'
          }`}>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5A655D]">Needs Attention</span>
            <div className={`text-2xl font-black ${needsAttention.length > 0 ? 'text-amber-700' : 'text-[#111813]'}`}>
              {needsAttention.length}
            </div>
            <span className="text-[10px] text-[#5A655D]">Expired or expiring</span>
          </div>

          <div className="bg-white border border-[#E7EBE7] rounded-[20px] p-3.5 space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#5A655D]">Suspended</span>
            <div className="text-2xl font-black text-[#111813]">{stats.suspended}</div>
            <span className="text-[10px] text-[#5A655D]">Manual holds</span>
          </div>
        </div>

        {/* Needs attention banner */}
        {needsAttention.length > 0 && (
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-[20px] p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="font-black text-xs text-amber-900">
                {needsAttention.length} shop{needsAttention.length === 1 ? '' : 's'} need renewal
              </div>
            </div>

            <div className="space-y-2">
              {needsAttention.slice(0, 5).map((shop) => {
                const days = daysRemaining(shop);
                const waLink = `https://wa.me/${
                  (shop.whatsapp_number || '').replace(/[^0-9]/g, '').replace(/^0/, '94')
                }?text=${encodeURIComponent(RENEWAL_TEMPLATE(shop))}`;
                return (
                  <div
                    key={shop.id}
                    className="bg-white/80 backdrop-blur-sm rounded-xl p-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-xs text-[#111813] truncate">
                        {shop.shop_name}
                      </div>
                      <div className="text-[10px] text-amber-800">
                        {days < 0
                          ? `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
                          : days === 0
                          ? 'Expires today'
                          : `Expires in ${days} day${days === 1 ? '' : 's'}`}
                      </div>
                    </div>
                    <a
                      href={waLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white rounded-lg text-[10px] font-bold transition active:scale-95 flex items-center gap-1 shrink-0"
                    >
                      <MessageCircle className="w-3 h-3" /> Remind
                    </a>
                  </div>
                );
              })}
              {needsAttention.length > 5 && (
                <div className="text-[10px] text-amber-800 text-center pt-1">
                  + {needsAttention.length - 5} more below
                </div>
              )}
            </div>
          </div>
        )}

        {/* Filter + Search */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
            {FILTERS.map((f) => {
              const isActive = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold whitespace-nowrap transition border cursor-pointer ${
                    isActive
                      ? 'bg-[#18181B] text-white border-[#18181B]'
                      : 'bg-white text-[#52525B] border-[#E7EBE7] hover:border-stone-400'
                  }`}
                >
                  <span>{f.label}</span>
                  <span className={`min-w-[18px] px-1.5 h-[16px] inline-flex items-center justify-center rounded-full text-[9px] ${
                    isActive ? 'bg-white/20 text-white' : 'bg-[#F4F6F4] text-stone-600'
                  }`}>
                    {f.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search shop, phone, handle, or email…"
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-[#E7EBE7] focus:border-[#006241] rounded-xl text-xs outline-none font-medium transition"
            />
          </div>
        </div>

        {/* Shop list */}
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#E7EBE7] rounded-[20px] p-10 text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#F4F6F4] flex items-center justify-center mx-auto">
              <Store className="w-5 h-5 text-stone-400" />
            </div>
            <p className="font-bold text-xs text-[#18181B]">
              {search ? 'No matches found' : filter === 'all' ? 'No shops yet' : `No ${filter} shops`}
            </p>
            <p className="text-[11px] text-[#71717A]">
              {search ? 'Try a different keyword.' : 'Shops will appear here as sellers sign up.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((shop) => (
              <ShopCard
                key={shop.id}
                shop={shop}
                me={me}
                isBusy={updatingId === shop.id}
                onExtend={handleQuickExtend}
                onSetExpiry={(s) => {
                  setCustomDatePickerShop(s);
                  setCustomDate(
                    s.subscription_expires_at
                      ? new Date(s.subscription_expires_at).toISOString().split('T')[0]
                      : ''
                  );
                }}
                onOpenFee={handleOpenFeeEditor}
                onOpenHistory={handleOpenHistory}
                onToggleActive={handleToggleActive}
                onDelete={handleDeleteShop}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fee Editor Modal */}
      {feeEditorShop && (
        <div className="fixed inset-0 bg-[#111813]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] p-6 max-w-xs w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#E8F0E9] flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-[#006241]" />
                </div>
                <h3 className="font-extrabold text-sm">Monthly Fee</h3>
              </div>
              <button
                onClick={() => { setFeeEditorShop(null); setNewFee(''); }}
                className="text-stone-400 hover:text-black transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[#5A655D]">
              Shop: <strong>{feeEditorShop.shop_name}</strong>
            </p>

            <form onSubmit={handleFeeSave} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Amount per 30 days (Rs.)</label>
                <input
                  type="number"
                  min="1"
                  value={newFee}
                  onChange={(e) => setNewFee(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-bold font-mono text-base outline-none transition"
                />
                <p className="text-[10px] text-[#5A655D] mt-1.5 leading-relaxed">
                  Default is Rs. 2,990. Use this to give discounts to friends or early clients.
                </p>
              </div>

              <button
                type="submit"
                disabled={updatingId === feeEditorShop.id}
                className="w-full py-2.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
              >
                {updatingId === feeEditorShop.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Save Fee'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyShop && (
        <div className="fixed inset-0 bg-[#111813]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] max-w-lg w-full shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center p-5 pb-3 border-b border-[#E7EBE7] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#F4F6F4] flex items-center justify-center">
                  <History className="w-4 h-4 text-[#006241]" />
                </div>
                <div>
                  <h3 className="font-black text-sm">Subscription History</h3>
                  <p className="text-[11px] text-[#5A655D] truncate">
                    {historyShop.shop_name} · /{historyShop.handle}
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setHistoryShop(null); setHistoryEvents([]); }}
                className="p-1.5 -m-1.5 text-stone-400 hover:text-black transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-2">
              {historyLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="w-5 h-5 text-[#006241] animate-spin" />
                </div>
              ) : historyEvents.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#71717A]">
                  No subscription events recorded yet.
                </div>
              ) : (
                historyEvents.map((ev) => {
                  const date = new Date(ev.created_at);
                  const dateStr = date.toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  });
                  const timeStr = date.toLocaleTimeString('en-GB', {
                    hour: '2-digit', minute: '2-digit',
                  });

                  let title = ev.event_type;
                  let detail = '';
                  if (ev.event_type === 'signup') {
                    title = 'Initial signup';
                    detail = `Trial started · ${ev.days_added || 14} days`;
                  } else if (ev.event_type === 'extend') {
                    title = `Extended +${ev.days_added} days`;
                    detail = ev.new_expiry
                      ? `New expiry: ${new Date(ev.new_expiry).toLocaleDateString('en-GB')}`
                      : '';
                  } else if (ev.event_type === 'set_expiry') {
                    title = 'Expiry date changed';
                    detail = ev.new_expiry
                      ? `New expiry: ${new Date(ev.new_expiry).toLocaleDateString('en-GB')}`
                      : '';
                  } else if (ev.event_type === 'suspend') {
                    title = 'Store suspended';
                    detail = 'Manually suspended by admin';
                  } else if (ev.event_type === 'reactivate') {
                    title = 'Store reactivated';
                    detail = 'Manually reactivated by admin';
                  } else if (ev.event_type === 'fee_change') {
                    title = 'Monthly fee changed';
                    detail = ev.notes || '';
                  }

                  return (
                    <div key={ev.id} className="border border-[#E7EBE7] rounded-2xl p-3.5 space-y-1.5 bg-white">
                      <div className="flex justify-between items-start gap-3">
                        <div className="font-black text-xs text-[#111813]">{title}</div>
                        <div className="text-[10px] text-stone-400 font-mono shrink-0">
                          {dateStr} · {timeStr}
                        </div>
                      </div>
                      {detail && (
                        <div className="text-[11px] text-[#5A655D]">{detail}</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Custom Expiry Date Picker Modal */}
      {customDatePickerShop && (
        <div className="fixed inset-0 bg-[#111813]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] p-6 max-w-xs w-full shadow-2xl space-y-3 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-extrabold text-sm">Set Expiry Date</h3>
              <button onClick={() => setCustomDatePickerShop(null)} className="text-stone-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#5A655D]">Shop: <strong>{customDatePickerShop.shop_name}</strong></p>
            <form onSubmit={handleCustomDateSubmit} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">New Expiration Date</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={updatingId === customDatePickerShop.id}
                className="w-full py-2.5 bg-[#006241] text-white font-bold rounded-xl active:scale-95 cursor-pointer"
              >
                Save Expiration
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}