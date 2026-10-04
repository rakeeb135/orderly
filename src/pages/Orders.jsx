import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Search, Printer, CheckCircle2, Truck, Package, MessageCircle,
  Loader2, Plus, Check, CheckSquare, Square, X, ChevronRight,
  ArrowRight, Trash2, Landmark, PackageCheck, AlertCircle,
  AlertTriangle, RefreshCw, Share2,
} from 'lucide-react';
import {
  updateOrderStatus,
  bulkUpdateOrderStatus,
  deleteOrdersBatch,
  getBulkBuyerTrust,
  fetchOrdersPage,
  getOrderCounts,
  getDashboardSummary,
  formatLKR,
} from '../services/dbService';
import { supabase } from '../supabase';
import PrintManifestModal from '../components/PrintManifestModal';
import { notify } from '../components/Toast';
import { confirm } from '../components/ConfirmModal';
import { normalizeSLPhone } from '../utils/phone';

const PAGE_SIZE = 50;

const PIPELINE_TABS = [
  { id: 'todo',     label: 'To Do' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'history',  label: 'History' },
];

const SRI_LANKAN_COURIERS = [
  'Koombiyo Delivery', 'Domex', 'Pronto Lanka', 'Prompt X',
  'Fardar Express', 'Certis Lanka', 'Courier.lk', 'Other / In-House Rider',
];

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 45) return 'just now';
  if (diff < 60 * 60) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 60 * 60 * 24) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 60 * 60 * 48) return 'yesterday';
  if (diff < 60 * 60 * 24 * 7) return `${Math.floor(diff / (3600 * 24))}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function isRecent(iso) {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  return Date.now() - then < 5 * 60 * 1000;
}

function statusStripe(ord) {
  if (ord.status === 'canceled') return 'bg-stone-300';
  if (ord.status === 'delivered') return 'bg-[#006241]';
  if (ord.status === 'dispatched') return 'bg-purple-500';
  if (ord.status === 'packed') return 'bg-blue-500';
  const isCOD = !ord.payment_method || ord.payment_method === 'COD';
  const isBank = ord.payment_method === 'Bank';
  const awaitingBankPay = isBank && ord.payment_status === 'Awaiting Payment';
  const unverifiedCOD = isCOD && !ord.buyer_confirmed;
  if (awaitingBankPay || unverifiedCOD) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function getStatusMeta(ord) {
  if (ord.status === 'canceled') return { label: 'Returned', dot: 'bg-stone-400', text: 'text-stone-500' };
  if (ord.status === 'delivered') return { label: 'Delivered', dot: 'bg-[#006241]', text: 'text-[#006241]' };
  if (ord.status === 'dispatched') return { label: 'On the Way', dot: 'bg-purple-500', text: 'text-purple-600' };
  if (ord.status === 'packed') return { label: 'Packed', dot: 'bg-blue-500', text: 'text-blue-600' };
  const isCOD = !ord.payment_method || ord.payment_method === 'COD';
  const isBank = ord.payment_method === 'Bank';
  const awaitingBankPay = isBank && ord.payment_status === 'Awaiting Payment';
  const unverifiedCOD = isCOD && !ord.buyer_confirmed;
  if (awaitingBankPay) return { label: 'Awaiting Payment', dot: 'bg-amber-500', text: 'text-amber-700', pulse: true, icon: 'bank' };
  if (unverifiedCOD) return { label: 'Unverified', dot: 'bg-amber-500', text: 'text-amber-700', pulse: true, icon: 'whatsapp' };
  return { label: 'Ready to Pack', dot: 'bg-emerald-500', text: 'text-emerald-700' };
}

function isEligibleForPack(ord) {
  if (ord.status !== 'received') return false;
  const isCOD = !ord.payment_method || ord.payment_method === 'COD';
  const isBank = ord.payment_method === 'Bank';
  const isPaid = ord.payment_status === 'Paid';
  if (isCOD) return Boolean(ord.buyer_confirmed);
  if (isBank) return isPaid;
  return false;
}

/* Persistent section divider. Shows count always. Optional empty message below. */
function SectionDivider({ tone, label, count }) {
  const toneStyle = {
    waiting: { bar: 'bg-amber-400', text: 'text-amber-700' },
    ready:   { bar: 'bg-[#006241]', text: 'text-[#006241]' },
    packed:  { bar: 'bg-blue-500',  text: 'text-blue-700' },
    transit: { bar: 'bg-purple-500', text: 'text-purple-700' },
  }[tone] || { bar: 'bg-stone-300', text: 'text-stone-500' };

  return (
    <div className="flex items-center gap-2 pt-2 pb-0.5 select-none">
      <span className={`w-1 h-3.5 rounded-full ${toneStyle.bar}`} />
      <span className={`text-[11px] font-black uppercase tracking-wider ${toneStyle.text}`}>
        {label}
      </span>
      <span className="text-[11px] font-bold text-stone-400">{count}</span>
      <span className="flex-1 h-px bg-[#E7EBE7]" />
    </div>
  );
}

function SectionEmptyText({ children }) {
  return (
    <div className="text-[11px] text-stone-400 px-1 -mt-1 pb-1 leading-snug">
      {children}
    </div>
  );
}

function ErrorCard({ message, onRetry, label = 'orders' }) {
  return (
    <div className="bg-white border border-rose-200 rounded-[24px] p-8 text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto">
        <AlertCircle className="w-5 h-5 text-rose-600" />
      </div>
      <div className="space-y-1">
        <p className="font-black text-sm text-[#111813]">Couldn't load {label}</p>
        <p className="text-xs text-[#5A655D] max-w-xs mx-auto leading-relaxed">
          {message || 'Please check your connection and try again.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 bg-[#111813] hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );
}

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export default function Orders({ seller, onOpenPOS: propOnOpenPOS }) {
  const navigate = useNavigate();
  const outletContext = useOutletContext() || {};
  const onOpenPOS = propOnOpenPOS || outletContext.onOpenPOS;
  const setHideFAB = outletContext.setHideFAB;

  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ active: 0, received: 0, packed: 0, dispatched: 0, delivered: 0, canceled: 0 });
  const [todaySales, setTodaySales] = useState(0);
  const [todayOrderCount, setTodayOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState('todo');
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('phone') || '';
    } catch {
      return '';
    }
  });
  const debouncedSearch = useDebounced(searchQuery, 300);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkPacking, setBulkPacking] = useState(false);

  const [dispatchOrderTarget, setDispatchOrderTarget] = useState(null);
  const [selectedCourier, setSelectedCourier] = useState(() => {
    try {
      return localStorage.getItem(`ordy_last_courier_${seller?.id}`) || SRI_LANKAN_COURIERS[0];
    } catch {
      return SRI_LANKAN_COURIERS[0];
    }
  });
  const [trackingNumber, setTrackingNumber] = useState('');

  const [trustMap, setTrustMap] = useState({});
  const [trustPopover, setTrustPopover] = useState(null);

  const tabRef = useRef(activeTab);
  const searchRef = useRef(debouncedSearch);
  const countsTimerRef = useRef(null);
  useEffect(() => { tabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);

  useEffect(() => {
    if (typeof setHideFAB === 'function') setHideFAB(isSelectionMode);
    return () => {
      if (typeof setHideFAB === 'function') setHideFAB(false);
    };
  }, [isSelectionMode, setHideFAB]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const loadFirstPage = useCallback(async () => {
    if (!seller?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [page, countsData, summaryData] = await Promise.all([
        fetchOrdersPage(seller.id, { tab: activeTab, search: debouncedSearch, limit: PAGE_SIZE, offset: 0 }),
        getOrderCounts(seller.id, debouncedSearch),
        getDashboardSummary(seller.id, 'today'),
      ]);
      setOrders(page.orders);
      setTotalCount(page.total);
      setCounts(countsData);
      setTodaySales(summaryData?.total_sales || 0);
      setTodayOrderCount(summaryData?.order_count || 0);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setLoadError(err?.message || 'Network error');
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [seller?.id, activeTab, debouncedSearch]);

  useEffect(() => { loadFirstPage(); }, [loadFirstPage]);

  useEffect(() => { setSelectedOrderIds([]); }, [activeTab, debouncedSearch]);

  const hasMore = orders.length < totalCount;

  const handleLoadMore = async () => {
    if (!seller?.id || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchOrdersPage(seller.id, { tab: activeTab, search: debouncedSearch, limit: PAGE_SIZE, offset: orders.length });
      setOrders((prev) => {
        const existingIds = new Set(prev.map((o) => o.id));
        const fresh = page.orders.filter((o) => !existingIds.has(o.id));
        return [...prev, ...fresh];
      });
      setTotalCount(page.total);
    } catch (err) {
      notify('Failed to load more: ' + err.message, 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  const trustPhoneKey = useMemo(() => {
    if (!orders.length) return '';
    const set = new Set();
    orders.forEach((o) => { if (o.customer_phone) set.add(o.customer_phone); });
    return Array.from(set).sort().join('|');
  }, [orders]);

  useEffect(() => {
    if (!trustPhoneKey) { setTrustMap({}); return; }
    const phones = trustPhoneKey.split('|');
    let mounted = true;
    getBulkBuyerTrust(phones)
      .then((map) => { if (mounted) setTrustMap(map || {}); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [trustPhoneKey]);

  useEffect(() => {
    if (!seller?.id) return;
    let isMounted = true;
    const channelName = `orders-rt-${seller.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${seller.id}` }, (payload) => {
        if (!isMounted) return;
        const { eventType, new: newRow, old: oldRow } = payload;
        const currentTab = tabRef.current;
        const currentSearch = (searchRef.current || '').toLowerCase();

        if (countsTimerRef.current) clearTimeout(countsTimerRef.current);
        countsTimerRef.current = setTimeout(() => {
          if (!isMounted) return;
          Promise.all([
            getOrderCounts(seller.id, searchRef.current || ''),
            getDashboardSummary(seller.id, 'today'),
          ]).then(([c, s]) => {
            if (!isMounted) return;
            setCounts(c);
            setTodaySales(s?.total_sales || 0);
            setTodayOrderCount(s?.order_count || 0);
          }).catch(() => {});
        }, 500);

        const matchesTab = (row) => {
          if (currentTab === 'todo')     return row.status === 'received';
          if (currentTab === 'shipping') return row.status === 'packed' || row.status === 'dispatched';
          if (currentTab === 'history')  return row.status === 'delivered' || row.status === 'canceled';
          return false;
        };

        const matchesSearch = (row) => !currentSearch ||
          row.order_code?.toLowerCase().includes(currentSearch) ||
          row.customer_name?.toLowerCase().includes(currentSearch) ||
          row.customer_phone?.includes(currentSearch) ||
          row.city?.toLowerCase().includes(currentSearch) ||
          row.district?.toLowerCase().includes(currentSearch);

        if (eventType === 'INSERT' && newRow?.id) {
          if (matchesTab(newRow) && matchesSearch(newRow)) {
            setOrders((prev) => prev.some((o) => o.id === newRow.id) ? prev : [newRow, ...prev]);
            setTotalCount((t) => t + 1);
          }
          if (newRow.source !== 'manual_pos') {
            notify(`New order #${newRow.order_code || newRow.id.slice(0, 4)} received!`);
          }
        } else if (eventType === 'UPDATE' && newRow?.id) {
          setOrders((prev) => {
            const inList = prev.some((o) => o.id === newRow.id);
            const stillMatches = matchesTab(newRow) && matchesSearch(newRow);
            if (inList && !stillMatches) return prev.filter((o) => o.id !== newRow.id);
            if (!inList && stillMatches) return [newRow, ...prev];
            if (inList) return prev.map((o) => (o.id === newRow.id ? { ...o, ...newRow } : o));
            return prev;
          });
        } else if (eventType === 'DELETE' && oldRow?.id) {
          setOrders((prev) => prev.filter((o) => o.id !== oldRow.id));
          setTotalCount((t) => Math.max(0, t - 1));
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      if (countsTimerRef.current) clearTimeout(countsTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [seller?.id]);

  const handleNewOrderClick = () => {
    if (typeof onOpenPOS === 'function') onOpenPOS();
    else notify('POS Modal trigger unavailable', 'error');
  };

  const handleShareStoreLink = async () => {
    if (!seller?.handle) return;
    const url = `${window.location.origin}/${seller.handle}`;
    try {
      await navigator.clipboard.writeText(url);
      notify('Store link copied!');
    } catch {
      window.prompt('Copy your store link:', url);
    }
  };

  const applyStatusChange = async (orderId, nextStatus, options = {}) => {
    const snapshot = orders.find((o) => o.id === orderId);
    if (!snapshot) return;
    const prevStatus = snapshot.status;

    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));
    setActionLoadingId(orderId);

    try {
      const updated = await updateOrderStatus(orderId, nextStatus, options.extra || {});
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      if (options.toastMessage) {
        notify(options.toastMessage, 'success', options.enableUndo ? {
          undo: async () => {
            try {
              const reverted = await updateOrderStatus(orderId, prevStatus);
              setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...reverted } : o)));
              notify('Reverted.');
            } catch (err) { notify('Failed to undo: ' + err.message, 'error'); }
          },
          undoLabel: 'Undo',
        } : undefined);
      }
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? snapshot : o)));
      notify('Failed to update: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleInlinePack = (orderId, e) => {
    if (e) e.stopPropagation();
    applyStatusChange(orderId, 'packed', { toastMessage: 'Order marked as packed.', enableUndo: true });
  };

  const handleBulkPack = async () => {
    const eligibleSelected = orders.filter((o) => selectedOrderIds.includes(o.id) && isEligibleForPack(o));
    if (!eligibleSelected.length) {
      notify('No eligible orders in selection — verify buyer or confirm payment first.', 'error');
      return;
    }
    const eligibleIds = eligibleSelected.map((o) => o.id);
    const snapshots = eligibleSelected.map((o) => ({ id: o.id, status: o.status }));

    setOrders((prev) => prev.map((o) => eligibleIds.includes(o.id) ? { ...o, status: 'packed' } : o));
    setBulkPacking(true);

    try {
      const { updatedOrders, skipped } = await bulkUpdateOrderStatus(selectedOrderIds, 'packed');
      setOrders((prev) => prev.map((o) => {
        const upd = updatedOrders.find((u) => u.id === o.id);
        return upd ? { ...o, ...upd } : o;
      }));
      const updatedCount = updatedOrders.length;
      const message = skipped > 0
        ? `${updatedCount} packed, ${skipped} skipped.`
        : `${updatedCount} order${updatedCount === 1 ? '' : 's'} packed.`;
      notify(message, 'success', {
        undo: async () => {
          try {
            const ids = updatedOrders.map((u) => u.id);
            for (const id of ids) {
              const snap = snapshots.find((s) => s.id === id);
              if (snap) await updateOrderStatus(id, snap.status);
            }
            setOrders((prev) => prev.map((o) => {
              const snap = snapshots.find((s) => s.id === o.id);
              return snap ? { ...o, status: snap.status } : o;
            }));
            notify('Reverted.');
          } catch (err) { notify('Failed to undo: ' + err.message, 'error'); }
        },
        undoLabel: 'Undo',
      });
      cancelSelectionMode();
    } catch (err) {
      setOrders((prev) => prev.map((o) => {
        const snap = snapshots.find((s) => s.id === o.id);
        return snap ? { ...o, status: snap.status } : o;
      }));
      notify('Bulk pack failed: ' + err.message, 'error');
    } finally {
      setBulkPacking(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchOrderTarget) return;
    const target = dispatchOrderTarget;
    const snapshot = orders.find((o) => o.id === target.id);
    if (!snapshot) return;

    try { localStorage.setItem(`ordy_last_courier_${seller?.id}`, selectedCourier); } catch { /* ignore */ }

    setOrders((prev) => prev.map((o) => o.id === target.id ? {
      ...o,
      status: 'dispatched',
      courier_name: selectedCourier,
      tracking_number: trackingNumber.trim() || o.tracking_number,
      dispatched_at: new Date().toISOString(),
    } : o));
    setActionLoadingId(target.id);

    try {
      const updated = await updateOrderStatus(target.id, 'dispatched', {
        courierName: selectedCourier,
        trackingNumber: trackingNumber.trim(),
      });
      setOrders((prev) => prev.map((o) => (o.id === target.id ? { ...o, ...updated } : o)));
      notify('Order dispatched with tracking details!');
      setDispatchOrderTarget(null);
      setTrackingNumber('');
    } catch (err) {
      setOrders((prev) => prev.map((o) => (o.id === target.id ? snapshot : o)));
      notify('Failed to dispatch: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedOrderIds.length) return;
    const ok = await confirm({
      title: `Delete ${selectedOrderIds.length} order${selectedOrderIds.length === 1 ? '' : 's'}?`,
      message: 'Stock items will be returned to your inventory.\nThis action cannot be undone.',
      confirmLabel: 'Delete', cancelLabel: 'Keep', tone: 'danger',
    });
    if (!ok) return;

    const snapshots = orders.filter((o) => selectedOrderIds.includes(o.id));
    setDeleting(true);
    try {
      await deleteOrdersBatch(selectedOrderIds);
      setOrders((prev) => prev.filter((o) => !selectedOrderIds.includes(o.id)));
      setTotalCount((t) => Math.max(0, t - selectedOrderIds.length));
      notify(`Successfully deleted ${selectedOrderIds.length} order(s).`);
      cancelSelectionMode();
    } catch (err) {
      setOrders((prev) => {
        const map = new Map(prev.map((o) => [o.id, o]));
        snapshots.forEach((s) => map.set(s.id, s));
        return Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      });
      notify('Delete failed: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const copyOrderCode = async (code, e) => {
    if (e) e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      notify(`Copied ${code}`);
    } catch { window.prompt('Copy order reference:', code); }
  };

  const toggleSelectOrder = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedOrderIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleSelectAllToggle = () => {
    if (selectedOrderIds.length === orders.length) setSelectedOrderIds([]);
    else setSelectedOrderIds(orders.map((o) => o.id));
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedOrderIds([]);
  };

  const selectedOrdersData = useMemo(() => orders.filter((o) => selectedOrderIds.includes(o.id)), [orders, selectedOrderIds]);
  const packableCount = useMemo(() => orders.filter((o) => selectedOrderIds.includes(o.id) && isEligibleForPack(o)).length, [orders, selectedOrderIds]);

  const tabCounts = useMemo(() => ({
    todo: counts.received || 0,
    shipping: (counts.packed || 0) + (counts.dispatched || 0),
    history: 0,
  }), [counts]);

  const totalEver = (counts.received || 0) + (counts.packed || 0) + (counts.dispatched || 0) + (counts.delivered || 0) + (counts.canceled || 0);

  const renderOrderCard = (ord) => {
    const isSelected = selectedOrderIds.includes(ord.id);
    const cleanPhone = ord.customer_phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
    const items = Array.isArray(ord.items) ? ord.items : [];
    const isCanceled = ord.status === 'canceled';
    const isBusy = actionLoadingId === ord.id;
    const isCOD = !ord.payment_method || ord.payment_method === 'COD';
    const packable = isEligibleForPack(ord);
    const visibleItems = items.slice(0, 2);
    const extraItems = items.length - visibleItems.length;
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
    const trackingUrl = `${window.location.origin}/order/${ord.id}?t=${ord.verification_token}`;
    const verifyMsg = `Hi ${ord.customer_name}! Please tap to confirm your order #${ord.order_code || ord.id.slice(0, 4)} from ${seller?.shop_name}: ${trackingUrl}`;
    const cleanPhoneNorm = normalizeSLPhone(ord.customer_phone || '');
    const trust = trustMap[cleanPhoneNorm];
    const isFlagged = trust && trust.total_flags > 0;
    const isHighRisk = isFlagged && (trust.total_flags >= 3 || (trust.total_flags >= 2 && trust.distinct_sellers >= 2));
    const status = getStatusMeta(ord);
    const location = ord.district || ord.city || '';
    const needsVerify = isCOD && !ord.buyer_confirmed && ord.status === 'received';
    const needsBankCheck = !isCOD && ord.payment_status === 'Awaiting Payment' && ord.status === 'received';
    const orderCode = ord.order_code || ord.id.slice(0, 4);
    const isFresh = isRecent(ord.created_at);

    return (
      <div
        key={ord.id}
        onClick={() => { if (isSelectionMode) toggleSelectOrder(ord.id); else navigate(`/orders/${ord.id}`); }}
        className={`group relative bg-white border rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden ${
          isSelected
            ? 'border-[#006241] ring-2 ring-[#006241]/15 bg-[#F0FDF4]/40 shadow-sm'
            : isCanceled
            ? 'border-[#E7EBE7] bg-stone-50/60 opacity-70'
            : 'border-[#E7EBE7] hover:border-stone-300 hover:shadow-md hover:shadow-stone-200/40'
        }`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusStripe(ord)} ${isCanceled ? 'opacity-40' : ''}`} />
        <div className="p-3.5 pl-4 flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            {isSelectionMode && (
              <button type="button" onClick={(e) => toggleSelectOrder(ord.id, e)} className="shrink-0 mt-0.5 cursor-pointer" aria-label={isSelected ? 'Deselect order' : 'Select order'}>
                {isSelected ? <CheckSquare className="w-5 h-5 text-[#006241]" /> : <Square className="w-5 h-5 text-stone-300 hover:text-stone-500 transition" />}
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {isFresh && !isCanceled && (
                  <span className="relative flex w-2 h-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#006241] opacity-60 animate-ping" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#006241]" />
                  </span>
                )}
                <button type="button" onClick={(e) => copyOrderCode(`#${orderCode}`, e)} className={`font-mono font-black text-sm ${isCanceled ? 'text-stone-400 line-through' : 'text-[#111813]'} hover:text-[#006241] transition flex items-center gap-1 cursor-pointer`} title="Tap to copy reference">
                  #{orderCode}
                </button>
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold ${status.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot} ${status.pulse ? 'animate-pulse' : ''}`} />
                  {status.icon === 'bank' && <Landmark className="w-3 h-3" />}
                  {status.icon === 'whatsapp' && <MessageCircle className="w-3 h-3" />}
                  {status.label}
                </span>
                {isFlagged && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setTrustPopover({ phone: cleanPhoneNorm, data: trust, highRisk: isHighRisk, anchor: e.currentTarget.getBoundingClientRect() }); }} className={`inline-flex items-center gap-0.5 cursor-pointer ${isHighRisk ? 'text-rose-600' : 'text-amber-600'}`} title="Tap for details">
                    <AlertTriangle className="w-3.5 h-3.5" />
                  </button>
                )}
                <span className="text-[11px] text-stone-400 font-medium ml-auto">{relativeTime(ord.created_at)}</span>
              </div>
              <div className="text-sm mt-1 truncate">
                <span className={`font-semibold ${isCanceled ? 'text-stone-400' : 'text-[#111813]'}`}>{ord.customer_name}</span>
                {ord.customer_phone && <span className="text-xs font-mono text-stone-400 ml-1.5">{ord.customer_phone}</span>}
              </div>
              <div className="text-xs text-[#5A655D] mt-1 flex items-center gap-1.5 flex-wrap">
                <Package className="w-3 h-3 text-stone-400 shrink-0" />
                {visibleItems.map((item, i) => (
                  <React.Fragment key={i}>
                    <span className="truncate max-w-[160px]">{item.title}</span>
                    <span className="text-stone-400">×{item.quantity || 1}</span>
                    {i < visibleItems.length - 1 && <span className="text-stone-300">·</span>}
                  </React.Fragment>
                ))}
                {extraItems > 0 && <span className="text-[#006241] font-bold">+{extraItems}</span>}
                {items.length === 1 && totalQty > 1 && <span className="text-stone-400">({totalQty} items)</span>}
                {location && (<><span className="text-stone-300">·</span><span className="text-stone-400">{location}</span></>)}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[#E7EBE7] sm:border-t-0 sm:pt-0 sm:pl-4">
            <div className={`text-sm font-black ${isCanceled ? 'text-stone-400 line-through' : 'text-[#111813]'}`}>
              {formatLKR(ord.total_amount)}
              <span className={`ml-2 text-[10px] font-bold uppercase tracking-wider ${isCOD ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isCOD ? 'COD' : 'Bank'}
              </span>
            </div>
            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {needsVerify && !isSelectionMode && (
                <a href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(verifyMsg)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <MessageCircle className="w-3.5 h-3.5" /> Verify
                </a>
              )}
              {needsBankCheck && !isSelectionMode && (
                <button type="button" onClick={(e) => { e.stopPropagation(); navigate(`/orders/${ord.id}`); }} className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-xs">
                  <Landmark className="w-3.5 h-3.5" /> Confirm
                </button>
              )}
              {ord.status === 'received' && packable && !isSelectionMode && (
                <button type="button" disabled={isBusy} onClick={(e) => handleInlinePack(ord.id, e)} className="px-3 py-1.5 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer">
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Pack <ArrowRight className="w-3 h-3" /></>}
                </button>
              )}
              {ord.status === 'packed' && !isSelectionMode && (
                <button type="button" disabled={isBusy} onClick={(e) => { e.stopPropagation(); setDispatchOrderTarget(ord); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer">
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Dispatch <Truck className="w-3.5 h-3" /></>}
                </button>
              )}
              {!isSelectionMode && <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#111813] group-hover:translate-x-0.5 transition" />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* Always return all sections for structural tabs. Empty ones render placeholder text. */
  const sections = useMemo(() => {
    if (activeTab === 'todo') {
      const waiting = orders.filter((o) => !isEligibleForPack(o));
      const ready = orders.filter((o) => isEligibleForPack(o));
      return [
        { id: 'waiting', tone: 'waiting', label: 'Needs action', items: waiting, emptyText: 'Nothing waiting for verification right now.' },
        { id: 'ready',   tone: 'ready',   label: 'Ready to pack', items: ready, emptyText: 'No verified orders waiting to be packed.' },
      ];
    }
    if (activeTab === 'shipping') {
      const packed = orders.filter((o) => o.status === 'packed');
      const dispatched = orders.filter((o) => o.status === 'dispatched');
      return [
        { id: 'packed',     tone: 'packed',  label: 'Ready to dispatch', items: packed, emptyText: 'No packed orders waiting for courier pickup.' },
        { id: 'dispatched', tone: 'transit', label: 'On the way', items: dispatched, emptyText: 'No orders in transit right now.' },
      ];
    }
    return null;
  }, [orders, activeTab]);

  const isSearching = Boolean(debouncedSearch.trim());

  return (
    <div className="space-y-4 pb-32 text-[#111813] max-w-5xl mx-auto">
      {/* Context strip — sales only, no duplicate action count */}
      <div className="px-1 pt-1">
        <h1 className="text-xl font-black tracking-tight text-[#111813]">
          {greeting}, {seller?.shop_name || 'there'}
        </h1>
        <p className="text-xs text-[#5A655D] mt-1">
          {todayOrderCount === 0 ? (
            <span>No orders today</span>
          ) : todayOrderCount === 1 ? (
            <><span className="font-bold text-[#111813]">{formatLKR(todaySales)}</span> from 1 order today</>
          ) : (
            <><span className="font-bold text-[#111813]">{formatLKR(todaySales)}</span> from {todayOrderCount} orders today</>
          )}
          {searchQuery && /^\d{9,10}$/.test(searchQuery) && (
            <>
              <span className="text-stone-300 mx-1.5">·</span>
              <span className="text-[#006241] font-bold">Filtered by customer</span>
              <button type="button" onClick={() => setSearchQuery('')} className="ml-1.5 text-[#5A655D] hover:text-[#111813] underline underline-offset-2 cursor-pointer">Clear</button>
            </>
          )}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search orders…" className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#E7EBE7] focus:border-[#006241] rounded-xl text-sm outline-none font-medium transition placeholder:text-stone-400" />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-[#111813] hover:bg-stone-100 transition cursor-pointer" aria-label="Clear search">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {!isSelectionMode && orders.length > 0 && (
          <button type="button" onClick={() => setIsSelectionMode(true)} className="px-3.5 py-2.5 bg-white border border-[#E7EBE7] hover:border-[#006241] text-[#111813] rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer">
            <CheckSquare className="w-3.5 h-3.5 text-[#006241]" /> Select
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-1.5 bg-white border border-[#E7EBE7] rounded-2xl p-1">
        {PIPELINE_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = tabCounts[tab.id] || 0;
          return (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedOrderIds([]); }} className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${isActive ? 'bg-[#18181B] text-white shadow-sm' : 'text-[#52525B] hover:bg-stone-50'}`}>
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-[#F4F6F4] text-stone-600'}`}>
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {orders.length > 0 && isSelectionMode && (
        <div className="flex items-center justify-between bg-white border border-[#E7EBE7] rounded-2xl px-4 py-2.5 text-xs">
          <div className="text-[#5A655D] font-medium"><span className="font-bold text-[#111813]">{selectedOrderIds.length}</span> selected</div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={handleSelectAllToggle} className="font-bold text-[#006241] hover:underline cursor-pointer">
              {selectedOrderIds.length === orders.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-stone-300">·</span>
            <button type="button" onClick={cancelSelectionMode} className="font-bold text-stone-500 hover:text-black cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-16 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-[#006241] animate-spin" />
        </div>
      ) : loadError ? (
        <ErrorCard message={loadError} onRetry={loadFirstPage} label="orders" />
      ) : isSearching ? (
        /* Search mode — flat list, no sections */
        orders.length === 0 ? (
          <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-14 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F4F6F4] flex items-center justify-center mx-auto">
              <Search className="w-5 h-5 text-stone-400" />
            </div>
            <div className="space-y-1">
              <p className="font-black text-sm text-[#111813]">No matches found</p>
              <p className="text-xs text-[#71717A] max-w-xs mx-auto">Try a different keyword or clear the search.</p>
            </div>
            <button type="button" onClick={() => setSearchQuery('')} className="px-4 py-2 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] text-[#111813] rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer">Clear search</button>
          </div>
        ) : (
          <div className="space-y-2">{orders.map(renderOrderCard)}</div>
        )
      ) : (
        <>
          {/* Welcome / Cleared banner for To Do */}
          {activeTab === 'todo' && orders.length === 0 && totalEver === 0 && (
            <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#E8F0E9] flex items-center justify-center mx-auto">
                <Plus className="w-5 h-5 text-[#006241]" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-sm text-[#111813]">Welcome to Ordy</p>
                <p className="text-xs text-[#5A655D] max-w-xs mx-auto leading-relaxed">
                  Share your store link to get your first order. Buyers fill in their own details — you just pack and ship.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-1">
                <button type="button" onClick={handleShareStoreLink} className="px-4 py-2.5 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
                  <Share2 className="w-3.5 h-3.5" /> Copy store link
                </button>
                <button type="button" onClick={handleNewOrderClick} className="px-4 py-2.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] text-[#111813] rounded-xl text-xs font-bold transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Add manual order
                </button>
              </div>
            </div>
          )}

          {activeTab === 'todo' && orders.length === 0 && totalEver > 0 && (
            <div className="bg-[#E8F0E9] border border-[#C2D6C5] rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-[#006241]" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-black text-[#006241]">You're all caught up</div>
                <div className="text-[11px] text-[#006241]/80">Nothing needs your attention right now.</div>
              </div>
            </div>
          )}

          {activeTab === 'history' && orders.length === 0 && (
            <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-14 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F4F6F4] flex items-center justify-center mx-auto">
                <Package className="w-5 h-5 text-stone-400" />
              </div>
              <div className="space-y-1">
                <p className="font-black text-sm text-[#111813]">No history yet</p>
                <p className="text-xs text-[#71717A] max-w-xs mx-auto">Delivered and returned orders will appear here.</p>
              </div>
            </div>
          )}

          {/* Sections (structural tabs) or flat list */}
          {sections ? (
            <div className="space-y-4">
              {sections.map((section) => (
                <div key={section.id} className="space-y-2">
                  <SectionDivider tone={section.tone} label={section.label} count={section.items.length} />
                  {section.items.length === 0 ? (
                    <SectionEmptyText>{section.emptyText}</SectionEmptyText>
                  ) : (
                    section.items.map(renderOrderCard)
                  )}
                </div>
              ))}
            </div>
          ) : orders.length > 0 ? (
            <div className="space-y-2">{orders.map(renderOrderCard)}</div>
          ) : null}
        </>
      )}

      {!loading && !loadError && hasMore && (
        <div className="flex justify-center pt-1">
          <button type="button" onClick={handleLoadMore} disabled={loadingMore} className="px-5 py-2.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] hover:border-stone-400 rounded-2xl text-xs font-bold text-[#18181B] transition active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer">
            {loadingMore ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>) : (<>Load more · {totalCount - orders.length} remaining</>)}
          </button>
        </div>
      )}

      {dispatchOrderTarget && (
        <div className="fixed inset-0 bg-[#18181B]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] max-w-sm w-full shadow-2xl text-sm text-[#18181B] overflow-hidden">
            <div className="flex items-start justify-between p-5 pb-3 border-b border-[#E7EBE7]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"><Truck className="w-4 h-4 text-blue-600" /></div>
                <div>
                  <h3 className="font-black text-sm leading-tight">Dispatch Order</h3>
                  <p className="text-[11px] text-[#71717A] font-mono mt-0.5">#{dispatchOrderTarget.order_code || dispatchOrderTarget.id.slice(0, 4)}</p>
                </div>
              </div>
              <button onClick={() => setDispatchOrderTarget(null)} className="p-1.5 -m-1.5 text-stone-400 hover:text-black transition cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#71717A]">Courier Company</label>
                <select value={selectedCourier} onChange={(e) => setSelectedCourier(e.target.value)} className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-transparent focus:border-[#006241] focus:bg-white rounded-xl font-semibold text-sm outline-none transition cursor-pointer">
                  {SRI_LANKAN_COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#71717A]">Tracking / Waybill No.</label>
                <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. KMB-99824" className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-transparent focus:border-[#006241] focus:bg-white rounded-xl font-mono font-bold text-sm outline-none transition placeholder:text-stone-400 placeholder:font-normal" />
              </div>
            </div>
            <div className="p-5 pt-0">
              <button type="button" onClick={handleConfirmDispatch} disabled={actionLoadingId === dispatchOrderTarget.id} className="w-full py-3 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl text-sm active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer">
                {actionLoadingId === dispatchOrderTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirm Dispatch <ArrowRight className="w-3.5 h-3.5" /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-24 sm:bottom-6 left-4 right-4 max-w-lg mx-auto bg-[#18181B] text-white p-2.5 pl-4 rounded-[20px] shadow-2xl shadow-stone-900/30 flex items-center justify-between gap-2 z-40 border border-stone-800/80 backdrop-blur">
          <div className="leading-tight shrink-0">
            <div className="text-xs font-black">{selectedOrderIds.length} selected</div>
            <div className="text-[10px] text-stone-400">{packableCount > 0 ? `${packableCount} ready to pack` : 'Batch actions'}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setShowPrintModal(true)} className="px-3 py-2 bg-white text-[#18181B] hover:bg-stone-100 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition cursor-pointer">
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print AWB</span>
              <span className="sm:hidden">Print</span>
            </button>
            {packableCount > 0 && (
              <button type="button" onClick={handleBulkPack} disabled={bulkPacking} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 cursor-pointer">
                {bulkPacking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><PackageCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Pack ({packableCount})</span><span className="sm:hidden">{packableCount}</span></>}
              </button>
            )}
            <button type="button" onClick={handleBatchDelete} disabled={deleting} className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 cursor-pointer">
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Delete</span></>}
            </button>
            <button type="button" onClick={cancelSelectionMode} className="p-2 text-stone-400 hover:text-white transition cursor-pointer" aria-label="Cancel selection"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {showPrintModal && (
        <PrintManifestModal isOpen={showPrintModal} onClose={() => setShowPrintModal(false)} orders={selectedOrdersData} seller={seller} />
      )}

      {trustPopover && (
        <div className="fixed inset-0 z-[95]" onClick={() => setTrustPopover(null)}>
          <div className="absolute bg-white border border-[#E7EBE7] rounded-2xl shadow-2xl p-4 max-w-xs" style={{ top: Math.min(trustPopover.anchor.bottom + 8, window.innerHeight - 220), left: Math.min(Math.max(12, trustPopover.anchor.left - 100), window.innerWidth - 300) }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${trustPopover.highRisk ? 'bg-rose-50' : 'bg-amber-50'}`}>
                <AlertTriangle className={`w-4 h-4 ${trustPopover.highRisk ? 'text-rose-600' : 'text-amber-600'}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className={`font-black text-sm ${trustPopover.highRisk ? 'text-rose-900' : 'text-amber-900'}`}>
                  {trustPopover.data.total_flags} report{trustPopover.data.total_flags === 1 ? '' : 's'} from {trustPopover.data.distinct_sellers} seller{trustPopover.data.distinct_sellers === 1 ? '' : 's'}
                </div>
                <div className="text-[11px] text-[#5A655D] mt-1.5 space-y-1">
                  {trustPopover.data.top_reason && (
                    <div>
                      <span className="text-stone-500">Most common: </span>
                      <span className="font-semibold text-[#111813]">
                        {trustPopover.data.top_reason === 'no_answer' ? "Didn't answer phone" :
                         trustPopover.data.top_reason === 'refused' ? 'Refused delivery' :
                         trustPopover.data.top_reason === 'wrong_address' ? 'Wrong / fake address' :
                         trustPopover.data.top_reason === 'changed_mind' ? 'Changed mind' :
                         trustPopover.data.top_reason === 'other' ? 'Other' :
                         trustPopover.data.top_reason}
                      </span>
                    </div>
                  )}
                  {trustPopover.data.last_flag_at && (
                    <div><span className="text-stone-500">Last: </span><span className="font-semibold text-[#111813]">{relativeTime(trustPopover.data.last_flag_at)}</span></div>
                  )}
                </div>
                <div className="text-[10px] text-stone-400 mt-2 italic">Contributions from other Ordy sellers. Never shows who reported.</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}