import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  Search,
  Printer,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  MessageCircle,
  Loader2,
  Plus,
  Check,
  Layers,
  CheckSquare,
  Square,
  X,
  ChevronRight,
  ArrowRight,
  Trash2,
  RotateCcw,
  Landmark,
  PackageCheck,
} from 'lucide-react';
import {
  fetchOrders,
  updateOrderStatus,
  bulkUpdateOrderStatus,
  deleteOrdersBatch,
  formatLKR,
} from '../services/dbService';
import { supabase } from '../supabase';
import PrintManifestModal from '../components/PrintManifestModal';
import { notify } from '../components/Toast';

const PIPELINE_TABS = [
  { id: 'active', label: 'Active', icon: Layers, emptyTitle: 'All caught up!', emptyDesc: 'No active orders require your attention right now.' },
  { id: 'received', label: 'To Confirm', icon: Clock, emptyTitle: 'Nothing to confirm', emptyDesc: 'New orders awaiting buyer verification will appear here.' },
  { id: 'packed', label: 'Packed', icon: Package, emptyTitle: 'No packed orders', emptyDesc: 'Orders ready for dispatch will appear here.' },
  { id: 'dispatched', label: 'In Transit', icon: Truck, emptyTitle: 'No orders in transit', emptyDesc: 'Dispatched orders being delivered will appear here.' },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2, emptyTitle: 'No deliveries yet', emptyDesc: 'Completed orders will show up here.' },
  { id: 'canceled', label: 'Returned', icon: RotateCcw, emptyTitle: 'No returns', emptyDesc: 'Returned or cancelled orders will appear here.' },
];

const STATUS_PRIORITY = {
  received: 1,
  packed: 2,
  dispatched: 3,
  delivered: 4,
  canceled: 5
};

const SRI_LANKAN_COURIERS = [
  'Koombiyo Delivery',
  'Domex',
  'Pronto Lanka',
  'Prompt X',
  'Fardar Express',
  'Certis Lanka',
  'Courier.lk',
  'Other / In-House Rider'
];

/* ------------------------------------------------------------------ */
/*  Relative timestamp helper                                          */
/* ------------------------------------------------------------------ */
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

/* ------------------------------------------------------------------ */
/*  Status accent stripe — matches order status                        */
/* ------------------------------------------------------------------ */
function statusStripe(ord) {
  if (ord.status === 'canceled') return 'bg-stone-300';
  if (ord.status === 'delivered') return 'bg-[#006241]';
  if (ord.status === 'dispatched') return 'bg-purple-500';
  if (ord.status === 'packed') return 'bg-blue-500';

  // received — differentiate by payment state
  const isBank = ord.payment_method === 'Bank';
  const isAwaitingPayment = isBank && ord.payment_status === 'Awaiting Payment';
  if (isAwaitingPayment) return 'bg-amber-500';
  return 'bg-amber-400';
}

/* ------------------------------------------------------------------ */
/*  Eligibility check for bulk pack                                    */
/* ------------------------------------------------------------------ */
function isEligibleForPack(ord) {
  if (ord.status !== 'received') return false;
  const isCOD = !ord.payment_method || ord.payment_method === 'COD';
  const isBank = ord.payment_method === 'Bank';
  const isPaid = ord.payment_status === 'Paid';
  if (isCOD) return Boolean(ord.buyer_confirmed);
  if (isBank) return isPaid;
  return false;
}

export default function Orders({ seller, onOpenPOS: propOnOpenPOS }) {
  const navigate = useNavigate();

  const outletContext = useOutletContext() || {};
  const onOpenPOS = propOnOpenPOS || outletContext.onOpenPOS;

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkPacking, setBulkPacking] = useState(false);

  const [dispatchOrderTarget, setDispatchOrderTarget] = useState(null);
  const [selectedCourier, setSelectedCourier] = useState(SRI_LANKAN_COURIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState('');

  const loadOrders = async () => {
    if (!seller?.id) return;
    try {
      setLoading(true);
      const data = await fetchOrders(seller.id);
      setOrders(data || []);
    } catch (err) {
      notify('Failed to load orders: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [seller?.id]);

  /* ---------------------------------------------------------------- */
  /*  Realtime subscription                                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!seller?.id) return;
    let isMounted = true;

    const channelName = `orders-rt-${seller.id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `seller_id=eq.${seller.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === 'INSERT' && newRow?.id) {
            setOrders((prev) => {
              if (prev.some((o) => o.id === newRow.id)) return prev;
              return [newRow, ...prev];
            });
            if (newRow.source !== 'manual_pos') {
              notify(`New order #${newRow.order_code || newRow.id.slice(0, 4)} received!`);
            }
          } else if (eventType === 'UPDATE' && newRow?.id) {
            setOrders((prev) =>
              prev.map((o) => (o.id === newRow.id ? { ...o, ...newRow } : o))
            );
          } else if (eventType === 'DELETE' && oldRow?.id) {
            setOrders((prev) => prev.filter((o) => o.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [seller?.id]);

  /* ---------------------------------------------------------------- */
  /*  Counts per tab                                                   */
  /* ---------------------------------------------------------------- */
  const counts = useMemo(() => {
    const map = { active: 0, received: 0, packed: 0, dispatched: 0, delivered: 0, canceled: 0 };
    orders.forEach((o) => {
      if (map[o.status] !== undefined) map[o.status] += 1;
      if (o.status !== 'delivered' && o.status !== 'canceled') map.active += 1;
    });
    return map;
  }, [orders]);

  /* ---------------------------------------------------------------- */
  /*  Filtered + sorted orders                                         */
  /* ---------------------------------------------------------------- */
  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return orders
      .filter((o) => {
        let matchTab = false;
        if (activeTab === 'active') {
          matchTab = o.status !== 'delivered' && o.status !== 'canceled';
        } else {
          matchTab = o.status === activeTab;
        }

        const matchQuery = !q ||
          o.order_code?.toLowerCase().includes(q) ||
          o.customer_name?.toLowerCase().includes(q) ||
          o.customer_phone?.includes(q) ||
          o.city?.toLowerCase().includes(q) ||
          o.district?.toLowerCase().includes(q);

        return matchTab && matchQuery;
      })
      .sort((a, b) => {
        if (activeTab === 'active' || activeTab === 'received') {
          if (a.status === 'received' && b.status === 'received') {
            if (a.buyer_confirmed !== b.buyer_confirmed) {
              return a.buyer_confirmed ? 1 : -1;
            }
          }
        }
        const rankA = STATUS_PRIORITY[a.status] || 99;
        const rankB = STATUS_PRIORITY[b.status] || 99;
        if (rankA !== rankB) return rankA - rankB;
        return new Date(b.created_at) - new Date(a.created_at);
      });
  }, [orders, activeTab, searchQuery]);

  /* ---------------------------------------------------------------- */
  /*  Bulk pack eligibility count                                      */
  /* ---------------------------------------------------------------- */
  const packableCount = useMemo(() => {
    if (!selectedOrderIds.length) return 0;
    return orders.filter(
      (o) => selectedOrderIds.includes(o.id) && isEligibleForPack(o)
    ).length;
  }, [orders, selectedOrderIds]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                         */
  /* ---------------------------------------------------------------- */
  const handleNewOrderClick = () => {
    if (typeof onOpenPOS === 'function') {
      onOpenPOS();
    } else {
      console.warn('onOpenPOS handler is missing or not a function');
      notify('POS Modal trigger unavailable', 'error');
    }
  };

  const handleInlineAction = async (orderId, nextStatus, e) => {
    if (e) e.stopPropagation();
    setActionLoadingId(orderId);
    try {
      const updated = await updateOrderStatus(orderId, nextStatus);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)));
      notify(`Order marked as ${nextStatus}!`);
    } catch (err) {
      notify('Failed to update: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBulkPack = async () => {
    if (!packableCount) {
      notify('No eligible orders in selection — verify buyer or confirm payment first.', 'error');
      return;
    }

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
      if (skipped > 0) {
        notify(`${updatedCount} packed, ${skipped} skipped (not verified/paid).`);
      } else {
        notify(`${updatedCount} order${updatedCount === 1 ? '' : 's'} packed!`);
      }

      cancelSelectionMode();
    } catch (err) {
      notify('Bulk pack failed: ' + err.message, 'error');
    } finally {
      setBulkPacking(false);
    }
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchOrderTarget) return;
    setActionLoadingId(dispatchOrderTarget.id);
    try {
      const updated = await updateOrderStatus(dispatchOrderTarget.id, 'dispatched', {
        courierName: selectedCourier,
        trackingNumber: trackingNumber.trim()
      });
      setOrders((prev) => prev.map((o) => (o.id === dispatchOrderTarget.id ? { ...o, ...updated } : o)));
      notify('Order dispatched with tracking details!');
      setDispatchOrderTarget(null);
      setTrackingNumber('');
    } catch (err) {
      notify('Failed to dispatch: ' + err.message, 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleBatchDelete = async () => {
    if (!selectedOrderIds.length) return;
    if (!window.confirm(`Permanently delete ${selectedOrderIds.length} selected order(s)? Stock items will be safely returned to inventory.`)) return;

    setDeleting(true);
    try {
      await deleteOrdersBatch(selectedOrderIds);
      setOrders((prev) => prev.filter((o) => !selectedOrderIds.includes(o.id)));
      notify(`Successfully deleted ${selectedOrderIds.length} order(s).`);
      cancelSelectionMode();
    } catch (err) {
      notify('Delete failed: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelectOrder = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedOrderIds.length === filteredOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(filteredOrders.map((o) => o.id));
    }
  };

  const cancelSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedOrderIds([]);
  };

  const selectedOrdersData = useMemo(() => {
    return orders.filter((o) => selectedOrderIds.includes(o.id));
  }, [orders, selectedOrderIds]);

  const activeTabMeta = PIPELINE_TABS.find((t) => t.id === activeTab);

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-4 pb-32 text-[#18181B] max-w-5xl mx-auto">
      {/* ============================================================ */}
      {/*  HEADER — merged search + new order + selection controls      */}
      {/* ============================================================ */}
      <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-4 sm:p-5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black tracking-tight">Orders</h1>
              <span className="px-2 py-0.5 bg-emerald-50 text-[#006241] rounded-full text-[11px] font-bold">
                {counts.active} active
              </span>
            </div>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Manage, track, and fulfill customer orders
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-56">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders…"
                className="w-full pl-9 pr-3 py-2 bg-[#F4F4F5] border border-transparent focus:border-[#006241] focus:bg-white rounded-xl text-xs outline-none font-medium transition placeholder:text-stone-400"
              />
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

        {/* Selection controls row — only when there are orders */}
        {filteredOrders.length > 0 && (
          <div className="flex items-center justify-between pt-3 border-t border-[#E4E4E7] text-xs">
            <div className="text-[#71717A] font-medium">
              <span className="font-bold text-[#18181B]">{filteredOrders.length}</span>{' '}
              order{filteredOrders.length === 1 ? '' : 's'}
              {searchQuery && <span className="text-stone-400"> · filtered</span>}
            </div>

            {isSelectionMode ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSelectAllToggle}
                  className="font-bold text-[#006241] hover:underline cursor-pointer"
                >
                  {selectedOrderIds.length === filteredOrders.length ? 'Deselect all' : 'Select all'}
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

      {/* ============================================================ */}
      {/*  TABS                                                         */}
      {/* ============================================================ */}
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

      {/* ============================================================ */}
      {/*  ORDERS LIST                                                  */}
      {/* ============================================================ */}
      {loading ? (
        <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-16 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-[#006241] animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-14 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] flex items-center justify-center mx-auto">
            <Package className="w-5 h-5 text-stone-400" />
          </div>
          <div className="space-y-1">
            <p className="font-black text-sm text-[#18181B]">
              {searchQuery ? 'No matches found' : (activeTabMeta?.emptyTitle || 'Nothing here')}
            </p>
            <p className="text-[11px] text-[#71717A] max-w-xs mx-auto">
              {searchQuery
                ? 'Try a different keyword or clear the search.'
                : (activeTabMeta?.emptyDesc || 'Orders will appear here when they arrive.')}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredOrders.map((ord) => {
            const isSelected = selectedOrderIds.includes(ord.id);
            const cleanPhone = ord.customer_phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
            const items = Array.isArray(ord.items) ? ord.items : [];
            const isCanceled = ord.status === 'canceled';
            const isBusy = actionLoadingId === ord.id;

            const isCOD = !ord.payment_method || ord.payment_method === 'COD';
            const isBank = ord.payment_method === 'Bank';
            const isAwaitingPayment = isBank && ord.payment_status === 'Awaiting Payment';
            const packable = isEligibleForPack(ord);

            // Item preview — cap at 2
            const visibleItems = items.slice(0, 2);
            const extraItems = items.length - visibleItems.length;
            const totalQty = items.reduce((sum, i) => sum + (i.quantity || 1), 0);

            const trackingUrl = `${window.location.origin}/order/${ord.id}`;
            const verifyMsg = `Hi ${ord.customer_name}! Please tap to confirm your order #${ord.order_code || ord.id.slice(0, 4)} from ${seller?.shop_name}: ${trackingUrl}`;

            return (
              <div
                key={ord.id}
                onClick={() => {
                  if (isSelectionMode) {
                    toggleSelectOrder(ord.id);
                  } else {
                    navigate(`/orders/${ord.id}`);
                  }
                }}
                className={`group relative bg-white border rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden ${
                  isSelected
                    ? 'border-[#006241] ring-2 ring-[#006241]/15 bg-[#F0FDF4]/40 shadow-sm'
                    : isCanceled
                    ? 'border-[#E4E4E7] bg-stone-50/60 opacity-65'
                    : 'border-[#E4E4E7] hover:border-stone-300 hover:shadow-md hover:shadow-stone-200/40'
                }`}
              >
                {/* Status accent stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusStripe(ord)} ${isCanceled ? 'opacity-40' : ''}`} />

                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3.5 pl-4">
                  {/* Left block — checkbox + order info */}
                  <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => toggleSelectOrder(ord.id, e)}
                        className="shrink-0 pt-0.5 sm:pt-0 cursor-pointer"
                        aria-label={isSelected ? 'Deselect order' : 'Select order'}
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-[#006241]" />
                        ) : (
                          <Square className="w-5 h-5 text-stone-300 hover:text-stone-500 transition" />
                        )}
                      </button>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Row 1: Order code + status pill + time */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-mono font-black text-sm ${isCanceled ? 'text-stone-400 line-through' : 'text-[#18181B]'}`}>
                          #{ord.order_code || ord.id.slice(0, 4)}
                        </span>

                        {/* Awaiting Payment */}
                        {isAwaitingPayment && !isCanceled && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Landmark className="w-2.5 h-2.5" /> Awaiting Payment
                          </span>
                        )}

                        {/* COD unverified */}
                        {isCOD && ord.status === 'received' && !ord.buyer_confirmed && !isCanceled && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Unverified
                          </span>
                        )}

                        {/* Bank paid, received */}
                        {isBank && !isAwaitingPayment && ord.status === 'received' && !isCanceled && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-[#006241] border border-emerald-200">
                            <Check className="w-2.5 h-2.5" /> Ready to Pack
                          </span>
                        )}

                        {/* COD verified, received */}
                        {isCOD && ord.buyer_confirmed && ord.status === 'received' && !isCanceled && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-[#006241] border border-emerald-200">
                            <Check className="w-2.5 h-2.5" /> Ready to Pack
                          </span>
                        )}

                        {/* Non-received status pills */}
                        {ord.status === 'packed' && !isCanceled && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Packed
                          </span>
                        )}
                        {ord.status === 'dispatched' && !isCanceled && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            In Transit
                          </span>
                        )}
                        {ord.status === 'delivered' && !isCanceled && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-[#006241] border border-emerald-200">
                            Delivered
                          </span>
                        )}
                        {isCanceled && (
                          <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-stone-100 text-stone-500 border border-stone-200">
                            Returned
                          </span>
                        )}

                        <span className="text-[10px] text-stone-400 font-medium ml-auto sm:ml-0">
                          {relativeTime(ord.created_at)}
                        </span>
                      </div>

                      {/* Row 2: Customer name + phone + location */}
                      <div className="text-xs truncate">
                        <span className={`font-semibold ${isCanceled ? 'text-stone-400' : 'text-[#18181B]'}`}>
                          {ord.customer_name}
                        </span>
                        {ord.customer_phone && (
                          <span className="text-[10px] font-mono text-stone-400 ml-1.5">
                            {ord.customer_phone}
                          </span>
                        )}
                        {(ord.city || ord.district) && (
                          <span className="text-[10px] text-stone-400 ml-1.5">
                            · {ord.district || ord.city}
                          </span>
                        )}
                      </div>

                      {/* Row 3: Items preview (max 2) */}
                      {items.length > 0 && (
                        <div className="text-[11px] text-[#52525B] flex items-center gap-1.5 flex-wrap pt-0.5">
                          <Package className="w-3 h-3 text-stone-400 shrink-0" />
                          {visibleItems.map((item, i) => (
                            <React.Fragment key={i}>
                              <span className="truncate max-w-[140px] font-medium">{item.title}</span>
                              <span className="text-stone-400">×{item.quantity || 1}</span>
                              {i < visibleItems.length - 1 && (
                                <span className="text-stone-300">·</span>
                              )}
                            </React.Fragment>
                          ))}
                          {extraItems > 0 && (
                            <span className="text-[#006241] font-bold">
                              +{extraItems} more
                            </span>
                          )}
                          {items.length === 1 && totalQty > 1 && (
                            <span className="text-stone-400">
                              ({totalQty} items)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right block — amount + actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E4E4E7] sm:pl-3">
                    <div className="text-left sm:text-right leading-tight">
                      <div className={`text-sm font-black ${
                        isCanceled ? 'text-stone-400 line-through'
                        : isAwaitingPayment ? 'text-amber-700'
                        : 'text-[#18181B]'
                      }`}>
                        {formatLKR(ord.total_amount)}
                      </div>
                      <div className={`text-[9px] font-bold uppercase tracking-wider ${
                        isCOD ? 'text-amber-600' : 'text-emerald-600'
                      }`}>
                        {isCOD ? 'COD' : 'Bank'}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      {isCOD && !ord.buyer_confirmed && ord.status === 'received' && !isSelectionMode && (
                        <a
                          href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(verifyMsg)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Send WhatsApp confirmation"
                          className="px-2.5 py-1.5 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Verify</span>
                        </a>
                      )}

                      {ord.status === 'received' && packable && !isSelectionMode && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => handleInlineAction(ord.id, 'packed', e)}
                          className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>Pack <ArrowRight className="w-3 h-3" /></>
                          )}
                        </button>
                      )}

                      {ord.status === 'packed' && !isSelectionMode && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={(e) => { e.stopPropagation(); setDispatchOrderTarget(ord); }}
                          className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-xs disabled:opacity-50 cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>Dispatch <Truck className="w-3.5 h-3" /></>
                          )}
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
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/*  DISPATCH MODAL                                               */}
      {/* ============================================================ */}
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
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#71717A]">
                  Courier Company
                </label>
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4F4F5] border border-transparent focus:border-[#006241] focus:bg-white rounded-xl font-semibold text-xs outline-none transition cursor-pointer"
                >
                  {SRI_LANKAN_COURIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#71717A]">
                  Tracking / Waybill No.
                </label>
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

      {/* ============================================================ */}
      {/*  FLOATING BATCH BAR                                           */}
      {/* ============================================================ */}
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
                title="Mark all eligible orders as packed"
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

      {/* ============================================================ */}
      {/*  PRINT MODAL                                                  */}
      {/* ============================================================ */}
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