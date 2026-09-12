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
  RotateCcw
} from 'lucide-react';
import { fetchOrders, updateOrderStatus, deleteOrdersBatch, formatLKR } from '../services/dbService';
import { supabase } from '../supabase';
import PrintManifestModal from '../components/PrintManifestModal';
import { notify } from '../components/Toast';

const PIPELINE_TABS = [
  { id: 'active', label: 'Active Workload', icon: Layers, activeBg: 'bg-indigo-50/80 text-indigo-900 border-indigo-200', color: 'text-indigo-600' },
  { id: 'received', label: 'To Confirm', icon: Clock, activeBg: 'bg-amber-50/80 text-amber-900 border-amber-200', color: 'text-amber-600' },
  { id: 'packed', label: 'Packed', icon: Package, activeBg: 'bg-blue-50/80 text-blue-900 border-blue-200', color: 'text-blue-600' },
  { id: 'dispatched', label: 'In Transit', icon: Truck, activeBg: 'bg-purple-50/80 text-purple-900 border-purple-200', color: 'text-purple-600' },
  { id: 'delivered', label: 'Delivered', icon: CheckCircle2, activeBg: 'bg-emerald-50/80 text-emerald-900 border-emerald-200', color: 'text-[#006241]' },
  { id: 'canceled', label: 'Returned Order', icon: RotateCcw, activeBg: 'bg-rose-50/80 text-rose-900 border-rose-200', color: 'text-rose-600' }
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

export default function Orders({ seller, onOpenPOS: propOnOpenPOS }) {
  const navigate = useNavigate();

  // Robust context fallback: pull onOpenPOS from router outlet context if not passed directly as a prop
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
  /*  Realtime subscription — new/updated/deleted orders appear live   */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!seller?.id) return;
    let isMounted = true;

    // Unique channel name so React 19 StrictMode double-mount is safe
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
            // Don't toast for orders the seller themselves just created in POS
            if (newRow.source !== 'manual_pos') {
              notify(
                `New order #${newRow.order_code || newRow.id.slice(0, 4)} received!`
              );
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

  const counts = useMemo(() => {
    const map = { active: 0, received: 0, packed: 0, dispatched: 0, delivered: 0, canceled: 0 };
    orders.forEach((o) => {
      if (map[o.status] !== undefined) map[o.status] += 1;
      if (o.status !== 'delivered' && o.status !== 'canceled') {
        map.active += 1;
      }
    });
    return map;
  }, [orders]);

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

  return (
    <div className="space-y-4 pb-32 text-[#18181B] max-w-5xl mx-auto">
      {/* 1. COMMAND HEADER WITH GUARDED POS TRIGGER */}
      <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-tight">Orders Command Center</h1>
            <span className="px-2 py-0.5 bg-emerald-50 text-[#006241] rounded-full text-xs font-mono font-bold">
              {counts.active} Active
            </span>
          </div>
          <p className="text-xs text-[#71717A] mt-0.5">Manage, track, and fulfill customer orders seamlessly</p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, name, city..."
              className="w-full pl-9 pr-3 py-2 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl text-xs focus:bg-white transition outline-none font-medium"
            />
          </div>

          <button
            type="button"
            onClick={handleNewOrderClick}
            className="px-3.5 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Order</span>
          </button>
        </div>
      </div>

      {/* 2. TAB NAVIGATION */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {PIPELINE_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const count = counts[tab.id] || 0;
          const displayLabel = tab.id === 'packed' ? 'Packed' : tab.label;

          return (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedOrderIds([]); }}
              className={`px-3.5 py-2 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-2 border ${
                isActive
                  ? `${tab.activeBg} shadow-2xs font-black`
                  : 'bg-white text-[#71717A] border-[#E4E4E7] hover:border-stone-400 hover:text-black'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? '' : tab.color}`} />
              <span>{displayLabel}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  isActive ? 'bg-black/10 text-black' : 'bg-stone-100 text-stone-700'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 3. PRINT / MANAGE BAR */}
      <div className="flex justify-between items-center bg-white border border-[#E4E4E7] rounded-2xl px-4 py-2.5 shadow-2xs">
        <div className="text-xs text-[#71717A] font-medium">
          {filteredOrders.length} order{filteredOrders.length === 1 ? '' : 's'} in view
        </div>

        {filteredOrders.length > 0 && (
          <div>
            {isSelectionMode ? (
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllToggle}
                  className="font-bold text-[#006241] hover:underline"
                >
                  {selectedOrderIds.length === filteredOrders.length ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-stone-300">|</span>
                <span className="font-bold text-[#18181B]">{selectedOrderIds.length} Selected</span>
                <button
                  type="button"
                  onClick={cancelSelectionMode}
                  className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-lg transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSelectionMode(true)}
                className="text-xs font-bold text-stone-700 hover:text-black flex items-center gap-1.5 bg-[#F4F4F5] hover:bg-stone-200 px-3 py-1.5 rounded-xl border border-[#E4E4E7] transition"
              >
                <CheckSquare className="w-3.5 h-3.5 text-stone-500" />
                <span>Print / Manage</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. ORDERS LIST */}
      {loading ? (
        <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-[#006241] animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-[#E4E4E7] rounded-[24px] p-12 text-center text-xs text-[#71717A] space-y-2">
          <Package className="w-8 h-8 text-stone-300 mx-auto" />
          <p className="font-bold text-stone-700">All caught up!</p>
          <p className="text-[11px]">There are no orders requiring attention in this view.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredOrders.map((ord) => {
            const isSelected = selectedOrderIds.includes(ord.id);
            const cleanPhone = ord.customer_phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
            const items = Array.isArray(ord.items) ? ord.items : [];
            const isCanceled = ord.status === 'canceled';
            const isBusy = actionLoadingId === ord.id;

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
                className={`bg-white border rounded-[20px] p-4 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isSelected
                    ? 'border-[#006241] bg-[#F0FDF4]/30 shadow-2xs'
                    : isCanceled
                    ? 'border-[#E4E4E7] bg-stone-50/50 opacity-60'
                    : 'border-[#E4E4E7] hover:border-stone-400 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  {isSelectionMode && (
                    <button
                      type="button"
                      onClick={(e) => toggleSelectOrder(ord.id, e)}
                      className="text-[#006241] shrink-0 pt-0.5 sm:pt-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="w-5 h-5 text-[#006241]" />
                      ) : (
                        <Square className="w-5 h-5 text-stone-300" />
                      )}
                    </button>
                  )}

                  <div className="min-w-0 space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-sm text-[#18181B]">
                        #{ord.order_code || ord.id.slice(0, 4)}
                      </span>

                      {ord.status === 'received' && !ord.buyer_confirmed && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" /> Pending Verification
                        </span>
                      )}
                      {ord.status === 'received' && ord.buyer_confirmed && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-[#006241] border border-emerald-200/60 flex items-center gap-1">
                          <Check className="w-2.5 h-2.5" /> Ready to Pack
                        </span>
                      )}
                      {ord.status === 'packed' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-200/60">
                          Packed
                        </span>
                      )}
                      {ord.status === 'dispatched' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200/60">
                          With Courier
                        </span>
                      )}
                      {ord.status === 'delivered' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-600">
                          Delivered
                        </span>
                      )}
                      {ord.status === 'canceled' && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 text-stone-400">
                          Returned Order
                        </span>
                      )}

                      <span className="text-[11px] text-[#71717A] font-medium truncate">
                        • {ord.district || ord.city}
                      </span>
                    </div>

                    <div className="text-xs text-[#18181B] font-semibold truncate">
                      {ord.customer_name}{' '}
                      <span className="text-[11px] font-mono font-normal text-[#71717A]">
                        ({ord.customer_phone})
                      </span>
                    </div>

                    <div className="bg-[#F4F4F5] rounded-xl px-2.5 py-1 text-[11px] text-[#52525B] space-y-0.5 max-w-lg border border-[#E4E4E7]/60">
                      {items.map((item, i) => (
                        <div key={i} className="flex justify-between items-center truncate">
                          <span className="truncate pr-2 font-medium">📦 {item.title}</span>
                          <span className="font-mono font-bold shrink-0">×{item.quantity || 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#E4E4E7]">
                  <div className="text-left sm:text-right">
                    <div className={`text-xs font-black ${isCanceled ? 'line-through text-stone-400' : 'text-[#18181B]'}`}>
                      {formatLKR(ord.total_amount)}
                    </div>
                    <div className="text-[10px] font-medium text-[#71717A] uppercase tracking-wider">
                      {ord.payment_method === 'COD' ? 'Cash' : 'Bank'}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                    {!ord.buyer_confirmed && ord.status === 'received' && !isSelectionMode && (
                      <a
                        href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(verifyMsg)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-2xs"
                        title="Send WhatsApp Confirmation"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Verify</span>
                      </a>
                    )}

                    {ord.status === 'received' && ord.buyer_confirmed && !isSelectionMode && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => handleInlineAction(ord.id, 'packed', e)}
                        className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-2xs disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Pack <Package className="w-3.5 h-3" /></>}
                      </button>
                    )}

                    {ord.status === 'packed' && !isSelectionMode && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={(e) => { e.stopPropagation(); setDispatchOrderTarget(ord); }}
                        className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1 shadow-2xs disabled:opacity-50"
                      >
                        {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>Dispatch <Truck className="w-3.5 h-3" /></>}
                      </button>
                    )}

                    {!isSelectionMode && (
                      <div className="text-stone-300 hover:text-black">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. QUICK DISPATCH MODAL */}
      {dispatchOrderTarget && (
        <div className="fixed inset-0 bg-[#18181B]/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] p-6 max-w-sm w-full shadow-2xl space-y-4 text-xs text-[#18181B]">
            <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-3">
              <div>
                <h3 className="font-black text-sm">Dispatch Order #{dispatchOrderTarget.order_code || dispatchOrderTarget.id.slice(0, 4)}</h3>
                <p className="text-[11px] text-[#71717A]">Enter courier details for tracking</p>
              </div>
              <button onClick={() => setDispatchOrderTarget(null)} className="text-stone-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Select Courier Company</label>
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl font-bold text-xs"
                >
                  {SRI_LANKAN_COURIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Tracking Number / Waybill</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. KMB-99824"
                  className="w-full px-3.5 py-2.5 bg-[#F4F4F5] border border-[#E4E4E7] rounded-xl font-mono font-bold"
                />
              </div>

              <button
                type="button"
                onClick={handleConfirmDispatch}
                disabled={actionLoadingId === dispatchOrderTarget.id}
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl active:scale-95 transition mt-2 shadow-2xs flex items-center justify-center gap-2"
              >
                {actionLoadingId === dispatchOrderTarget.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Dispatch & Notify'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. FLOATING BATCH ACTION BAR */}
      {selectedOrderIds.length > 0 && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 max-w-lg mx-auto bg-[#18181B] text-white p-3.5 rounded-[24px] shadow-2xl flex items-center justify-between z-40 border border-stone-800">
          <div className="pl-2">
            <span className="text-xs font-black">{selectedOrderIds.length} selected</span>
            <span className="text-[10px] text-stone-400 block">Batch actions</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="px-4 py-2 bg-white text-[#18181B] hover:bg-stone-100 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print AWB</span>
            </button>

            <div className="h-5 w-[1px] bg-stone-700" />

            <button
              type="button"
              onClick={handleBatchDelete}
              disabled={deleting}
              className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition shadow-2xs disabled:opacity-50"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Delete</>}
            </button>

            <button
              type="button"
              onClick={cancelSelectionMode}
              className="p-2 text-stone-400 hover:text-white ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 7. PRINT MANIFEST MODAL */}
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