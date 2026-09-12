import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Store, 
  CheckCircle2, 
  Truck, 
  Loader2, 
  MessageCircle 
} from 'lucide-react';
import { fetchOrderByUuid, confirmOrderAsBuyer, formatLKR } from '../services/dbService';

export default function OrderTracker() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await fetchOrderByUuid(id);
        setOrder(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleBuyerConfirm = async () => {
    setConfirming(true);
    try {
      const updated = await confirmOrderAsBuyer(order.id);
      setOrder((prev) => ({ ...prev, ...updated }));
    } catch (err) {
      alert(err.message || 'Failed to confirm order');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center p-6 text-center text-xs text-[#5A655D]">
        Order details not found. Please check your tracking link.
      </div>
    );
  }

  const seller = order.sellers;
  const items = Array.isArray(order.items) ? order.items : [];
  const cleanSellerWa = seller?.whatsapp_number?.replace(/[^0-9]/g, '').replace(/^0/, '94');

  const getStepActive = (stepName) => {
    const steps = ['received', 'packed', 'dispatched', 'delivered'];
    return steps.indexOf(stepName) <= steps.indexOf(order.status);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] font-sans pb-16">
      {/* Top Floating Mini Header */}
      <header className="sticky top-0 z-30 bg-[#F4F6F4]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between max-w-md mx-auto border-b border-[#E7EBE7]/60">
        <div className="flex items-center gap-2 font-black text-xs">
          <Store className="w-4 h-4 text-[#006241]" />
          <span>{seller?.shop_name || 'Store'}</span>
        </div>
        {seller?.handle && (
          <Link to={`/${seller.handle}`} className="text-[11px] font-bold text-[#006241] hover:underline">
            Visit Store
          </Link>
        )}
      </header>

      <main className="max-w-md mx-auto px-4 space-y-4 pt-4">
        {/* Order Status Card */}
        <div className="bg-white border border-[#E7EBE7] rounded-[32px] p-6 shadow-xs text-center space-y-4">
          <div className="w-14 h-14 bg-[#E8F0E9] rounded-3xl flex items-center justify-center mx-auto text-[#006241]">
            <Truck className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">Order Status</span>
            <h1 className="text-2xl font-black mt-0.5">#{order.order_code || order.id.slice(0, 4)}</h1>
            <p className="text-xs text-[#5A655D] mt-1">
              Placed on {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* 4-Stage Horizontal Pipeline */}
          <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#E7EBE7]">
            {[
              { id: 'received', label: 'Received' },
              { id: 'packed', label: 'Packed' },
              { id: 'dispatched', label: 'Dispatched' },
              { id: 'delivered', label: 'Delivered' }
            ].map((s) => {
              const active = getStepActive(s.id);
              return (
                <div key={s.id} className="space-y-1">
                  <div className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-xs font-bold transition ${
                    active ? 'bg-[#006241] text-white' : 'bg-[#F4F6F4] text-stone-400'
                  }`}>
                    {active ? <CheckCircle2 className="w-4 h-4" /> : '•'}
                  </div>
                  <div className={`text-[10px] font-bold ${active ? 'text-[#006241]' : 'text-stone-400'}`}>
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Courier Details Banner */}
          {order.status === 'dispatched' && order.courier_name && (
            <div className="bg-[#F4F6F4] rounded-2xl p-3 text-xs space-y-1 text-left border border-[#E7EBE7]">
              <div className="font-bold text-[#111813]">Courier: {order.courier_name}</div>
              <div className="text-[#5A655D] font-mono">Waybill: <strong>{order.tracking_number || 'In Transit'}</strong></div>
            </div>
          )}
        </div>

        {/* 1-TAP BUYER VERIFICATION ACTION */}
        {!order.buyer_confirmed && order.status !== 'canceled' && order.status !== 'delivered' && (
          <div className="bg-white border-2 border-[#006241]/20 rounded-[28px] p-5 shadow-xs text-center space-y-3">
            <div>
              <h3 className="font-extrabold text-sm text-[#111813]">Confirm Your Delivery Address</h3>
              <p className="text-xs text-[#5A655D] mt-1">
                Please confirm that your phone number and address below are accurate so {seller?.shop_name} can pack your order.
              </p>
            </div>

            <button
              onClick={handleBuyerConfirm}
              disabled={confirming}
              className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs active:scale-95 transition disabled:opacity-50"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Confirm My Order</>}
            </button>
          </div>
        )}

        {/* Order Details & Summary */}
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-5 shadow-xs space-y-3 text-xs">
          <div className="font-bold text-[10px] uppercase tracking-wider text-[#5A655D]">Purchased Items</div>
          <div className="divide-y divide-[#E7EBE7]">
            {items.map((i, idx) => (
              <div key={idx} className="py-2.5 flex justify-between items-center">
                <div>
                  <div className="font-bold">{i.title}</div>
                  <div className="text-[11px] text-[#5A655D]">Qty: {i.quantity || 1}</div>
                </div>
                <div className="font-black">{formatLKR(Number(i.price) * (i.quantity || 1))}</div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-[#E7EBE7] space-y-1">
            <div className="flex justify-between text-[#5A655D]">
              <span>Delivery Fee</span>
              <span>{order.delivery_fee === 0 ? <strong className="text-[#006241]">FREE</strong> : formatLKR(order.delivery_fee)}</span>
            </div>
            <div className="flex justify-between text-sm font-black pt-1 border-t border-[#E7EBE7] text-[#006241]">
              <span>Amount Due on Delivery (COD)</span>
              <span>{formatLKR(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-5 shadow-xs space-y-2 text-xs">
          <div className="font-bold text-[10px] uppercase tracking-wider text-[#5A655D]">Delivery To</div>
          <div className="font-bold text-sm">{order.customer_name}</div>
          <div className="font-mono text-[#5A655D] font-bold">
            {order.customer_phone} {order.secondary_phone ? `• Alt: ${order.secondary_phone}` : ''}
          </div>
          <div className="text-[#111813]">{order.delivery_address}, {order.city} {order.district ? `(${order.district})` : ''}</div>
        </div>

        {/* WhatsApp Support Contact */}
        {seller?.whatsapp_number && (
          <div className="text-center pt-2">
            <a
              href={`https://wa.me/${cleanSellerWa}?text=${encodeURIComponent(`Hi ${seller.shop_name}, I have a question regarding my order #${order.order_code || order.id.slice(0, 4)}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006241] hover:underline"
            >
              <MessageCircle className="w-4 h-4" /> Need help? Message store on WhatsApp
            </a>
          </div>
        )}
      </main>
    </div>
  );
}