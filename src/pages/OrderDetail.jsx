import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  CheckCircle2,
  Truck,
  Loader2,
  XCircle,
  Printer,
  Landmark,
  AlertCircle,
  Package,
  PackageCheck,
  MapPin,
  Pencil,
  Share2,
  X,
  Check,
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  fetchOrderByUuid,
  updateOrderStatus,
  markOrderPaymentReceived,
  updateOrderAddressAsSeller,
  createBuyerFlag,
  formatLKR,
} from '../services/dbService';
import PrintManifestModal from '../components/PrintManifestModal';
import ReturnReasonModal from '../components/ReturnReasonModal';
import TrustReportCard from '../components/TrustReportCard';
import { notify } from '../components/Toast';
import { confirm } from '../components/ConfirmModal';

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

function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 172800) return 'yesterday';
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function absoluteTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/*  Determine current phase + actions                                  */
/* ------------------------------------------------------------------ */
function getOrderPhase(order) {
  const isCOD = !order.payment_method || order.payment_method === 'COD';
  const isBank = order.payment_method === 'Bank';
  const isAwaitingPayment = isBank && order.payment_status === 'Awaiting Payment';
  const isUnverified = isCOD && !order.buyer_confirmed;

  if (order.status === 'canceled') {
    return {
      tone: 'stone',
      label: 'Returned',
      icon: XCircle,
      nextStep: 'Order returned',
      nextStepDetail: 'Stock was restored to your inventory. Buyer was flagged on the network.',
      primaryAction: null,
      secondaryAction: null,
    };
  }
  if (order.status === 'delivered') {
    return {
      tone: 'emerald',
      label: 'Delivered',
      icon: CheckCircle2,
      nextStep: 'Delivered',
      nextStepDetail: 'This order is complete.',
      primaryAction: null,
      secondaryAction: null,
    };
  }
  if (order.status === 'dispatched') {
    return {
      tone: 'purple',
      label: 'On the Way',
      icon: Truck,
      nextStep: 'Waiting on the courier',
      nextStepDetail: order.courier_name
        ? `${order.courier_name}${order.tracking_number ? ` · Waybill ${order.tracking_number}` : ''}. Tap below when the buyer receives it.`
        : 'Tap below once the buyer receives it.',
      primaryAction: { label: 'Mark as Delivered', action: 'delivered', icon: CheckCircle2 },
      secondaryAction: null,
    };
  }
  if (order.status === 'packed') {
    return {
      tone: 'blue',
      label: 'Packed',
      icon: Package,
      nextStep: 'Hand the parcel to your courier',
      nextStepDetail: 'Add the courier name and waybill so the buyer can track delivery.',
      primaryAction: { label: 'Dispatch with Courier', action: 'dispatch', icon: Truck },
      secondaryAction: null,
    };
  }
  // received
  if (isAwaitingPayment) {
    return {
      tone: 'amber',
      label: 'Awaiting Payment',
      icon: Landmark,
      nextStep: 'Confirm payment received',
      nextStepDetail: `Verify Rs. ${Number(order.total_amount).toLocaleString('en-LK')} in your bank, then confirm below.`,
      primaryAction: { label: 'Confirm Payment Received', action: 'payment', icon: CheckCircle2 },
      secondaryAction: null,
    };
  }
  if (isUnverified) {
    return {
      tone: 'amber',
      label: 'Unverified',
      icon: MessageCircle,
      nextStep: 'Confirm the buyer',
      nextStepDetail: 'Send a WhatsApp link so the buyer confirms their delivery address. Skip this if you already know them.',
      primaryAction: { label: 'Send Confirmation', action: 'verify', icon: MessageCircle },
      secondaryAction: { label: 'Pack Now', action: 'packed', icon: PackageCheck },
    };
  }
  return {
    tone: 'emerald',
    label: 'Ready to Pack',
    icon: PackageCheck,
    nextStep: 'Pack the parcel',
    nextStepDetail: 'Buyer is verified. Pack the items and tap below to mark as packed.',
    primaryAction: { label: 'Mark as Packed', action: 'packed', icon: PackageCheck },
    secondaryAction: null,
  };
}

const TONE_STYLES = {
  amber: {
    wrapper: 'bg-amber-50 border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-700',
    titleColor: 'text-amber-900',
    subColor: 'text-amber-800',
    ctaBg: 'bg-amber-600 hover:bg-amber-700',
  },
  blue: {
    wrapper: 'bg-blue-50 border-blue-200',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-700',
    titleColor: 'text-blue-900',
    subColor: 'text-blue-800',
    ctaBg: 'bg-blue-600 hover:bg-blue-700',
  },
  purple: {
    wrapper: 'bg-purple-50 border-purple-200',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-700',
    titleColor: 'text-purple-900',
    subColor: 'text-purple-800',
    ctaBg: 'bg-purple-600 hover:bg-purple-700',
  },
  emerald: {
    wrapper: 'bg-[#E8F0E9] border-[#C2D6C5]',
    iconBg: 'bg-white',
    iconColor: 'text-[#006241]',
    titleColor: 'text-[#006241]',
    subColor: 'text-[#006241]/80',
    ctaBg: 'bg-[#006241] hover:bg-[#004F34]',
  },
  stone: {
    wrapper: 'bg-stone-100 border-stone-200',
    iconBg: 'bg-white',
    iconColor: 'text-stone-600',
    titleColor: 'text-stone-800',
    subColor: 'text-stone-500',
    ctaBg: 'bg-stone-600 hover:bg-stone-700',
  },
};

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */
function Section({ title, action, children }) {
  return (
    <div className="bg-white border border-[#E7EBE7] rounded-[20px] overflow-hidden">
      {title && (
        <div className="px-5 pt-4 pb-3 border-b border-[#E7EBE7] flex items-center justify-between">
          <h2 className="text-[11px] font-black uppercase tracking-wider text-[#5A655D]">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Timeline — real events only, colored by stage, aligned top-to-top  */
/* ------------------------------------------------------------------ */
const TIMELINE_DOT_TONES = {
  stone:   'bg-stone-400 border-stone-400',
  emerald: 'bg-emerald-500 border-emerald-500',
  blue:    'bg-blue-500 border-blue-500',
  purple:  'bg-purple-500 border-purple-500',
  brand:   'bg-[#006241] border-[#006241]',
  rose:    'bg-rose-500 border-rose-500',
};

function buildTimelineEvents(order) {
  const events = [];

  events.push({
    label: 'Order placed',
    time: order.created_at,
    tone: 'stone',
  });

  if (order.buyer_confirmed_at) {
    events.push({
      label: 'Buyer confirmed delivery details',
      time: order.buyer_confirmed_at,
      tone: 'emerald',
    });
  }

  if (order.packed_at) {
    events.push({
      label: 'Packed',
      time: order.packed_at,
      tone: 'blue',
    });
  }

  if (order.dispatched_at) {
    events.push({
      label: 'Dispatched',
      time: order.dispatched_at,
      subtitle: order.courier_name
        ? `${order.courier_name}${order.tracking_number ? ` · ${order.tracking_number}` : ''}`
        : null,
      tone: 'purple',
    });
  }

  if (order.delivered_at) {
    events.push({
      label: 'Delivered',
      time: order.delivered_at,
      tone: 'brand',
    });
  }

  if (order.status === 'canceled') {
    events.push({
      label: 'Marked as returned',
      time: null,
      tone: 'rose',
    });
  }

  return events;
}

function Timeline({ order }) {
  const events = buildTimelineEvents(order);

  return (
    <div>
      {events.map((e, i) => {
        const isLast = i === events.length - 1;
        const dotClass = TIMELINE_DOT_TONES[e.tone] || TIMELINE_DOT_TONES.stone;

        return (
          <div key={i} className="flex gap-3">
            {/* Dot column — connector stretches from below the dot to the bottom of the row */}
            <div className="shrink-0 w-4 flex flex-col items-center">
              <div className={`w-4 h-4 rounded-full border-2 ${dotClass} shrink-0`} />
              {!isLast && <div className="w-px flex-1 bg-[#E7EBE7]" />}
            </div>

            {/* Content column — label and dot are both 16px tall, aligned at the top */}
            <div className={`flex-1 min-w-0 ${isLast ? '' : 'pb-5'}`}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold text-[#111813] leading-4">
                  {e.label}
                </span>
                {e.time && (
                  <span
                    className="text-[11px] text-stone-400 tabular-nums shrink-0 leading-4"
                    title={absoluteTime(e.time)}
                  >
                    {relativeTime(e.time)}
                  </span>
                )}
              </div>
              {e.subtitle && (
                <div className="text-[11px] text-[#5A655D] mt-1 leading-4">
                  {e.subtitle}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export default function OrderDetail({ seller }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const [selectedCourier, setSelectedCourier] = useState(SRI_LANKAN_COURIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState('');

  // Edit-customer state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSecondary, setEditSecondary] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDistrict, setEditDistrict] = useState('Colombo');
  const [editError, setEditError] = useState('');

  const loadOrder = async () => {
    try {
      setLoading(true);
      const data = await fetchOrderByUuid(id);
      setOrder(data);
      if (data?.courier_name) setSelectedCourier(data.courier_name);
      if (data?.tracking_number) setTrackingNumber(data.tracking_number);
    } catch (err) {
      notify(err.message || 'Failed to load order', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* Realtime */
  useEffect(() => {
    if (!id) return;
    let isMounted = true;
    const channelName = `order-rt-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
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

  /* ---------- Handlers ---------- */

  const handleStatusAdvance = async (nextStatus, extraData = {}) => {
    const snapshot = { ...order };
    setOrder((prev) => ({
      ...prev,
      status: nextStatus,
      ...(nextStatus === 'packed' ? { packed_at: new Date().toISOString() } : {}),
      ...(nextStatus === 'dispatched' && extraData.courierName
        ? {
            courier_name: extraData.courierName,
            tracking_number: extraData.trackingNumber || prev.tracking_number,
            dispatched_at: new Date().toISOString(),
          }
        : {}),
      ...(nextStatus === 'delivered'
        ? {
            delivered_at: new Date().toISOString(),
            payment_status: 'Paid',
            cod_balance: 0,
          }
        : {}),
    }));
    setUpdating(true);

    try {
      const updated = await updateOrderStatus(order.id, nextStatus, extraData);
      setOrder((prev) => ({ ...prev, ...updated }));
      notify(`Order marked as ${nextStatus}.`);
      if (nextStatus === 'dispatched') setShowDispatchModal(false);
    } catch (err) {
      setOrder(snapshot);
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
      notify('Payment confirmed. Order is ready to pack.');
    } catch (err) {
      notify('Failed to confirm payment: ' + err.message, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkDelivered = async () => {
    const isCOD = !order.payment_method || order.payment_method === 'COD';
    const ok = await confirm({
      title: 'Confirm delivery',
      message: isCOD
        ? `Has the buyer received this order?\n\nCOD amount: ${formatLKR(order.total_amount)}\n\nThis closes the order as complete.`
        : 'Has the buyer received this order?\n\nThis closes the order as complete.',
      confirmLabel: 'Yes, delivered',
      cancelLabel: 'Not yet',
      tone: 'default',
    });
    if (!ok) return;
    await handleStatusAdvance('delivered');
  };

  const handleConfirmReturn = async ({ reason, note }) => {
    setSubmittingReturn(true);
    try {
      const items = Array.isArray(order.items) ? order.items : [];
      // Atomic restore via RPC — safe against concurrent writes
      for (const item of items) {
        if (item.id) {
          await supabase.rpc('restore_product_stock', {
            p_product_id: item.id,
            p_quantity: Number(item.quantity) || 1,
          });
        }
      }

      const updated = await updateOrderStatus(order.id, 'canceled');

      try {
        await createBuyerFlag({
          sellerId: order.seller_id,
          orderId: order.id,
          phone: order.customer_phone,
          reason,
          note,
        });
      } catch (flagErr) {
        console.warn('Flag creation failed:', flagErr.message);
      }

      setOrder((prev) => ({ ...prev, ...updated }));
      setShowReturnModal(false);
      notify('Order returned. Buyer number flagged.');
    } catch (err) {
      notify('Failed to update: ' + err.message, 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleOpenEdit = () => {
    setEditName(order.customer_name || '');
    setEditPhone(order.customer_phone || '');
    setEditSecondary(order.secondary_phone || '');
    setEditAddress(order.delivery_address || '');
    setEditCity(order.city || '');
    setEditDistrict(SL_DISTRICTS.includes(order.district) ? order.district : 'Colombo');
    setEditError('');
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editName.trim()) { setEditError('Please enter a name.'); return; }
    if (!editPhone.trim()) { setEditError('Please enter a phone number.'); return; }
    if (!editAddress.trim()) { setEditError('Please enter a delivery address.'); return; }
    if (!editCity.trim()) { setEditError('Please enter a city / town.'); return; }

    setSavingEdit(true);
    try {
      const updated = await updateOrderAddressAsSeller(order.id, {
        customerName: editName,
        customerPhone: editPhone,
        secondaryPhone: editSecondary,
        deliveryAddress: editAddress,
        city: editCity,
        district: editDistrict,
      });
      setOrder((prev) => ({ ...prev, ...updated }));
      setShowEditModal(false);
      notify('Customer details updated.');
    } catch (err) {
      setEditError(err.message || 'Failed to update address.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCopyTrackingLink = async () => {
    const url = `${window.location.origin}/order/${order.id}?t=${order.verification_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      notify('Tracking link copied.');
      setTimeout(() => setCopiedLink(false), 2200);
    } catch {
      window.prompt('Copy tracking link:', url);
    }
  };

  const handleAction = (actionName) => {
    if (actionName === 'packed') return handleStatusAdvance('packed');
    if (actionName === 'dispatch') return setShowDispatchModal(true);
    if (actionName === 'delivered') return handleMarkDelivered();
    if (actionName === 'payment') return handleMarkPaymentReceived();
    if (actionName === 'verify') {
      const cleanPhone = order.customer_phone.replace(/[^0-9]/g, '').replace(/^0/, '94');
      const url = `${window.location.origin}/order/${order.id}?t=${order.verification_token}`;
      const msg = `Hi ${order.customer_name}! Please tap to confirm your order #${order.order_code || order.id.slice(0, 4)} from ${seller?.shop_name || 'our store'}:\n\n${url}`;
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  };

  /* ---------- Guards ---------- */

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
        <div className="bg-white p-6 rounded-2xl border border-[#E7EBE7] text-center space-y-3 max-w-xs">
          <p className="text-sm text-[#5A655D]">Order not found.</p>
          <button
            onClick={() => navigate('/')}
            className="text-xs font-bold text-[#006241] hover:underline cursor-pointer"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    );
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const cleanPhone = order.customer_phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
  const isCOD = !order.payment_method || order.payment_method === 'COD';
  const isBank = order.payment_method === 'Bank';
  const isPaid = order.payment_status === 'Paid';
  const isCanceled = order.status === 'canceled';
  const isTerminal = isCanceled || order.status === 'delivered';
  const canEdit = order.status === 'received';
  const cleanOrderCode = order.order_code || order.id.slice(0, 4);

  const phase = getOrderPhase(order);
  const phaseTone = TONE_STYLES[phase.tone] || TONE_STYLES.stone;
  const PhaseIcon = phase.icon;

  const locationParts = [order.delivery_address, order.city].filter(Boolean);

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-40 text-[#111813]">

      {/* ============ HEADER ============ */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-xs font-bold text-[#5A655D] hover:text-[#111813] transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyTrackingLink}
            className="p-2 bg-white border border-[#E7EBE7] hover:border-stone-400 rounded-xl text-[#5A655D] hover:text-[#006241] transition active:scale-95 cursor-pointer"
            title="Copy buyer tracking link"
            aria-label="Copy buyer tracking link"
          >
            {copiedLink ? <Check className="w-4 h-4 text-[#006241]" /> : <Share2 className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowPrintModal(true)}
            className="p-2 bg-white border border-[#E7EBE7] hover:border-stone-400 rounded-xl text-[#5A655D] hover:text-[#111813] transition active:scale-95 cursor-pointer"
            title="Print AWB label"
            aria-label="Print AWB label"
          >
            <Printer className="w-4 h-4" />
          </button>
          <span className="font-mono font-black text-sm ml-1">#{cleanOrderCode}</span>
        </div>
      </div>

      {/* ============ NEXT STEP CARD ============ */}
      {!isTerminal && (
        <div className={`border rounded-[24px] p-5 ${phaseTone.wrapper}`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-xl ${phaseTone.iconBg} flex items-center justify-center shrink-0`}>
              <PhaseIcon className={`w-5 h-5 ${phaseTone.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className={`text-[10px] font-bold uppercase tracking-wider ${phaseTone.subColor}`}>
                {phase.primaryAction ? 'Next step' : 'Status'}
              </div>
              <div className={`font-black text-sm mt-0.5 ${phaseTone.titleColor}`}>
                {phase.nextStep}
              </div>
              <div className={`text-[11px] mt-1 leading-relaxed ${phaseTone.subColor}`}>
                {phase.nextStepDetail}
              </div>
            </div>
          </div>

          {/* Primary + optional secondary — desktop only (mobile uses sticky below) */}
          {(phase.primaryAction || phase.secondaryAction) && (
            <div className={`hidden md:grid mt-4 gap-2 ${phase.secondaryAction ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {phase.primaryAction && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleAction(phase.primaryAction.action)}
                  className={`py-3 text-white font-bold rounded-2xl text-xs transition active:scale-[0.98] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 ${phaseTone.ctaBg}`}
                >
                  {updating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <phase.primaryAction.icon className="w-4 h-4" />
                      {phase.primaryAction.label}
                    </>
                  )}
                </button>
              )}
              {phase.secondaryAction && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleAction(phase.secondaryAction.action)}
                  className="py-3 bg-white hover:bg-stone-50 border-2 border-[#111813]/15 hover:border-[#111813]/30 text-[#111813] font-bold rounded-2xl text-xs transition active:scale-[0.98] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
                >
                  <phase.secondaryAction.icon className="w-4 h-4" />
                  {phase.secondaryAction.label}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ TRUST REPORT ============ */}
      {!isCanceled && order.customer_phone && (
        <TrustReportCard phone={order.customer_phone} />
      )}

      {/* ============ ORDER SUMMARY (with items inline) ============ */}
      <Section>
        {/* Amount + payment method */}
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-2xl font-black text-[#006241]">
            {formatLKR(order.total_amount)}
          </div>
          <div className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
            isCanceled
              ? 'bg-stone-100 text-stone-600 border-stone-200'
              : isCOD
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
          }`}>
            {isCOD ? 'Cash on Delivery' : 'Bank Transfer'}
          </div>
        </div>

        {/* Items inline */}
        {items.length > 0 && (
          <div className="mt-4 space-y-2.5">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start justify-between gap-3 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[#111813] leading-snug">{item.title}</div>
                  <div className="text-[11px] text-[#5A655D] mt-0.5">
                    {item.quantity || 1} × {formatLKR(item.price)}
                  </div>
                </div>
                <div className="font-black text-[#111813] shrink-0 font-mono">
                  {formatLKR(Number(item.price) * (item.quantity || 1))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Financial breakdown */}
        <div className="mt-4 pt-4 border-t border-[#E7EBE7] space-y-1.5 text-xs">
          <div className="flex justify-between text-[#5A655D]">
            <span>Subtotal</span>
            <span className="font-semibold">{formatLKR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-[#5A655D]">
            <span>Delivery Fee</span>
            <span className="font-semibold">
              {Number(order.delivery_fee) === 0
                ? <span className="text-[#006241] font-black uppercase">FREE</span>
                : formatLKR(order.delivery_fee)}
            </span>
          </div>
          {isBank && isPaid && (
            <div className="flex justify-between text-[#006241] pt-2 border-t border-[#E7EBE7]">
              <span className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Payment Received
              </span>
              <span className="font-mono text-[11px]">
                {order.payment_confirmed_at ? relativeTime(order.payment_confirmed_at) : ''}
              </span>
            </div>
          )}
        </div>
      </Section>

      {/* ============ TIMELINE ============ */}
      <Section title="Activity">
        <Timeline order={order} />
      </Section>

      {/* ============ DELIVERY TO ============ */}
      <Section
        title="Delivery To"
        action={canEdit && (
          <button
            onClick={handleOpenEdit}
            className="text-[11px] font-bold text-[#006241] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Pencil className="w-3 h-3" /> Edit
          </button>
        )}
      >
        <div className="space-y-3">
          <div>
            <div className="font-bold text-sm text-[#111813]">{order.customer_name}</div>
            <div className="font-mono text-xs text-[#5A655D] mt-0.5">
              {order.customer_phone}
              {order.secondary_phone && <span className="ml-2 text-[#006241]">· {order.secondary_phone}</span>}
            </div>
          </div>

          <div className="text-xs text-[#111813] leading-relaxed flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
            <span>
              {locationParts.join(', ')}
              {order.district && <span className="text-[#5A655D]"> ({order.district})</span>}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              href={`tel:${order.customer_phone}`}
              className="py-2.5 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
            <a
              href={`https://wa.me/${cleanPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-xl text-xs font-bold text-center flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
            </a>
          </div>
        </div>
      </Section>

      {/* ============ DANGER ZONE ============ */}
      {!isTerminal && (
        <div className="pt-1">
          <button
            onClick={() => setShowReturnModal(true)}
            disabled={updating || submittingReturn}
            className="w-full py-3 bg-white hover:bg-rose-50 border border-[#E7EBE7] hover:border-rose-200 text-rose-600 font-bold rounded-2xl text-xs transition active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" /> Mark as Returned & Restock
          </button>
        </div>
      )}

      {/* ============ MOBILE STICKY ACTION ============ */}
      {!isTerminal && (phase.primaryAction || phase.secondaryAction) && (
        <div className="md:hidden fixed bottom-24 left-4 right-4 z-40 pointer-events-none">
          <div className={`grid gap-2 pointer-events-auto ${phase.secondaryAction ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {phase.primaryAction && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleAction(phase.primaryAction.action)}
                className={`py-3.5 text-white font-bold rounded-2xl text-xs transition active:scale-[0.98] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 shadow-lg ${phaseTone.ctaBg}`}
              >
                {updating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <phase.primaryAction.icon className="w-4 h-4" />
                    {phase.primaryAction.label}
                  </>
                )}
              </button>
            )}
            {phase.secondaryAction && (
              <button
                type="button"
                disabled={updating}
                onClick={() => handleAction(phase.secondaryAction.action)}
                className="py-3.5 bg-white hover:bg-stone-50 border-2 border-[#111813]/15 text-[#111813] font-bold rounded-2xl text-xs transition active:scale-[0.98] disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2 shadow-lg"
              >
                <phase.secondaryAction.icon className="w-4 h-4" />
                {phase.secondaryAction.label}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============ DISPATCH MODAL ============ */}
      {showDispatchModal && (
        <div className="fixed inset-x-0 top-0 h-[100dvh] bg-[#111813]/70 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-[28px] p-6 max-w-sm w-full shadow-2xl space-y-4 text-xs text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
              <div>
                <h3 className="font-black text-sm">Dispatch Order #{cleanOrderCode}</h3>
                <p className="text-[11px] text-[#5A655D] mt-0.5">Courier details for buyer tracking</p>
              </div>
              <button
                onClick={() => setShowDispatchModal(false)}
                className="text-stone-400 hover:text-black p-1 -m-1 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#5A655D] mb-1.5">Courier Company</label>
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-semibold outline-none transition cursor-pointer"
                >
                  {SRI_LANKAN_COURIERS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[11px] uppercase tracking-wider text-[#5A655D] mb-1.5">Tracking / Waybill No.</label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="e.g. KMB-99824"
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-mono font-bold outline-none transition placeholder:text-stone-400 placeholder:font-normal"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleStatusAdvance('dispatched', {
                courierName: selectedCourier,
                trackingNumber: trackingNumber.trim(),
              })}
              disabled={updating}
              className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
            >
              {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Dispatch'}
            </button>
          </div>
        </div>
      )}

      {/* ============ EDIT CUSTOMER MODAL ============ */}
      {showEditModal && (
        <div className="fixed inset-x-0 top-0 h-[100dvh] bg-[#111813]/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto scroll-pb-40 text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
              <h3 className="font-black text-sm">Edit Customer Details</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-stone-400 hover:text-black p-1 -m-1 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-[#5A655D] leading-relaxed">
              Fix a typo or update the delivery address. Only possible while the order is new.
            </p>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-medium outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">WhatsApp Number *</label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-mono font-bold outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Backup Phone</label>
                <input
                  type="tel"
                  value={editSecondary}
                  onChange={(e) => setEditSecondary(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-mono font-medium outline-none transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">District *</label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-bold cursor-pointer outline-none transition"
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
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl outline-none transition"
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
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl outline-none transition"
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
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs active:scale-95 transition shadow-xs disabled:opacity-50 mt-1 flex items-center justify-center gap-2 cursor-pointer"
              >
                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Details'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============ MODALS ============ */}
      {showPrintModal && (
        <PrintManifestModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          orders={[order]}
          seller={seller}
        />
      )}

      <ReturnReasonModal
        isOpen={showReturnModal}
        order={order}
        onClose={() => setShowReturnModal(false)}
        onConfirm={handleConfirmReturn}
        submitting={submittingReturn}
      />
    </div>
  );
}