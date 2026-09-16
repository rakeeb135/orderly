import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  CheckCircle2,
  Truck,
  Loader2,
  Send,
  XCircle,
  Printer,
  Landmark,
  AlertCircle,
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  fetchOrderByUuid,
  updateOrderStatus,
  markOrderPaymentReceived,
  formatLKR,
  updateProductStock,
} from '../services/dbService';
import PrintManifestModal from '../components/PrintManifestModal';
import { notify } from '../components/Toast';

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

export default function OrderDetail({ seller }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState(SRI_LANKAN_COURIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState('');

  const loadOrder = async () => {
    try {
      setLoading(true);
      const data = await fetchOrderByUuid(id);
      setOrder(data);
    } catch (err) {
      notify(err.message || 'Failed to load order', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [id]);

  /* ---------------------------------------------------------------- */
  /*  Realtime — this order updates live                               */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const channelName = `order-rt-${id}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          if (!isMounted || !payload?.new) return;
          setOrder((prev) => (prev ? { ...prev, ...payload.new } : prev));
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleStatusAdvance = async (nextStatus, extraData = {}) => {
    setUpdating(true);
    try {
      const updated = await updateOrderStatus(order.id, nextStatus, extraData);
      setOrder((prev) => ({ ...prev, ...updated }));
      notify(`Order marked as ${nextStatus}!`);
      if (nextStatus === 'dispatched') {
        setShowDispatchModal(false);
      }
    } catch (err) {
      notify('Failed to update status: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkPaymentReceived = async () => {
    setUpdating(true);
    try {
      const updated = await markOrderPaymentReceived(order.id);
      setOrder((prev) => ({ ...prev, ...updated }));
      notify('Payment confirmed! Order is ready to pack.');
    } catch (err) {
      notify('Failed to confirm payment: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Mark this order as returned? Stock items will be safely returned to catalog inventory.')) return;
    setUpdating(true);

    try {
      const items = Array.isArray(order.items) ? order.items : [];

      for (const item of items) {
        if (item.id) {
          const { data: liveProduct } = await supabase
            .from('products')
            .select('stock_count')
            .eq('id', item.id)
            .single();

          if (liveProduct) {
            const currentLiveStock = Number(liveProduct.stock_count) || 0;
            const qtyToReturn = Number(item.quantity) || 1;
            await updateProductStock(item.id, currentLiveStock + qtyToReturn);
          }
        }
      }

      const updated = await updateOrderStatus(order.id, 'canceled');
      setOrder((prev) => ({ ...prev, ...updated }));
      notify('Order marked as returned and inventory returned to catalog.');
    } catch (err) {
      notify('Failed to update: ' + err.message, 'error');
    } finally {
      setUpdating(false);
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
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-2xl border border-[#E7EBE7] text-center space-y-3">
          <p className="text-xs text-[#5A655D]">Order not found.</p>
          <button onClick={() => navigate('/orders')} className="text-xs font-bold text-[#006241]">
            ← Back to Orders
          </button>
        </div>
      </div>
    );
  }

  const cleanPhone = order.customer_phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
  const items = Array.isArray(order.items) ? order.items : [];

  const locationParts = [order.delivery_address, order.city].filter(Boolean);
  if (order.district && order.district.toLowerCase() !== order.city?.toLowerCase()) {
    locationParts.push(`${order.district} District`);
  }
  const displayLocation = locationParts.join(', ');

  // Payment classification
  const isCOD = !order.payment_method || order.payment_method === 'COD';
  const isBank = order.payment_method === 'Bank';
  const isAwaitingPayment = isBank && order.payment_status === 'Awaiting Payment';
  const isPaid = order.payment_status === 'Paid';
  const isCanceled = order.status === 'canceled';
  const isDelivered = order.status === 'delivered';

  const getStepStatus = (stepName) => {
    const sequence = ['received', 'packed', 'dispatched', 'delivered'];
    const currentIndex = sequence.indexOf(order.status);
    const targetIndex = sequence.indexOf(stepName);
    return targetIndex <= currentIndex;
  };

  const trackingUrl = `${window.location.origin}/order/${order.id}`;
  const verificationMsg = `Hi ${order.customer_name}! Thank you for ordering from ${seller?.shop_name || 'our store'}.\n\nPlease tap the link below to confirm your Cash on Delivery order #${order.order_code || order.id.slice(0, 4)} and verify your delivery address:\n${trackingUrl}`;
  const dispatchMsg = `Hi ${order.customer_name}! Great news — your order #${order.order_code || order.id.slice(0, 4)} has been dispatched via ${order.courier_name || 'our courier'}.\n\nTracking Number: ${order.tracking_number || 'N/A'}\nTotal Amount: ${formatLKR(order.total_amount)}\n\nTrack your delivery live here:\n${trackingUrl}`;

  // For bank orders, seller's WhatsApp might want a slightly different message on dispatch
  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-32 text-[#18181B]">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-1.5 text-xs font-bold text-[#71717A] hover:text-[#18181B] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPrintModal(true)}
            className="px-3.5 py-1.5 bg-white border border-[#E4E4E7] hover:border-black rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition active:scale-95"
          >
            <Printer className="w-3.5 h-3.5" /> Print AWB
          </button>
          <span className="text-xs font-mono text-[#71717A]">Ref: #{order.order_code || order.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* Main Status Card */}
      <div className="bg-white border border-[#E4E4E7] rounded-[28px] p-6 shadow-2xs space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-black">#{order.order_code || order.id.slice(0, 4)}</h1>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isCanceled
                  ? 'bg-rose-50 text-rose-700'
                  : isDelivered
                  ? 'bg-emerald-50 text-[#006241]'
                  : isAwaitingPayment
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-stone-100 text-[#18181B]'
              }`}>
                {isCanceled ? 'Returned' : isDelivered ? 'Delivered' : isAwaitingPayment ? 'Awaiting Payment' : order.status}
              </span>
              {isPaid && isBank && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Payment Received
                </span>
              )}
              {isCOD && order.buyer_confirmed && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Verified by Buyer
                </span>
              )}
            </div>
            <p className="text-xs text-[#71717A] mt-1 font-medium">
              {order.customer_name} • {isCOD ? 'Cash on Delivery' : 'Bank Transfer'} • {order.district || order.city || 'Sri Lanka'}
            </p>
          </div>
        </div>

        {/* Progress tracker */}
        {!isCanceled ? (
          <div className="pt-3 pb-1 border-t border-[#E4E4E7]">
            <div className="grid grid-cols-4 gap-2 relative">
              {[
                { id: 'received', label: 'Received', color: 'bg-amber-500' },
                { id: 'packed', label: 'Packed', color: 'bg-blue-600' },
                { id: 'dispatched', label: 'Dispatched', color: 'bg-purple-600' },
                { id: 'delivered', label: 'Delivered', color: 'bg-[#006241]' }
              ].map((s, i) => {
                const isDone = getStepStatus(s.id);
                return (
                  <div key={s.id} className="text-center space-y-1.5 relative z-10">
                    <div
                      className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center text-xs font-bold transition shadow-2xs ${
                        isDone ? `${s.color} text-white` : 'bg-[#F4F4F5] text-[#71717A]'
                      }`}
                    >
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
                    </div>
                    <div className={`text-[10px] font-bold ${isDone ? 'text-[#18181B]' : 'text-[#71717A]'}`}>{s.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 font-bold text-center">
            This order was marked as returned.
          </div>
        )}
      </div>

      {/* ⭐ AWAITING PAYMENT BANNER (Bank orders only) */}
      {isAwaitingPayment && !isCanceled && !isDelivered && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-[24px] p-4 space-y-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4 text-amber-800" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-black text-xs text-amber-900">Bank Transfer — Awaiting Payment</div>
              <div className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                Buyer placed the order and was instructed to send the transfer slip on WhatsApp. Confirm payment below once you've verified the transfer in your bank account.
              </div>
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl p-3 space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between gap-3">
              <span className="text-[#5A655D] shrink-0">Expected Amount</span>
              <span className="font-black text-[#006241] text-sm">{formatLKR(order.total_amount)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#5A655D] shrink-0">Reference</span>
              <span className="font-black text-[#006241]">#{order.order_code || order.id.slice(0, 4)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleMarkPaymentReceived}
            disabled={updating}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs active:scale-95 transition shadow-2xs disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Mark Payment Received</>}
          </button>

          <p className="text-[10px] text-amber-700 text-center">
            Have you not received the slip? Ping the buyer on WhatsApp from the destination card below.
          </p>
        </div>
      )}

      {/* Buyer Verification Banner (COD only) */}
      {isCOD && !order.buyer_confirmed && !isCanceled && !isDelivered && (
        <div className="bg-amber-50 border border-amber-200 rounded-[24px] p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="font-bold text-xs text-amber-900">Unconfirmed COD Order</div>
            <div className="text-[11px] text-amber-700">Send a 1-tap WhatsApp link to confirm delivery address before dispatching.</div>
          </div>
          <a
            href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(verificationMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 bg-[#006241] text-white rounded-xl text-xs font-bold shrink-0 transition active:scale-95 shadow-2xs flex items-center gap-1.5"
          >
            <MessageCircle className="w-3.5 h-3.5" /> Send Verification
          </a>
        </div>
      )}

      {/* Dispatched Courier Details */}
      {order.status === 'dispatched' && (
        <div className="bg-purple-50 border border-purple-200 rounded-[24px] p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div>
            <div className="font-bold text-xs text-purple-900 flex items-center gap-1.5">
              <Truck className="w-4 h-4" /> In Transit via {order.courier_name || 'Courier'}
            </div>
            <div className="text-[11px] text-[#71717A] font-mono mt-0.5">
              Waybill: <strong>{order.tracking_number || 'Pending Tracking'}</strong>
            </div>
          </div>
          <a
            href={`https://wa.me/${cleanPhone}?text=${encodeURIComponent(dispatchMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-purple-700 text-white rounded-xl text-xs font-bold shrink-0 transition active:scale-95 shadow-2xs flex items-center gap-1.5"
          >
            <Send className="w-3 h-3" /> WhatsApp Buyer
          </a>
        </div>
      )}

      {/* Order Items */}
      <div className="bg-white border border-[#E4E4E7] rounded-[28px] p-6 shadow-2xs space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">Order Items</h2>
        <div className="divide-y divide-[#E4E4E7]">
          {items.map((item, idx) => (
            <div key={idx} className="py-2.5 flex justify-between items-center text-xs">
              <div>
                <div className="font-bold text-[#18181B]">{item.title}</div>
                <div className="text-[11px] text-[#71717A]">Qty: {item.quantity || 1}</div>
              </div>
              <div className="font-black text-[#18181B]">{formatLKR(Number(item.price) * (item.quantity || 1))}</div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-[#E4E4E7] space-y-1 text-xs">
          <div className="flex justify-between text-[#71717A]">
            <span>Delivery Fee</span>
            <span>{order.delivery_fee === 0 ? <strong className="text-[#006241]">FREE</strong> : formatLKR(order.delivery_fee)}</span>
          </div>
          <div className="flex justify-between text-base font-black text-[#18181B] pt-1 border-t border-[#E4E4E7]">
            <span>Total</span>
            <span className="text-[#006241]">{formatLKR(order.total_amount)}</span>
          </div>
        </div>
      </div>

      {/* Delivery Destination */}
      <div className="bg-white border border-[#E4E4E7] rounded-[28px] p-6 shadow-2xs space-y-3">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#71717A]">Delivery Destination</h2>
        <div className="space-y-1 text-xs">
          <div className="font-bold text-[#18181B]">{order.customer_name}</div>
          <div className="font-mono text-[#71717A] font-bold flex items-center gap-2 flex-wrap">
            <span>Primary: {order.customer_phone}</span>
            {order.secondary_phone && (
              <span className="text-[#006241]">/ Secondary: {order.secondary_phone}</span>
            )}
          </div>
          <div className="text-[#18181B] font-medium pt-1">{displayLocation}</div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <a
            href={`tel:${order.customer_phone}`}
            className="py-2.5 bg-[#F4F4F5] hover:bg-stone-200 border border-[#E4E4E7] rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition"
          >
            <Phone className="w-3.5 h-3.5" /> Call Primary
          </a>

          {order.secondary_phone ? (
            <a
              href={`tel:${order.secondary_phone}`}
              className="py-2.5 bg-[#F4F4F5] hover:bg-stone-200 border border-[#E4E4E7] rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition"
            >
              <Phone className="w-3.5 h-3.5" /> Call Secondary
            </a>
          ) : (
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          )}
        </div>
      </div>

      {/* Fulfillment Actions */}
      {!isCanceled && !isDelivered && (
        <div className="space-y-2 pt-2">
          {order.status === 'received' && (
            <>
              {isAwaitingPayment ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center text-[11px] text-amber-800 font-bold flex items-center justify-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Confirm payment received above before packing this order.
                </div>
              ) : (
                <button
                  onClick={() => handleStatusAdvance('packed')}
                  disabled={updating}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl text-xs shadow-2xs transition active:scale-95 disabled:opacity-50"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Mark as Packed'}
                </button>
              )}
            </>
          )}

          {order.status === 'packed' && (
            <button
              onClick={() => setShowDispatchModal(true)}
              disabled={updating}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl text-xs shadow-2xs transition active:scale-95 disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Dispatch with Courier'}
            </button>
          )}

          {order.status === 'dispatched' && (
            <button
              onClick={() => handleStatusAdvance('delivered')}
              disabled={updating}
              className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs shadow-2xs transition active:scale-95 disabled:opacity-50"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (isCOD ? 'Mark as Delivered (Collected COD Cash)' : 'Mark as Delivered')}
            </button>
          )}

          <button
            onClick={handleCancelOrder}
            disabled={updating}
            className="w-full py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition active:scale-95 disabled:opacity-50"
          >
            Mark as Returned Order & Restock Items
          </button>
        </div>
      )}

      {/* DISPATCH DETAILS MODAL */}
      {showDispatchModal && (
        <div className="fixed inset-0 bg-[#18181B]/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] p-6 max-w-sm w-full shadow-2xl space-y-4 text-xs text-[#18181B]">
            <div className="flex justify-between items-center border-b border-[#E4E4E7] pb-3">
              <div>
                <h3 className="font-black text-sm">Dispatch Order #{order.order_code || id.slice(0, 4)}</h3>
                <p className="text-[11px] text-[#71717A]">Enter courier details for tracking</p>
              </div>
              <button onClick={() => setShowDispatchModal(false)} className="text-stone-400 hover:text-black">
                <XCircle className="w-5 h-5" />
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
                onClick={() => handleStatusAdvance('dispatched', {
                  courierName: selectedCourier,
                  trackingNumber: trackingNumber.trim()
                })}
                disabled={updating}
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl active:scale-95 transition mt-2 shadow-2xs"
              >
                {updating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT MODAL */}
      {showPrintModal && (
        <PrintManifestModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          orders={[order]}
          seller={seller}
        />
      )}
    </div>
  );
}