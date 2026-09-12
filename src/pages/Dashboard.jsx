import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  Users,
  Package,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Share2,
  Loader2
} from 'lucide-react';
import { fetchOrders, formatLKR } from '../services/dbService';
import { supabase } from '../supabase';

export default function Dashboard({ seller }) {
  const [orders, setOrders] = useState([]);
  const [timeframe, setTimeframe] = useState('today'); // 'today', 'week', 'month'
  const [loading, setLoading] = useState(true);

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
  /*  Realtime subscription — dashboard stats tick live                */
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  // Calculate metrics based on timeframe
  const now = new Date();
  const filteredOrders = orders.filter((o) => {
    const d = new Date(o.created_at);
    if (timeframe === 'today') {
      return d.toDateString() === now.toDateString();
    }
    if (timeframe === 'week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(now.getDate() - 7);
      return d >= oneWeekAgo;
    }
    if (timeframe === 'month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setDate(now.getDate() - 30);
      return d >= oneMonthAgo;
    }
    return true;
  });

  const totalSales = filteredOrders
    .filter((o) => o.status !== 'canceled')
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const orderCount = filteredOrders.length;
  const avgOrder = orderCount > 0 ? totalSales / orderCount : 0;
  const unconfirmedOrders = orders.filter((o) => o.status === 'received' && !o.buyer_confirmed);

  return (
    <div className="space-y-6">
      {/* Top Banner / Store Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-[#111813] tracking-tight">
            Welcome back, {seller?.shop_name}
          </h1>
          <p className="text-xs text-[#5A655D] mt-0.5">
            Your store is live at <span className="font-mono font-bold text-[#006241]">orderly.lk/{seller?.handle}</span>
          </p>
        </div>

        {/* Timeframe Toggle Pills */}
        <div className="flex bg-[#F4F6F4] p-1 rounded-2xl border border-[#E7EBE7] text-xs font-bold">
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
            This week
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-3 py-1.5 rounded-xl transition ${
              timeframe === 'month' ? 'bg-white text-[#111813] shadow-xs' : 'text-[#5A655D]'
            }`}
          >
            This month
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">Gross Sales</span>
          <div className="text-2xl font-black text-[#111813]">{formatLKR(totalSales)}</div>
          <span className="text-[10px] text-[#5A655D]">From {orderCount} orders</span>
        </div>

        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">Average Order</span>
          <div className="text-2xl font-black text-[#111813]">{formatLKR(avgOrder)}</div>
          <span className="text-[10px] text-[#5A655D]">Per transaction</span>
        </div>

        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-1">
          <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">Awaiting Confirmation</span>
          <div className="text-2xl font-black text-amber-600">{unconfirmedOrders.length}</div>
          <span className="text-[10px] text-[#5A655D]">Unconfirmed by buyers</span>
        </div>
      </div>

      {/* Needs Attention / Quick Action Banner */}
      {unconfirmedOrders.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-700 shrink-0" />
            <div>
              <div className="font-bold text-xs text-amber-900">
                {unconfirmedOrders.length} new order{unconfirmedOrders.length > 1 ? 's' : ''} to confirm
              </div>
              <div className="text-[11px] text-amber-700">Send WhatsApp confirmation tokens to lock them in.</div>
            </div>
          </div>
          <Link
            to="/orders"
            className="px-3.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shrink-0 transition"
          >
            Review
          </Link>
        </div>
      )}

      {/* Recent Activity List */}
      <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-4">
        <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
          <h2 className="font-extrabold text-sm text-[#111813]">Recent Orders</h2>
          <Link to="/orders" className="text-xs font-bold text-[#006241] flex items-center gap-1 hover:underline">
            View All <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#5A655D]">
            No orders logged yet. Tap <strong>"+ New Order"</strong> to ring up your first transaction.
          </div>
        ) : (
          <div className="divide-y divide-[#E7EBE7]">
            {orders.slice(0, 5).map((o) => (
              <Link
                key={o.id}
                to={`/orders/${o.id}`}
                className="py-3 flex justify-between items-center hover:bg-[#F4F6F4] px-2 rounded-xl transition"
              >
                <div className="min-w-0 pr-2">
                  <div className="font-bold text-xs text-[#111813] truncate">{o.customer_name}</div>
                  <div className="text-[11px] text-[#5A655D] mt-0.5 font-mono">
                    #{o.order_code} • {o.payment_method} • {o.city}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-xs text-[#111813]">{formatLKR(o.total_amount)}</div>
                  <div className="text-[10px] font-bold text-[#006241] capitalize">{o.status}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}