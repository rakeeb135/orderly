import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Search, Printer, CheckCircle2, Clock, Truck, Package, MessageCircle,
  Loader2, Plus, Check, Layers, CheckSquare, Square, X, ChevronRight,
  ArrowRight, Trash2, RotateCcw, Landmark, PackageCheck, AlertCircle,
  AlertTriangle, RefreshCw,
} from 'lucide-react';
import {
  updateOrderStatus,
  bulkUpdateOrderStatus,
  deleteOrdersBatch,
  getBulkBuyerTrust,
  fetchOrdersPage,
  getOrderCounts,
  formatLKR,
} from '../services/dbService';
import { supabase } from '../supabase';
import PrintManifestModal from '../components/PrintManifestModal';
import { notify } from '../components/Toast';
import { confirm } from '../components/ConfirmModal';
import { normalizeSLPhone } from '../utils/phone';

const PAGE_SIZE = 50;

const PIPELINE_TABS = [
  { id: 'active', label: 'Active', icon: Layers, emptyTitle: 'All caught up!', emptyDesc: 'No active orders require your attention right now.' },
  { id: 'received', label: 'To Process', icon: Clock, emptyTitle: 'Nothing to process', emptyDesc: 'New orders will appear here the moment they arrive.' },
  { id: 'packed', label: 'Packed', icon: Package, emptyTitle: 'Nothing packed yet', emptyDesc: 'Orders you pack will show up here, ready for dispatch.' },
  { id: 'dispatched', label: 'In Transit', icon: Truck, emptyTitle: 'No orders in transit', emptyDesc: 'Orders with couriers will show up here.' },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2, emptyTitle: 'No deliveries yet', emptyDesc: 'Completed orders will show up here.' },
  { id: 'canceled', label: 'Returned', icon: RotateCcw, emptyTitle: 'No returns', emptyDesc: 'Returned or cancelled orders will appear here.' },
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

function isEligibleForPack(ord) {
  if (ord.status !== 'received') return false;
  const isCOD = !ord.payment_method || ord.payment_method === 'COD';
  const isBank = ord.payment_method === 'Bank';
  const isPaid = ord.payment_status === 'Paid';
  if (isCOD) return Boolean(ord.buyer_confirmed);
  if (isBank) return isPaid;
  return false;
}

function SectionHeader({ tone, label, count }) {
  const map = {
    waiting: { text: 'text-amber-700', bg: 'bg-amber-100', line: 'bg-amber-200', icon: AlertCircle },
    ready: { text: 'text-[#006241]', bg: 'bg-emerald-100', line: 'bg-emerald-200', icon: Check },
  };
  const style = map[tone];
  const Icon = style.icon;
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md ${style.bg} ${style.text} text-[10px] font-bold uppercase tracking-wider`}>
        <Icon className="w-2.5 h-2.5" />
        {label}
      </span>
      <span className={`text-[10px] font-bold ${style.text}`}>{count}</span>
      <div className={`flex-1 h-px ${style.line}`} />
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
        <p className="font-black text-sm text-[#18181B]">Couldn't load {label}</p>
        <p className="text-[11px] text-[#71717A] max-w-xs mx-auto leading-relaxed">
          {message || 'Please check your connection and try again.'}
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="px-4 py-2 bg-[#18181B] hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
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

  const [orders, setOrders] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [counts, setCounts] = useState({ active: 0, received: 0, packed: 0, dispatched: 0, delivered: 0, canceled: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounced(searchQuery, 300);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkPacking, setBulkPacking] = useState(false);

  const [dispatchOrderTarget, setDispatchOrderTarget] = useState(null);
  const [selectedCourier, setSelectedCourier] = useState(SRI_LANKAN_COURIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState('');

  const [trustMap, setTrustMap] = useState({});

  const tabRef = useRef(activeTab);
  const searchRef = useRef(debouncedSearch);
  const countsTimerRef = useRef(null);
  useEffect(() => { tabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { searchRef.current = debouncedSearch; }, [debouncedSearch]);

  /* ---------------------------------------------------------------- */
  /*  Load first page                                                  */
  /* ---------------------------------------------------------------- */
  const loadFirstPage = useCallback(async () => {
    if (!seller?.id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [page, countsData] = await Promise.all([
        fetchOrdersPage(seller.id, {
          tab: activeTab,
          search: debouncedSearch,
          limit: PAGE_SIZE,
          offset: 0,
        }),
        getOrderCounts(seller.id),
      ]);
      setOrders(page.orders);
      setTotalCount(page.total);
      setCounts(countsData);
    } catch (err) {
      console.error('Failed to load orders:', err);
      setLoadError(err?.message || 'Network error');
      setOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [seller?.id, activeTab, debouncedSearch]);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  useEffect(() => {
    setSelectedOrderIds([]);
  }, [activeTab, debouncedSearch]);

  /* ---------------------------------------------------------------- */
  /*  Load More                                                        */
  /* ---------------------------------------------------------------- */
  const hasMore = orders.length < totalCount;

  const handleLoadMore = async () => {
    if (!seller?.id || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchOrdersPage(seller.id, {
        tab: activeTab,
        search: debouncedSearch,
        limit: PAGE_SIZE,
        offset: orders.length,
      });
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

  /* ---------------------------------------------------------------- */
  /*  Bulk trust lookup — keyed on the PHONE SET so status updates     */
  /*  do not trigger refetches.                                        */
  /* ---------------------------------------------------------------- */
  const trustPhoneKey = useMemo(() => {
    if (!orders.length) return '';
    const set = new Set();
    orders.forEach((o) => { if (o.customer_phone) set.add(o.customer_phone); });
    return Array.from(set).sort().join('|');
  }, [orders]);

  useEffect(() => {
    if (!trustPhoneKey) {
      setTrustMap({});
      return;
    }
    const phones = trustPhoneKey.split('|');
    let mounted = true;
    getBulkBuyerTrust(phones)
      .then((map) => { if (mounted) setTrustMap(map || {}); })
      .catch(() => {});
    return () => { mounted = false; };
  }, [trustPhoneKey]);

  /* ---------------------------------------------------------------- */
  /*  Realtime                                                         */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!seller?.id) return;
    let isMounted = true;

    const channelName = `orders-rt-${seller.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `seller_id=eq.${seller.id}` },
        (payload) => {
          if (!isMounted) return;
          const { eventType, new: newRow, old: oldRow } = payload;
          const currentTab = tabRef.current;
          const currentSearch = (searchRef.current || '').toLowerCase();

          // Debounced counts refresh — collapses bursts of changes into one call
          if (countsTimerRef.current) clearTimeout(countsTimerRef.current);
          countsTimerRef.current = setTimeout(() => {
            if (!isMounted) return;
            getOrderCounts(seller.id).then((c) => {
              if (isMounted) setCounts(c);
            }).catch(() => {});
          }, 500);

          const matchesTab = (row) => currentTab === 'active'
            ? row.status !== 'delivered' && row.status !== 'canceled'
            : row.status === currentTab;

          const matchesSearch = (row) => !currentSearch ||
            row.order_code?.toLowerCase().includes(currentSearch) ||
            row.customer_name?.toLowerCase().includes(currentSearch) ||
            row.customer_phone?.includes(currentSearch) ||
            row.city?.toLowerCase().includes(currentSearch) ||
            row.district?.toLowerCase().includes(currentSearch);

          if (eventType === 'INSERT' && newRow?.id) {
            if (matchesTab(newRow) && matchesSearch(newRow)) {
              setOrders((prev) => {
                if (prev.some((o) => o.id === newRow.id)) return prev;
                return [newRow, ...prev];
              });
              setTotalCount((t) => t + 1);
            }
            if (newRow.source !== 'manual_pos') {
              notify(`New order #${newRow.order_code || newRow.id.slice(0, 4)} received!`);
            }
          } else if (eventType === 'UPDATE' && newRow?.id) {
            setOrders((prev) => {
              const inList = prev.some((o) => o.id === newRow.id);
              const stillMatches = matchesTab(newRow) && matchesSearch(newRow);
              if (inList && !stillMatches) {
                return prev.filter((o) => o.id !== newRow.id);
              }
              if (!inList && stillMatches) {
                return [newRow, ...prev];
              }
              if (inList) {
                return prev.map((o) => (o.id === newRow.id ? { ...o, ...newRow } : o));
              }
              return prev;
            });
          } else if (eventType === 'DELETE' && oldRow?.id) {
            setOrders((prev) => prev.filter((o) => o.id !== oldRow.id));
            setTotalCount((t) => Math.max(0, t - 1));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      if (countsTimerRef.current) clearTimeout(countsTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [seller?.id]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */
  const handleNewOrderClick = () => {
    if (typeof onOpenPOS === 'function') onOpenPOS();
    else notify('POS Modal trigger unavailable', 'error');
  };

  /* Optimistic: flip the order status instantly, rollback on failure. */
  const handleInlineAction = async (orderId, nextStatus, e) => {
    if (e) e.stopPropagation();

    const snapshot = orders.find((o) => o.id === orderId);
    if (!snapshot) return;

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o))
    );
    setActionLoadingId(orderId);

    try {
      const updated = await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o))
      );
      notify(`Order marked as ${nextStatus}!`);
    } catch (err) {
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? snapshot : o))
      );
      notify('Failed to update: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  /* Optimistic bulk pack: flip eligible orders instantly, rollback on failure. */
  const handleBulkPack = async () => {
    const eligibleSelected = orders.filter(
      (o) => selectedOrderIds.includes(o.id) && isEligibleForPack(o)
    );

    if (!eligibleSelected.length) {
      notify('No eligible orders in selection — verify buyer or confirm payment first.', 'error');
      return;
    }

    const eligibleIds = eligibleSelected.map((o) => o.id);
    const snapshots = eligibleSelected.map((o) => ({ id: o.id, status: o.status }));

    setOrders((prev) =>
      prev.map((o) =>
        eligibleIds.includes(o.id) ? { ...o, status: 'packed' } : o
      )
    );
    setBulkPacking(true);

    try {
      const { updatedOrders, skipped } = await bulkUpdateOrderStatus(selectedOrderIds, 'packed');
      setOrders((prev) =>
        prev.map((o) => {
          const upd = updatedOrders.find((u) => u.id === o.id);
          return upd ? { ...o, ...upd } : o;
        })
      );
      const updatedCount = updatedOrders.length;
      if (skipped > 0) notify(`${updatedCount} packed, ${skipped} skipped (not verified/paid).`);
      else notify(`${updatedCount} order${updatedCount === 1 ? '' : 's'} packed!`);
      cancelSelectionMode();
    } catch (err) {
      setOrders((prev) =>
        prev.map((o) => {
          const snap = snapshots.find((s) => s.id === o.id);
          return snap ? { ...o, status: snap.status } : o;
        })
      );
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

    setOrders((prev) =>
      prev.map((o) =>
        o.id === target.id
          ? {
              ...o,
              status: 'dispatched',
              courier_name: selectedCourier,
              tracking_number: trackingNumber.trim() || o.tracking_number,
              dispatched_at: new Date().toISOString(),
            }
          : o
      )
    );
    setActionLoadingId(target.id);

    try {
      const updated = await updateOrderStatus(target.id, 'dispatched', {
        courierName: selectedCourier,
        trackingNumber: trackingNumber.trim(),
      });
      setOrders((prev) =>
        prev.map((o) => (o.id === target.id ? { ...o, ...updated } : o))
      );
      notify('Order dispatched with tracking details!');
      setDispatchOrderTarget(null);
      setTrackingNumber('');
    } catch (err) {
      setOrders((prev) =>
        prev.map((o) => (o.id === target.id ? snapshot : o))
      );
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
      confirmLabel: 'Delete',
      cancelLabel: 'Keep',
      tone: 'danger',
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
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
      });
      notify('Delete failed: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
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

  const selectedOrdersData = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.id)),
    [orders, selectedOrderIds]
  );

  const packableCount = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.id) && isEligibleForPack(o)).length,
    [orders, selectedOrderIds]
  );

  const activeTabMeta = PIPELINE_TABS.find((t) => t.id === activeTab);

  /* ---------------------------------------------------------------- */
  /*  Order card                                                       */
  /* ---------------------------------------------------------------- */
  const renderOrderCard = (ord) => {
    const isSelected = selectedOrderIds.includes(ord.id);
    const cleanPhone = ord.customer_phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
    const items = Array.isArray(ord.items) ? ord.items : [];
    const isCanceled = ord.status === 'canceled';
    const isBusy = actionLoadingId === ord.id;

    const isCOD = !ord.payment_method || ord.payment_method === 'COD';
    const isBank = ord.payment_method === 'Bank';
    const isAwaitingPayment = isBank && ord.payment_status === 'Awaiting Payment';
    const packable = isEligibleForPack(ord);

    const visibleItems = items.slice(0, 2);
    const extraItems = items.length - visibleItems.length;
    const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

    const trackingUrl = `${window.location.origin}/order/${ord.id}`;
    const verifyMsg = `Hi ${ord.customer_name}! Please tap to confirm your order #${ord.order_code || ord.id.slice(0, 4)} from ${seller?.shop_name}: ${trackingUrl}`;

    const cleanPhoneNorm = normalizeSLPhone(ord.customer_phone || '');
    const trust = trustMap[cleanPhoneNorm];
    const isFlagged = trust && trust.total_flags > 0;
    const isHighRisk = isFlagged && (trust.total_flags >= 3 || (trust.total_flags >= 2 && trust.distinct_sellers >= 2));

    return (
      <div
        key={ord.id}
        onClick={() => {
          if (isSelectionMode) toggleSelectOrder(ord.id);
          else navigate(`/orders/${ord.id}`);
        }}
        className={`group relative bg-white border rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden ${
          isSelected
            ? 'border-[#006241] ring-2 ring-[#006241]/15 bg-[#F0FDF4]/40 shadow-sm'
            : isCanceled
            ? 'border-[#E4E4E7] bg-stone-50/60 opacity-65'
            : 'border-[#E4E4E7] hover:border-stone-300 hover:shadow-md hover:shadow-stone-200/40'
        }`}
      >
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusStripe(ord)} ${isCanceled ? 'opacity-40' : ''}`} />

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3.5 pl-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            {isSelectionMode && (
              <button
                type="button"
                onClick={(e) => toggleSelectOrder(ord.id, e)}
                className="shrink-0 pt-0.5 sm:pt-0 cursor-pointer"
                aria-label={isSelected ? 'Deselect order' : 'Select order'}
              >
                {isSelected ? <CheckSquare className="w-5 h-5 text-[#006241]" /> : <Square className="w-5 h-5 text-stone-300 hover:text-stone-500 transition" />}
              </button>
            )}

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`font-mono font-black text-sm ${isCanceled ? 'text-stone-400 line-through' : 'text-[#18181B]'}`}>
                  #{ord.order_code || ord.id.slice(0, 4)}
                </span>

                {isAwaitingPayment && !isCanceled && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <Landmark className="w-2.5 h-2.5" /> Awaiting Payment
                  </span>
                )}

                {isCOD && ord.status === 'received' && !ord.buyer_confirmed && !isCanceled && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unverified
                  </span>
                )}

                {(ord.buyer_confirmed || (isBank && !isAwaitingPayment)) && ord.status === 'received' && !isCanceled && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-[#006241] border border-emerald-200">
                    <Check className="w-2.5 h-2.5" /> Ready to Pack
                  </span>
                )}

                {ord.status === 'packed' && !isCanceled && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Packed</span>
                )}
                {ord.status === 'dispatched' && !isCanceled && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">In Transit</span>
                )}
                {ord.status === 'delivered' && !isCanceled && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-[#006241] border border-emerald-200">Delivered</span>
                )}
                {isCanceled && (
                  <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-stone-100 text-stone-500 border border-stone-200">Returned</span>
                )}

                {isFlagged && (
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border ${
                      isHighRisk ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-amber-50 text-amber-700 border-amber-300'
                    }`}
                    title={`${trust.total_flags} report${trust.total_flags === 1 ? '' : 's'} from other Ordy sellers`}
                  >
                    <AlertTriangle className="w-2.5 h-2.5" /> Flagged
                  </span>
                )}

                <span className="text-[10px] text-stone-400 font-medium ml-auto sm:ml-0">
                  {relativeTime(ord.created_at)}
                </span>
              </div>

              <div className="text-xs truncate">
                <span className={`font-semibold ${isCanceled ? 'text-stone-400' : 'text-[#18181B]'}`}>{ord.customer_name}</span>
                {ord.customer_phone && <span className="text-[10px] font-mono text-stone-400 ml-1.5">{ord.customer_phone}</span>}
                {(ord.city || ord.district) && <span className="text-[10px] text-stone-400 ml-1.5">· {ord.district || ord.city}</span>}
              </div>

              {items.length > 0 && (
                <div className="text-[11px] text-[#52525B] flex items-center gap-1.5 flex-wrap pt-0.5">
                  <Package className="w-3 h-3 text-stone-400 shrink-0" />
                  {visibleItems.map((item, i) => (
                    <React.Fragment key={i}>
                      <span className="truncate max-w-[140px] font-medium">{item.title}</span>
                      <span className="text-stone-400">×{item.quantity || 1}</span>
                      {i < visibleItems.length - 1 && <span className="text-stone-300">·</span>}
                    </React.Fragment>
                  ))}
                  {extraItems > 0 && <span className="text-[#006241] font-bold">+{extraItems} more</span>}
                  {items.length === 1 && totalQty > 1 && <span className="text-stone-400">({totalQty} items)</span>}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E4E4E7] sm:pl-3">
            <div className="text-left sm:text-right leading-tight">
              <div className={`text-sm font-black ${
                isCanceled ? 'text-stone-400 line-through'
                : isAwaitingPayment ? 'text-amber-700'
                : 'text-[#18181B]'
              }`}>{formatLKR(ord.total_amount)}</div>
              <div className={`text-[9px] font-bold uppercase tracking-wider ${isCOD ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isCOD ? 'COD' : 'Bank'}
              </div>
            </div>

            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {isCOD && !ord.buyer_confirmed && ord.status === 'received' && !isSelectionMode && (
                <a
                  href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(verifyMsg)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Verify</span>
                </a>
              )}

              {ord.status === 'received' && packable && !isSelectionMode && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => handleInlineAction(ord.id, 'packed', e)}
                  className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Pack <ArrowRight className="w-3 h-3" /></>}
                </button>
              )}

              {ord.status === 'packed' && !isSelectionMode && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={(e) => { e.stopPropagation(); setDispatchOrderTarget(ord); }}
                  className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Dispatch <Truck className="w-3.5 h-3" /></>}
                </button>
              )}

              {!isSelectionMode && (
                <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#18181B] group-hover:translate-x-0.5 transition" />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Grouped view for "To Process" tab                                */
  /* ---------------------------------------------------------------- */
  const groupedView = useMemo(() => {
    if (activeTab !== 'received') return null;
    const waiting = [];
    const ready = [];
    orders.forEach((o) => {
      if (isEligibleForPack(o)) ready.push(o);
      else waiting.push(o);
    });
    return { waiting, ready };
  }, [orders, activeTab]);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-4 pb-32 text-[#18181B] max-w-5xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black tracking-tight">Orders</h1>
              <span className="px-2 py-0.5 bg-emerald-50 text-[#006241] rounded-full text-[11px] font-bold">
                {counts.active} active
              </span>
            </div>
            <p className="text-[11px] text-[#71717A] mt-0.5">Manage, track, and fulfill customer orders</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders…"
                className="w-full pl-9 pr-8 py-2 bg-[#F4F4F5] border border-transparent focus:border-[#006241] focus:bg-white rounded-xl text-xs outline-none font-medium transition placeholder:text-stone-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-[#18181B] hover:bg-stone-200 transition cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleNewOrderClick}
              className="px-3.5 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Order</span>
            </button>
          </div>
        </div>

        {orders.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#E4E4E7] text-xs">
            <div className="text-[#71717A] font-medium">
              <span className="font-bold text-[#18181B]">{totalCount}</span>{' '}
              order{totalCount === 1 ? '' : 's'}
              {debouncedSearch && <span className="text-stone-400"> · filtered</span>}
              {orders.length < totalCount && (
                <span className="text-stone-400"> · showing {orders.length}</span>
              )}
            </div>

            {isSelectionMode ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllToggle}
                  className="font-bold text-[#006241] hover:underline cursor-pointer"
                >
                  {selectedOrderIds.length === orders.length ? 'Deselect all' : 'Select all'}
                </button>
                <span className="text-stone-300">·</span>
                <button
                  type="button"
                  onClick={cancelSelectionMode}
                  className="font-bold text-stone-500 hover:text-black cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSelectionMode(true)}
                className="font-bold text-stone-600 hover:text-black flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F4F4F5] hover:bg-stone-200 border border-[#E4E4E7] transition cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 text-[#006241]" />
                <span>Select</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {PIPELINE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id] || 0;
          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedOrderIds([]); }}
              className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 border cursor-pointer ${
                isActive
                  ? 'bg-[#18181B] text-white border-[#18181B] shadow-md shadow-stone-900/10'
                  : 'bg-white text-[#52525B] border-[#E4E4E7] hover:border-stone-400 hover:text-[#18181B]'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 transition ${isActive ? 'text-white' : 'text-stone-400 group-hover:text-[#18181B]'}`} />
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`min-w-[18px] h-[18px] px-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-[#F4F4F5] text-stone-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-16 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-[#006241] animate-spin" />
        </div>
      ) : loadError ? (
        <ErrorCard message={loadError} onRetry={loadFirstPage} label="orders" />
      ) : orders.length === 0 ? (
        <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-14 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] flex items-center justify-center mx-auto">
            <Package className="w-5 h-5 text-stone-400" />
          </div>
          <div className="space-y-1">
            <p className="font-black text-sm text-[#18181B]">
              {debouncedSearch ? 'No matches found' : (activeTabMeta?.emptyTitle || 'Nothing here')}
            </p>
            <p className="text-[11px] text-[#71717A] max-w-xs mx-auto">
              {debouncedSearch ? 'Try a different keyword or clear the search.' : (activeTabMeta?.emptyDesc || 'Orders will appear here when they arrive.')}
            </p>
          </div>
          {debouncedSearch && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 bg-[#F4F4F5] hover:bg-stone-200 border border-[#E4E4E7] text-[#18181B] rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
            >
              Clear search
            </button>
          )}
        </div>
      ) : groupedView ? (
        <div className="space-y-2">
          {groupedView.waiting.length > 0 && (
            <SectionHeader tone="waiting" label="Waiting on Buyer" count={groupedView.waiting.length} />
          )}
          {groupedView.waiting.map(renderOrderCard)}
          {groupedView.ready.length > 0 && (
            <SectionHeader tone="ready" label="Ready to Pack" count={groupedView.ready.length} />
          )}
          {groupedView.ready.map(renderOrderCard)}
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map(renderOrderCard)}
        </div>
      )}

      {/* Load more */}
      {!loading && !loadError && hasMore && (
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="px-5 py-2.5 bg-white hover:bg-stone-50 border border-[#E4E4E7] hover:border-stone-400 rounded-2xl text-xs font-bold text-[#18181B] transition active:scale-95 disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            {loadingMore ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
            ) : (
              <>Load more · {totalCount - orders.length} remaining</>
            )}
          </button>
        </div>
      )}

      {/* Dispatch modal */}
      {dispatchOrderTarget && (
        <div className="fixed inset-0 bg-[#18181B]/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] max-w-sm w-full shadow-2xl text-xs text-[#18181B] overflow-hidden">
            <div className="flex items-start justify-between p-5 pb-3 border-b border-[#E4E4E7]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center">
                  <Truck className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-black text-sm leading-tight">Dispatch Order</h3>
                  <p className="text-[11px] text-[#71717A] font-mono mt-0.5">
                    #{dispatchOrderTarget.order_code || dispatchOrderTarget.id.slice(0, 4)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDispatchOrderTarget(null)}
                className="p-1.5 -m-1.5 text-stone-400 hover:text-black transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#71717A]">Courier Company</label>
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4F4F5] border border-transparent focus:border-[#006241] focus:bg-white rounded-xl font-semibold text-xs outline-none transition cursor-pointer"
                >
                  {SRI_LANKAN_COURIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#71717A]">Tracking / Waybill No.</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. KMB-99824"
                  className="w-full px-3.5 py-2.5 bg-[#F4F4F5] border border-transparent focus:border-[#006241] focus:bg-white rounded-xl font-mono font-bold text-xs outline-none transition placeholder:text-stone-400 placeholder:font-normal"
                />
              </div>
            </div>

            <div className="p-5 pt-0">
              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={actionLoadingId === dispatchOrderTarget.id}
                className="w-full py-3 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl text-xs active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
              >
                {actionLoadingId === dispatchOrderTarget.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>Confirm Dispatch & Notify <ArrowRight className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch bar */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 max-w-lg mx-auto bg-[#18181B] text-white p-2.5 pl-4 rounded-[20px] shadow-2xl shadow-stone-900/30 flex items-center justify-between gap-2 z-40 border border-stone-800/80 backdrop-blur">
          <div className="leading-tight shrink-0">
            <div className="text-xs font-black">{selectedOrderIds.length} selected</div>
            <div className="text-[10px] text-stone-400">
              {packableCount > 0 ? `${packableCount} ready to pack` : 'Batch actions'}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-3 py-2 bg-white text-[#18181B] hover:bg-stone-100 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Print AWB</span>
              <span className="sm:hidden">Print</span>
            </button>

            {packableCount > 0 && (
              <button
                type="button"
                onClick={handleBulkPack}
                disabled={bulkPacking}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 cursor-pointer"
              >
                {bulkPacking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Pack ({packableCount})</span>
                    <span className="sm:hidden">{packableCount}</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={deleting}
              className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition disabled:opacity-50 cursor-pointer"
            >
              {deleting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Delete</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={cancelSelectionMode}
              className="p-2 text-stone-400 hover:text-white transition cursor-pointer"
              aria-label="Cancel selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Print modal */}
      {showPrintModal && (
        <PrintManifestModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          orders={selectedOrdersData}
          seller={seller}
        />
      )}
    </div>
  );
}