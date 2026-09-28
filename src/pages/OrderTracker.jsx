import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Store,
  CheckCircle2,
  Truck,
  Loader2,
  MessageCircle,
  Pencil,
  X,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import {
  fetchOrderByUuid,
  confirmOrderAsBuyer,
  updateBuyerOrderAddress,
  cancelOrderAsBuyer,
  formatLKR,
} from '../services/dbService';
import { supabase } from '../supabase';

// Official 25 Administrative Districts of Sri Lanka
const SL_DISTRICTS = [
  'Colombo', 'Gampaha', 'Kalutara',
  'Kandy', 'Matale', 'Nuwara Eliya',
  'Galle', 'Matara', 'Hambantota',
  'Jaffna', 'Kilinochchi', 'Mannar', 'Vavuniya', 'Mullaitivu',
  'Batticaloa', 'Ampara', 'Trincomalee',
  'Kurunegala', 'Puttalam',
  'Anuradhapura', 'Polonnaruwa',
  'Badulla', 'Monaragala',
  'Ratnapura', 'Kegalle'
];

export default function OrderTracker() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  // Edit-address modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSecondary, setEditSecondary] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDistrict, setEditDistrict] = useState('Colombo');

  // Cancel-order modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [canceling, setCanceling] = useState(false);

  // Success banner
  const [successMsg, setSuccessMsg] = useState('');

  /* ---------------------------------------------------------------- */
  /*  Load order                                                       */
  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /*  Realtime — reflect seller actions live                           */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const channelName = `tracker-rt-${id}-${Date.now()}-${Math.random()
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

  /* ---------------------------------------------------------------- */
  /*  Auto-dismiss success banner                                      */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 4500);
    return () => clearTimeout(t);
  }, [successMsg]);

  /* ---------------------------------------------------------------- */
  /*  Buyer confirm                                                    */
  /* ---------------------------------------------------------------- */
  const handleBuyerConfirm = async () => {
    setConfirming(true);
    try {
      const updated = await confirmOrderAsBuyer(order.id);
      setOrder((prev) => ({ ...prev, ...updated }));
      setSuccessMsg('Order confirmed! The seller is now preparing your delivery.');
    } catch (err) {
      alert(err.message || 'Failed to confirm order');
    } finally {
      setConfirming(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Edit delivery details                                            */
  /* ---------------------------------------------------------------- */
  const openEditModal = () => {
    setEditName(order.customer_name || '');
    setEditPhone(order.customer_phone || '');
    setEditSecondary(order.secondary_phone || '');
    setEditAddress(order.delivery_address || '');
    setEditCity(order.city || '');
    setEditDistrict(
      SL_DISTRICTS.includes(order.district) ? order.district : 'Colombo'
    );
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editName.trim()) {
      setEditError('Please enter a name.');
      return;
    }
    if (!editPhone.trim()) {
      setEditError('Please enter a phone number.');
      return;
    }
    if (!editAddress.trim()) {
      setEditError('Please enter a delivery address.');
      return;
    }
    if (!editCity.trim()) {
      setEditError('Please enter a city / town.');
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateBuyerOrderAddress(order.id, {
        customerName: editName,
        customerPhone: editPhone,
        secondaryPhone: editSecondary,
        deliveryAddress: editAddress,
        city: editCity,
        district: editDistrict,
      });
      setOrder((prev) => ({ ...prev, ...updated }));
      setShowEditModal(false);
      setSuccessMsg('Delivery details updated. The seller has been notified.');
    } catch (err) {
      setEditError(err.message || 'Failed to update address.');
    } finally {
      setSavingEdit(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Cancel order                                                     */
  /* ---------------------------------------------------------------- */
  const handleCancelOrder = async () => {
    setCanceling(true);
    try {
      const updated = await cancelOrderAsBuyer(order.id);
      setOrder((prev) => ({ ...prev, ...updated }));
      setShowCancelModal(false);
      setSuccessMsg('Order canceled. Stock has been returned to the seller.');
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
      setShowCancelModal(false);
    } finally {
      setCanceling(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Loading / not found                                              */
  /* ---------------------------------------------------------------- */
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

  const isCanceled = order.status === 'canceled';
  const isBank = order.payment_method === 'Bank';
  const isBankPaid = isBank && order.payment_status === 'Paid';
  const canSelfService = order.status === 'received';
  const canConfirm = !order.buyer_confirmed && !isCanceled && order.status !== 'delivered';

  const getStepActive = (stepName) => {
    const steps = ['received', 'packed', 'dispatched', 'delivered'];
    if (isCanceled) return false;
    return steps.indexOf(stepName) <= steps.indexOf(order.status);
  };

  const sellerWaMsg = `Hi ${seller?.shop_name || 'there'}, I have a question about my order #${order.order_code || order.id.slice(0, 4)}.`;

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] font-sans pb-16">
      {/* Top Mini Header */}
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

      {/* Success banner */}
      {successMsg && (
        <div className="max-w-md mx-auto px-4 pt-3">
          <div className="bg-[#E8F0E9] border border-[#C2D6C5] rounded-2xl p-3 text-xs font-bold text-[#006241] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto px-4 space-y-4 pt-4">
        {/* Status Card */}
        <div className="bg-white border border-[#E7EBE7] rounded-[32px] p-6 shadow-xs text-center space-y-4">
          <div className={`w-14 h-14 rounded-3xl flex items-center justify-center mx-auto ${
            isCanceled ? 'bg-rose-50 text-rose-600' : 'bg-[#E8F0E9] text-[#006241]'
          }`}>
            {isCanceled ? <XCircle className="w-7 h-7" /> : <Truck className="w-7 h-7" />}
          </div>

          <div>
            <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">
              {isCanceled ? 'Order Canceled' : 'Order Status'}
            </span>
            <h1 className="text-2xl font-black mt-0.5">#{order.order_code || order.id.slice(0, 4)}</h1>
            <p className="text-xs text-[#5A655D] mt-1">
              Placed on {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>

          {/* 4-Stage Pipeline */}
          {!isCanceled && (
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
          )}

          {/* Courier Details Banner */}
          {order.status === 'dispatched' && order.courier_name && (
            <div className="bg-[#F4F6F4] rounded-2xl p-3 text-xs space-y-1 text-left border border-[#E7EBE7]">
              <div className="font-bold text-[#111813]">Courier: {order.courier_name}</div>
              <div className="text-[#5A655D] font-mono">Waybill: <strong>{order.tracking_number || 'In Transit'}</strong></div>
            </div>
          )}
        </div>

        {/* Canceled Note */}
        {isCanceled && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center text-xs text-rose-800 space-y-1">
            <p className="font-bold">This order was canceled.</p>
            {isBankPaid && (
              <p className="text-[11px] font-normal leading-relaxed">
                You've already transferred the payment. Please contact the seller to arrange a refund.
              </p>
            )}
          </div>
        )}

        {/* Buyer Verification CTA */}
        {canConfirm && (
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

        {/* Buyer self-service: Edit / Cancel */}
        {canSelfService && (
          <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-5 shadow-xs space-y-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">
              Need to make a change?
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openEditModal}
                className="py-2.5 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] rounded-xl text-xs font-bold text-[#111813] flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit Details
              </button>
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="py-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel Order
              </button>
            </div>
          </div>
        )}

        {/* Hint once packed/dispatched */}
        {(order.status === 'packed' || order.status === 'dispatched') && cleanSellerWa && (
          <div className="text-center text-[11px] text-[#5A655D] py-1">
            Need a change?{' '}
            <a
              href={`https://wa.me/${cleanSellerWa}?text=${encodeURIComponent(sellerWaMsg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#006241] hover:underline"
            >
              Message the seller on WhatsApp →
            </a>
          </div>
        )}

        {/* Order Items */}
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
              <span>{isBank ? 'Amount (Bank Transfer)' : 'Amount Due on Delivery (COD)'}</span>
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

        {/* WhatsApp Support */}
        {seller?.whatsapp_number && (
          <div className="text-center pt-2">
            <a
              href={`https://wa.me/${cleanSellerWa}?text=${encodeURIComponent(sellerWaMsg)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#006241] hover:underline"
            >
              <MessageCircle className="w-4 h-4" /> Need help? Message store on WhatsApp
            </a>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/*  EDIT DELIVERY DETAILS MODAL                                  */}
      {/* ============================================================ */}
      {showEditModal && (
        <div className="fixed inset-x-0 top-0 h-[100dvh] bg-[#111813]/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto scroll-pb-40 text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
              <h3 className="font-black text-sm">Edit Delivery Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-stone-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-[#5A655D] leading-relaxed">
              Fix a typo or update your delivery details. The seller will be notified of any change.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">WhatsApp Number *</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Backup Phone (Optional)</label>
                <input
                  type="tel"
                  value={editSecondary}
                  onChange={(e) => setEditSecondary(e.target.value)}
                  placeholder="Only if WhatsApp is busy"
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">District *</label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold text-xs"
                  >
                    {SL_DISTRICTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">City / Town *</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Delivery Address *</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
                />
              </div>

              {editError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={savingEdit}
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs active:scale-95 transition shadow-xs disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Delivery Details'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/*  CANCEL ORDER CONFIRMATION MODAL                              */}
      {/* ============================================================ */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-[#111813]/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-sm rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 text-[#111813]">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto">
                <AlertCircle className="w-7 h-7 text-rose-600" />
              </div>
              <h3 className="font-black text-base">Cancel this order?</h3>
              <p className="text-xs text-[#5A655D] leading-relaxed">
                The seller will be notified and any reserved stock will be returned to their inventory.
              </p>
              {isBankPaid && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 text-left leading-relaxed">
                  <strong>Note:</strong> You've already transferred payment for this order. Please contact the seller directly to arrange a refund.
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={canceling}
                className="py-3 bg-[#F4F6F4] hover:bg-stone-200 text-[#111813] rounded-2xl text-xs font-bold active:scale-95 transition disabled:opacity-50"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={handleCancelOrder}
                disabled={canceling}
                className="py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {canceling ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}