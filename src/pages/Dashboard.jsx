import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  ArrowRight,
  Package,
  Truck,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  PackageCheck,
  Layers,
} from 'lucide-react';
import { fetchOrders, formatLKR } from '../services/dbService';
import { supabase } from '../supabase';

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
/*  Payment classification — buyer's turn?                             */
/* ------------------------------------------------------------------ */
function isAwaitingBuyer(ord) {
  if (ord.status !== 'received') return false;
  const isCOD = !ord.payment_method || ord.payment_method === 'COD';
  const isBank = ord.payment_method === 'Bank';
  if (isBank && ord.payment_status === 'Awaiting Payment') return true;
  if (isCOD && !ord.buyer_confirmed) return true;
  return false;
}

const STATUS_PILL = {
  received: 'bg-amber-50 text-amber-700 border-amber-200',
  packed: 'bg-blue-50 text-blue-700 border-blue-200',
  dispatched: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-50 text-[#006241] border-emerald-200',
  canceled: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function Dashboard({ seller }) {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [timeframe, setTimeframe] = useState('today');
  const [loading, setLoading] = useState(true);

  /* ---------------------------------------------------------------- */
  /*  Initial load                                                     */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    async function loadData() {
      if (!seller?.id) return;
      try {
        setLoading(true);
        const data = await fetchOrders(seller.id);
        setOrders(data || []);
      } catch (err) {
        console.error('Dashboard load failed:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [seller?.id]);

  /* ---------------------------------------------------------------- */
  /*  Realtime subscription                                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!seller?.id) return;
    let isMounted = true;

    const channelName = `dashboard-rt-${seller.id}-${Date.now()}-${Math.random()
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
  /*  Pipeline buckets — MUST match Orders page tab definitions        */
  /* ---------------------------------------------------------------- */
  const pipeline = useMemo(() => {
    let toProcess = 0;
    let packed = 0;
    let inTransit = 0;
    let delivered = 0;

    orders.forEach((o) => {
      if (o.status === 'received') { toProcess += 1; return; }
      if (o.status === 'packed') { packed += 1; return; }
      if (o.status === 'dispatched') { inTransit += 1; return; }
      if (o.status === 'delivered') { delivered += 1; }
    });

    return { toProcess, packed, inTransit, delivered };
  }, [orders]);

  /* ---------------------------------------------------------------- */
  /*  Waiting on buyer — subset of "To Process"                        */
  /* ---------------------------------------------------------------- */
  const waitingOnBuyer = useMemo(
    () => orders.filter(isAwaitingBuyer).length,
    [orders]
  );

  /* ---------------------------------------------------------------- */
  /*  Timeframe-filtered sales metrics                                 */
  /* ---------------------------------------------------------------- */
  const { totalSales, orderCount, avgOrder } = useMemo(() => {
    const now = new Date();
    const filtered = orders.filter((o) => {
      const d = new Date(o.created_at);
      if (timeframe === 'today') return d.toDateString() === now.toDateString();
      if (timeframe === 'week') {
        const w = new Date();
        w.setDate(now.getDate() - 7);
        return d >= w;
      }
      if (timeframe === 'month') {
        const m = new Date();
        m.setDate(now.getDate() - 30);
        return d >= m;
      }
      return true;
    });

    const sales = filtered
      .filter((o) => o.status !== 'canceled')
      .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

    const count = filtered.length;
    const avg = count > 0 ? sales / count : 0;

    return { totalSales: sales, orderCount: count, avgOrder: avg };
  }, [orders, timeframe]);

  const recentOrders = useMemo(() => orders.slice(0, 5), [orders]);

  /* ---------------------------------------------------------------- */
  /*  Loading                                                          */
  /* ---------------------------------------------------------------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  const pipelineItems = [
    {
      id: 'received',
      label: 'To Process',
      count: pipeline.toProcess,
      icon: Layers,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      id: 'packed',
      label: 'Packed',
      count: pipeline.packed,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      id: 'dispatched',
      label: 'In Transit',
      count: pipeline.inTransit,
      icon: Truck,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      id: 'delivered',
      label: 'Delivered',
      count: pipeline.delivered,
      icon: CheckCircle2,
      color: 'text-[#006241]',
      bg: 'bg-emerald-50',
    },
  ];

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/*  WELCOME CARD                                                 */}
      {/* ============================================================ */}
      <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-black text-[#111813] tracking-tight truncate">
              Welcome back, {seller?.shop_name}
            </h1>
            <p className="text-xs text-[#5A655D] mt-0.5">
              Store live at{' '}
              <span className="font-mono font-bold text-[#006241]">
                ordy.lk/{seller?.handle}
              </span>
            </p>
          </div>

          <div className="flex bg-[#F4F6F4] p-1 rounded-2xl border border-[#E7EBE7] text-xs font-bold shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setTimeframe('today')}
              className={`px-3 py-1.5 rounded-xl transition ${
                timeframe === 'today' ? 'bg-white text-[#111813] shadow-xs' : 'text-[#5A655D]'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTimeframe('week')}
              className={`px-3 py-1.5 rounded-xl transition ${
                timeframe === 'week' ? 'bg-white text-[#111813] shadow-xs' : 'text-[#5A655D]'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeframe('month')}
              className={`px-3 py-1.5 rounded-xl transition ${
                timeframe === 'month' ? 'bg-white text-[#111813] shadow-xs' : 'text-[#5A655D]'
              }`}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  PIPELINE SNAPSHOT — matches Orders tabs exactly                */}
      {/* ============================================================ */}
      <button
        onClick={() => navigate('/orders')}
        className="w-full bg-white border border-[#E7EBE7] rounded-[24px] shadow-xs hover:border-stone-300 transition active:scale-[0.995] group"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D] flex items-center gap-1.5">
            <PackageCheck className="w-3.5 h-3.5" /> Order Pipeline
          </span>
          <span className="text-[10px] font-bold text-[#006241] flex items-center gap-1 group-hover:underline">
            View all <ArrowRight className="w-3 h-3" />
          </span>
        </div>
        <div className="grid grid-cols-4 divide-x divide-[#E7EBE7] border-t border-[#E7EBE7]">
          {pipelineItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="px-2 py-3.5 flex flex-col items-center gap-1.5"
              >
                <div className={`w-8 h-8 rounded-xl ${item.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="text-base font-black text-[#111813] leading-none">
                  {item.count}
                </div>
                <div className="text-[10px] font-bold text-[#5A655D] uppercase tracking-wider leading-none text-center">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>
      </button>

      {/* ============================================================ */}
      {/*  METRIC ROW                                                   */}
      {/* ============================================================ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Gross Sales */}
        <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 shadow-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 text-[#006241]" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">
              Gross Sales
            </span>
          </div>
          <div className="text-xl font-black text-[#111813] truncate pt-1">
            {formatLKR(totalSales)}
          </div>
          <div className="text-[10px] text-[#5A655D]">
            {orderCount} order{orderCount === 1 ? '' : 's'}
          </div>
        </div>

        {/* Average Order */}
        <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 shadow-xs space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">
              Avg Order
            </span>
          </div>
          <div className="text-xl font-black text-[#111813] truncate pt-1">
            {formatLKR(avgOrder)}
          </div>
          <div className="text-[10px] text-[#5A655D]">
            Per transaction
          </div>
        </div>

        {/* Waiting on Buyer */}
        <div className={`col-span-2 md:col-span-1 bg-white border rounded-[24px] p-4 shadow-xs space-y-1 ${
          waitingOnBuyer > 0 ? 'border-amber-200' : 'border-[#E7EBE7]'
        }`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
              waitingOnBuyer > 0 ? 'bg-amber-100' : 'bg-stone-100'
            }`}>
              <Clock className={`w-3.5 h-3.5 ${
                waitingOnBuyer > 0 ? 'text-amber-700' : 'text-stone-400'
              }`} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">
              Waiting on Buyer
            </span>
          </div>
          <div className={`text-xl font-black truncate pt-1 ${
            waitingOnBuyer > 0 ? 'text-amber-600' : 'text-[#111813]'
          }`}>
            {waitingOnBuyer}
          </div>
          <div className="text-[10px] text-[#5A655D]">
            {waitingOnBuyer > 0
              ? 'Not yet confirmed or paid'
              : 'Nothing pending'}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/*  ATTENTION BANNER                                             */}
      {/* ============================================================ */}
      {waitingOnBuyer > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[20px] p-3.5 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-xs text-amber-900 truncate">
                {waitingOnBuyer} order{waitingOnBuyer > 1 ? 's' : ''} waiting on buyer
              </div>
              <div className="text-[10px] text-amber-700 truncate">
                Send WhatsApp reminders to unblock them
              </div>
            </div>
          </div>
          <Link
            to="/orders"
            className="px-3 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shrink-0 transition active:scale-95"
          >
            Review
          </Link>
        </div>
      )}

      {/* ============================================================ */}
      {/*  RECENT ORDERS                                                */}
      {/* ============================================================ */}
      <div className="bg-white border border-[#E7EBE7] rounded-[24px] shadow-xs overflow-hidden">
        <div className="flex justify-between items-center px-5 pt-4 pb-3 border-b border-[#E7EBE7]">
          <h2 className="font-extrabold text-sm text-[#111813]">Recent Orders</h2>
          <Link
            to="/orders"
            className="text-xs font-bold text-[#006241] flex items-center gap-1 hover:underline"
          >
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto">
              <Package className="w-5 h-5 text-stone-400" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-xs text-stone-700">No orders yet</p>
              <p className="text-[11px] text-[#5A655D]">
                Place your first order to see it appear here.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={() => navigate('/orders')}
                className="px-4 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold transition active:scale-95 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> New Order
              </button>
              <Link
                to="/products"
                className="px-4 py-2 bg-[#F4F6F4] hover:bg-stone-200 text-[#111813] rounded-xl text-xs font-bold transition active:scale-95"
              >
                Add Products
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[#E7EBE7]">
            {recentOrders.map((o) => {
              const pill = STATUS_PILL[o.status] || STATUS_PILL.received;
              const awaitingBuyer = isAwaitingBuyer(o);

              let statusLabel = o.status;
              if (o.status === 'received' && awaitingBuyer) statusLabel = 'Unverified';
              else if (o.status === 'received') statusLabel = 'Ready';
              else if (o.status === 'canceled') statusLabel = 'Returned';

              return (
                <Link
                  key={o.id}
                  to={`/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#F4F6F4] transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-xs text-[#111813]">
                        #{o.order_code || o.id.slice(0, 4)}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${pill}`}>
                        {statusLabel}
                      </span>
                      <span className="text-[10px] text-stone-400 font-medium">
                        {relativeTime(o.created_at)}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-[#111813] truncate mt-0.5">
                      {o.customer_name}
                    </div>
                    <div className="text-[10px] text-[#5A655D] font-mono truncate">
                      {o.city || o.district}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-xs text-[#111813]">
                      {formatLKR(o.total_amount)}
                    </div>
                    <div className="text-[9px] font-bold text-[#5A655D] uppercase tracking-wider">
                      {o.payment_method === 'COD' ? 'COD' : 'Bank'}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}