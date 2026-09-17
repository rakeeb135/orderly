import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Store,
  Loader2,
  ShieldCheck,
  Truck,
  MessageCircle,
  Plus,
  Minus,
  Landmark,
  AlertCircle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import {
  fetchSellerByHandle,
  fetchProductBySlug,
  createOrder,
  triggerPushNotification,
  formatLKR,
} from '../services/dbService';

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

const BUYER_STORAGE_KEY = 'ordy_buyer_profile';

export default function QuickOrder() {
  const { handle, slug } = useParams();

  const [seller, setSeller] = useState(null);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Currently-configured variant + quantity (for the "Add to Order" button)
  const [chosenSize, setChosenSize] = useState(null);
  const [chosenColor, setChosenColor] = useState(null);
  const [chosenQty, setChosenQty] = useState(1);
  const [variantError, setVariantError] = useState('');
  const [justAdded, setJustAdded] = useState(false);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  // Multi-selection cart — buyer can add multiple size/color combinations
  const [selections, setSelections] = useState([]);

  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');

  const [placing, setPlacing] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);
  const [formError, setFormError] = useState('');

  /* ---------------------------------------------------------------- */
  /*  Load seller + product                                            */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setNotFound(false);
        const s = await fetchSellerByHandle(handle);
        if (!s || s.is_active === false) {
          setNotFound(true);
          return;
        }
        setSeller(s);

        const p = await fetchProductBySlug(s.id, slug);
        if (!p) {
          setNotFound(true);
          return;
        }
        setProduct(p);

        const variants = p.variants || [];
        const sizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
        const colors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));
        if (sizes.length === 1) setChosenSize(sizes[0]);
        if (colors.length === 1) setChosenColor(colors[0]);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [handle, slug]);

  /* ---------------------------------------------------------------- */
  /*  Autofill buyer profile                                           */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(BUYER_STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.name) setName(data.name);
        if (data.phone) setPhone(data.phone);
        if (data.secondaryPhone) setSecondaryPhone(data.secondaryPhone);
        if (data.address) setAddress(data.address);
        if (data.district && SL_DISTRICTS.includes(data.district)) setDistrict(data.district);
        if (data.city) setCity(data.city);
      }
    } catch {
      /* ignore */
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Bank details availability                                        */
  /* ---------------------------------------------------------------- */
  const hasBankDetails = Boolean(
    seller?.bank_details?.bank_name?.trim() &&
    seller?.bank_details?.account_name?.trim() &&
    seller?.bank_details?.account_number?.trim()
  );

  useEffect(() => {
    if (!hasBankDetails && paymentMethod === 'Bank') setPaymentMethod('COD');
  }, [hasBankDetails, paymentMethod]);

  /* ---------------------------------------------------------------- */
  /*  Variant options                                                  */
  /* ---------------------------------------------------------------- */
  const modalSizes = useMemo(() => {
    const variants = product?.variants || [];
    return Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
  }, [product]);

  const modalColors = useMemo(() => {
    const variants = product?.variants || [];
    return Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));
  }, [product]);

  /* ---------------------------------------------------------------- */
  /*  Auto-clear "just added" indicator                                */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1800);
    return () => clearTimeout(t);
  }, [justAdded]);

  /* ---------------------------------------------------------------- */
  /*  Add current variant/qty to the selections cart                   */
  /* ---------------------------------------------------------------- */
  const handleAddSelection = () => {
    if (!product) return;

    if (modalSizes.length > 0 && !chosenSize) {
      setVariantError('Please select a size first.');
      return;
    }
    if (modalColors.length > 0 && !chosenColor) {
      setVariantError('Please select a color first.');
      return;
    }
    setVariantError('');

    let variantTitle = '';
    if (chosenSize && chosenColor) variantTitle = ` (${chosenSize} / ${chosenColor})`;
    else if (chosenSize) variantTitle = ` (${chosenSize})`;
    else if (chosenColor) variantTitle = ` (${chosenColor})`;

    const qtyToAdd = Math.max(1, Number(chosenQty) || 1);
    const itemKey = `${product.id}-${chosenSize || ''}-${chosenColor || ''}`;

    setSelections((prev) => {
      const idx = prev.findIndex((s) => s.itemKey === itemKey);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qtyToAdd };
        return next;
      }
      return [
        ...prev,
        {
          itemKey,
          id: product.id,
          title: `${product.title}${variantTitle}`,
          baseTitle: product.title,
          price: Number(product.price),
          quantity: qtyToAdd,
          size: chosenSize,
          color: chosenColor,
          free_delivery: Boolean(product.free_delivery),
        },
      ];
    });

    setChosenQty(1);
    setJustAdded(true);
  };

  const handleRemoveSelection = (itemKey) => {
    setSelections((prev) => prev.filter((s) => s.itemKey !== itemKey));
  };

  const handleUpdateSelectionQty = (itemKey, delta) => {
    setSelections((prev) =>
      prev
        .map((s) => {
          if (s.itemKey !== itemKey) return s;
          const nextQty = s.quantity + delta;
          return nextQty > 0 ? { ...s, quantity: nextQty } : null;
        })
        .filter(Boolean)
    );
  };

  /* ---------------------------------------------------------------- */
  /*  Delivery fee                                                     */
  /* ---------------------------------------------------------------- */
  const selectionsSubtotal = selections.reduce(
    (sum, s) => sum + Number(s.price) * s.quantity,
    0
  );

  const allItemsFreeDelivery =
    selections.length > 0 && selections.every((s) => s.free_delivery);

  let calculatedDeliveryFee = 0;
  let deliveryFeeStatus = 'pending';

  if (selections.length === 0) {
    calculatedDeliveryFee = 0;
  } else if (allItemsFreeDelivery) {
    calculatedDeliveryFee = 0;
    deliveryFeeStatus = 'free';
  } else if (!district) {
    calculatedDeliveryFee = 0;
    deliveryFeeStatus = 'pending';
  } else {
    const isLocal =
      district.toLowerCase() === (seller?.home_district || 'colombo').toLowerCase();
    calculatedDeliveryFee = isLocal
      ? Number(seller?.delivery_fee) || 350
      : Number(seller?.outstation_delivery_fee) || 450;
    deliveryFeeStatus = 'calculated';
  }

  const grandTotal = selectionsSubtotal + calculatedDeliveryFee;

  /* ---------------------------------------------------------------- */
  /*  Place order                                                      */
  /* ---------------------------------------------------------------- */
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!product || !seller) return;

    if (selections.length === 0) {
      setFormError('Add at least one item to your order first.');
      return;
    }
    if (!name.trim()) {
      setFormError('Please enter your name.');
      return;
    }
    if (!phone.trim()) {
      setFormError('Please enter your phone number.');
      return;
    }
    if (!district) {
      setFormError('Please select your district.');
      return;
    }
    if (!city.trim()) {
      setFormError('Please enter your city / town.');
      return;
    }
    if (!address.trim()) {
      setFormError('Please enter your delivery address.');
      return;
    }

    setPlacing(true);

    try {
      // Strip UI-only fields before sending to backend
      const orderItems = selections.map((s) => ({
        id: s.id,
        title: s.title,
        price: Number(s.price),
        quantity: Number(s.quantity),
        free_delivery: Boolean(s.free_delivery),
      }));

      const order = await createOrder({
        sellerId: seller.id,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        secondaryPhone: secondaryPhone.trim(),
        deliveryAddress: address.trim(),
        city: city.trim(),
        district: district.trim(),
        items: orderItems,
        deliveryFee: calculatedDeliveryFee,
        paymentMethod,
        source: 'quick_order',
      });

      try {
        localStorage.setItem(
          BUYER_STORAGE_KEY,
          JSON.stringify({
            name: name.trim(),
            phone: phone.trim(),
            secondaryPhone: secondaryPhone.trim(),
            address: address.trim(),
            district: district.trim(),
            city: city.trim(),
          })
        );
      } catch {
        /* non-blocking */
      }

      setPlacedOrder(order);

      const pushMessage =
        order.payment_method === 'Bank'
          ? `${order.customer_name} placed a Bank Transfer quick order for ${formatLKR(order.total_amount)} — awaiting payment`
          : `${order.customer_name} placed a quick order for ${formatLKR(order.total_amount)}`;

      triggerPushNotification(seller.id, {
        title: `New Order #${order.order_code || order.id.slice(0, 4)}`,
        message: pushMessage,
        link: `/orders/${order.id}`,
        orderId: order.id,
      }).catch(() => {});
    } catch (err) {
      setFormError(err.message || 'Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
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

  if (notFound || !seller || !product) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center p-6">
        <div className="max-w-sm w-full bg-white border border-[#E7EBE7] rounded-[28px] p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5 text-stone-400" />
          </div>
          <div className="space-y-1">
            <h1 className="font-black text-sm text-[#111813]">Product not available</h1>
            <p className="text-[11px] text-[#5A655D]">
              This link may be broken, or the seller may have removed the product.
            </p>
          </div>
          {handle && (
            <Link
              to={`/${handle}`}
              className="inline-block px-4 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold transition active:scale-95"
            >
              Browse this store
            </Link>
          )}
        </div>
      </div>
    );
  }

  const cleanWaNumber = seller.whatsapp_number?.replace(/[^0-9]/g, '').replace(/^0/, '94');
  const hasDiscount =
    product.compare_at_price && Number(product.compare_at_price) > Number(product.price);
  const savings = hasDiscount
    ? Number(product.compare_at_price) - Number(product.price)
    : 0;
  const discountPct = hasDiscount
    ? Math.round((savings / Number(product.compare_at_price)) * 100)
    : 0;

  /* ---------------------------------------------------------------- */
  /*  Success screen                                                   */
  /* ---------------------------------------------------------------- */
  if (placedOrder) {
    const isBank = placedOrder.payment_method === 'Bank';

    return (
      <div className="min-h-screen bg-[#F4F6F4] font-sans">
        <header className="sticky top-0 z-30 bg-[#F4F6F4]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#E7EBE7]/60 max-w-lg mx-auto">
          <div className="flex items-center gap-2 font-black text-sm min-w-0">
            <div className="w-7 h-7 rounded-lg bg-[#006241] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
              {seller.logo_url ? (
                <img src={seller.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                seller.shop_name?.[0] || 'S'
              )}
            </div>
            <span className="truncate">{seller.shop_name}</span>
          </div>
          <Link
            to={`/${seller.handle}`}
            className="text-[11px] font-bold text-[#006241] hover:underline shrink-0"
          >
            View store
          </Link>
        </header>

        <main className="max-w-lg mx-auto px-4 pt-6 space-y-4">
          <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs text-center space-y-4">
            <div className="w-16 h-16 bg-[#E8F0E9] rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#006241]" />
            </div>
            <div className="space-y-1">
              <h1 className="font-black text-base text-[#111813]">
                Order Placed!
              </h1>
              <p className="text-xs text-[#5A655D] font-mono">
                #{placedOrder.order_code || placedOrder.id.slice(0, 4)}
              </p>
            </div>

            <div className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#5A655D]">Total</span>
                <span className="font-black text-[#006241]">
                  {formatLKR(placedOrder.total_amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5A655D]">Payment</span>
                <span className="font-bold">
                  {isBank ? 'Bank Transfer' : 'Cash on Delivery'}
                </span>
              </div>
            </div>

            {isBank && hasBankDetails && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-left text-[11px] text-amber-800 leading-relaxed space-y-1.5">
                <div className="font-bold">Complete your bank transfer:</div>
                <div className="font-mono text-[10px] leading-relaxed">
                  <div><strong>Bank:</strong> {seller.bank_details.bank_name}</div>
                  <div><strong>Name:</strong> {seller.bank_details.account_name}</div>
                  <div><strong>Account:</strong> {seller.bank_details.account_number}</div>
                  {seller.bank_details.branch && (
                    <div><strong>Branch:</strong> {seller.bank_details.branch}</div>
                  )}
                  <div className="pt-1">
                    <strong>Reference:</strong> #{placedOrder.order_code || placedOrder.id.slice(0, 4)}
                  </div>
                </div>
                {cleanWaNumber && (
                  <a
                    href={`https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(
                      `Hi ${seller.shop_name}! I've transferred ${formatLKR(
                        placedOrder.total_amount
                      )} for order #${placedOrder.order_code || placedOrder.id.slice(0, 4)}. Here's my slip:`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full mt-2 py-2.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold rounded-xl text-[11px] text-center active:scale-95 transition"
                  >
                    <MessageCircle className="w-3.5 h-3.5 inline mr-1" /> Send Slip on WhatsApp
                  </a>
                )}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <Link
                to={`/order/${placedOrder.id}`}
                className="block w-full py-3 bg-[#006241] hover:bg-[#004F34] text-white rounded-2xl text-xs font-bold active:scale-95 transition shadow-xs"
              >
                Track Order Status
              </Link>
              <Link
                to={`/${seller.handle}`}
                className="block w-full py-2.5 text-[#5A655D] hover:text-black text-xs font-semibold"
              >
                Continue browsing
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Main order page                                                  */
  /* ---------------------------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#F4F6F4] font-sans pb-8">
      <header className="sticky top-0 z-30 bg-[#F4F6F4]/95 backdrop-blur-md px-4 py-3 border-b border-[#E7EBE7]/60">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#006241] flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
              {seller.logo_url ? (
                <img src={seller.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                seller.shop_name?.[0] || 'S'
              )}
            </div>
            <div className="min-w-0">
              <div className="font-black text-xs text-[#111813] truncate">
                {seller.shop_name}
              </div>
              <div className="text-[10px] text-[#5A655D] font-mono truncate">
                ordy.lk/{seller.handle}
              </div>
            </div>
          </div>
          <Link
            to={`/${seller.handle}`}
            className="text-[11px] font-bold text-[#006241] hover:underline shrink-0 flex items-center gap-1"
          >
            <Store className="w-3 h-3" /> View store
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Product hero */}
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] overflow-hidden shadow-xs">
          <div className="w-full aspect-square bg-stone-100 relative">
            {product.photo_urls?.[activePhotoIdx] ? (
              <img
                src={product.photo_urls[activePhotoIdx]}
                alt={product.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-stone-300">
                {product.title?.[0]}
              </div>
            )}

            {product.free_delivery && (
              <div className="absolute top-3 left-3 bg-[#006241] text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                Free Delivery
              </div>
            )}
            {hasDiscount && (
              <div className="absolute top-3 right-3 bg-rose-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                -{discountPct}% OFF
              </div>
            )}
          </div>

          {product.photo_urls?.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-3 pb-0 scrollbar-none">
              {product.photo_urls.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePhotoIdx(idx)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition ${
                    activePhotoIdx === idx
                      ? 'border-[#006241]'
                      : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="p-5 space-y-3">
            {product.category && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">
                {product.category}
              </div>
            )}
            <h1 className="text-xl font-black text-[#111813] leading-tight">
              {product.title}
            </h1>

            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-2xl font-black text-[#006241]">
                {formatLKR(product.price)}
              </div>
              {hasDiscount && (
                <>
                  <div className="text-sm font-medium text-stone-400 line-through">
                    {formatLKR(product.compare_at_price)}
                  </div>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                    Save {formatLKR(savings)}
                  </span>
                </>
              )}
            </div>

            {product.description && (
              <p className="text-xs text-[#5A655D] leading-relaxed pt-1">
                {product.description}
              </p>
            )}
          </div>
        </div>

        {/* Variant + Quantity + Add button */}
        <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-5 shadow-xs space-y-4">
          <div className="border-b border-[#E7EBE7] pb-3 -mx-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111813]">
              Configure Selection
            </h2>
            <p className="text-[10px] text-[#5A655D] mt-0.5">
              Pick a size/color, set quantity, then add to order. Add more variants below.
            </p>
          </div>

          {modalColors.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A655D]">
                  Color
                </span>
                {chosenColor && (
                  <span className="text-[11px] font-bold text-[#006241]">{chosenColor}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {modalColors.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => {
                      setChosenColor(col);
                      setVariantError('');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                      chosenColor === col
                        ? 'bg-[#006241] text-white border-[#006241]'
                        : 'bg-stone-50 text-[#111813] border-[#E7EBE7] hover:border-stone-400'
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          )}

          {modalSizes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A655D]">
                  Size
                </span>
                {chosenSize && (
                  <span className="text-[11px] font-bold text-[#006241]">{chosenSize}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {modalSizes.map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => {
                      setChosenSize(sz);
                      setVariantError('');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition active:scale-95 ${
                      chosenSize === sz
                        ? 'bg-[#006241] text-white border-[#006241]'
                        : 'bg-stone-50 text-[#111813] border-[#E7EBE7] hover:border-stone-400'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-[#E7EBE7]">
            <div>
              <div className="text-xs font-bold text-[#111813]">Quantity</div>
              <div className="text-[10px] text-[#5A655D] mt-0.5">
                {formatLKR(product.price)} each
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setChosenQty((q) => Math.max(1, q - 1))}
                disabled={chosenQty <= 1}
                className="w-9 h-9 rounded-xl bg-[#F4F6F4] border border-[#E7EBE7] flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="w-8 text-center font-black text-base">{chosenQty}</span>
              <button
                type="button"
                onClick={() => setChosenQty((q) => Math.min(99, q + 1))}
                className="w-9 h-9 rounded-xl bg-[#F4F6F4] border border-[#E7EBE7] flex items-center justify-center active:scale-95 transition"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {variantError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-2 rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{variantError}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleAddSelection}
            className={`w-full py-3.5 font-bold rounded-2xl text-sm active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-2 ${
              justAdded
                ? 'bg-[#E8F0E9] text-[#006241] border border-[#C2D6C5]'
                : 'bg-[#006241] hover:bg-[#004F34] text-white'
            }`}
          >
            {justAdded ? (
              <><CheckCircle2 className="w-4 h-4" /> Added — pick another option</>
            ) : (
              <>
                {selections.length === 0 ? 'Add to Order' : '+ Add Another Selection'} •{' '}
                {formatLKR(Number(product.price) * chosenQty)}
              </>
            )}
          </button>
        </div>

        {/* Selections cart */}
        {selections.length > 0 && (
          <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between border-b border-[#E7EBE7] pb-3">
              <h2 className="text-xs font-black uppercase tracking-wider text-[#111813]">
                Your Order ({selections.length} item{selections.length === 1 ? '' : 's'})
              </h2>
              <span className="text-xs font-black text-[#006241]">
                {formatLKR(selectionsSubtotal)}
              </span>
            </div>

            <div className="space-y-2">
              {selections.map((s) => (
                <div
                  key={s.itemKey}
                  className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl p-3 flex items-center gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-[#111813] truncate">
                      {s.baseTitle || s.title}
                    </div>
                    {(s.size || s.color) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {s.size && (
                          <span className="px-1.5 py-0.5 bg-white border border-[#E7EBE7] rounded text-[9px] font-bold text-[#111813]">
                            {s.size}
                          </span>
                        )}
                        {s.color && (
                          <span className="px-1.5 py-0.5 bg-white border border-[#E7EBE7] rounded text-[9px] font-bold text-[#111813]">
                            {s.color}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] text-[#5A655D] font-mono mt-0.5">
                      {formatLKR(s.price)} × {s.quantity} = {formatLKR(s.price * s.quantity)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-white rounded-lg p-0.5 border border-[#E7EBE7] shrink-0">
                    <button
                      type="button"
                      onClick={() => handleUpdateSelectionQty(s.itemKey, -1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#5A655D] hover:bg-[#F4F6F4] active:scale-90 transition"
                      aria-label="Decrease"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-mono font-bold text-[11px] px-1 min-w-[14px] text-center">
                      {s.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleUpdateSelectionQty(s.itemKey, 1)}
                      className="w-6 h-6 rounded flex items-center justify-center text-[#5A655D] hover:bg-[#F4F6F4] active:scale-90 transition"
                      aria-label="Increase"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveSelection(s.itemKey)}
                    className="p-1.5 text-stone-400 hover:text-rose-600 active:scale-90 transition shrink-0"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Delivery form */}
        <form
          onSubmit={handlePlaceOrder}
          className="bg-white border border-[#E7EBE7] rounded-[24px] p-5 shadow-xs space-y-3"
        >
          <div className="border-b border-[#E7EBE7] pb-3 -mx-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-[#111813]">
              Delivery Details
            </h2>
            <p className="text-[10px] text-[#5A655D] mt-0.5">
              We only ask for what the courier needs.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#5A655D] uppercase tracking-wider mb-1.5">
              Full Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Kasun Mendis"
              required
              autoComplete="name"
              className="w-full px-3.5 py-3 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-sm font-medium outline-none transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#5A655D] uppercase tracking-wider mb-1.5">
              WhatsApp Number *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0771234567"
              required
              autoComplete="tel"
              className="w-full px-3.5 py-3 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-sm font-mono font-bold outline-none transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">
                Secondary Phone
              </label>
              <span className="text-[10px] text-[#5A655D]">Optional</span>
            </div>
            <input
              type="tel"
              value={secondaryPhone}
              onChange={(e) => setSecondaryPhone(e.target.value)}
              placeholder="For the courier to reach you"
              className="w-full px-3.5 py-3 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-sm font-mono font-medium outline-none transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[#5A655D] uppercase tracking-wider mb-1.5">
                District *
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                required
                className="w-full px-3 py-3 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-sm font-bold outline-none transition"
              >
                <option value="">Select</option>
                {SL_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#5A655D] uppercase tracking-wider mb-1.5">
                City / Town *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Peradeniya"
                required
                autoComplete="address-level2"
                className="w-full px-3.5 py-3 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-sm outline-none transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#5A655D] uppercase tracking-wider mb-1.5">
              Delivery Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="No. 42, Temple Road"
              required
              autoComplete="address-line1"
              className="w-full px-3.5 py-3 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-sm outline-none transition"
            />
          </div>

          {hasBankDetails && (
            <div className="pt-3 border-t border-[#E7EBE7] space-y-2">
              <div className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">
                Payment Method
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`py-3 rounded-xl text-xs font-bold border transition active:scale-95 flex flex-col items-center gap-1 ${
                    paymentMethod === 'COD'
                      ? 'bg-[#006241] text-white border-[#006241]'
                      : 'bg-stone-50 text-[#111813] border-[#E7EBE7] hover:border-stone-400'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Cash on Delivery</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Bank')}
                  className={`py-3 rounded-xl text-xs font-bold border transition active:scale-95 flex flex-col items-center gap-1 ${
                    paymentMethod === 'Bank'
                      ? 'bg-[#006241] text-white border-[#006241]'
                      : 'bg-stone-50 text-[#111813] border-[#E7EBE7] hover:border-stone-400'
                  }`}
                >
                  <Landmark className="w-4 h-4" />
                  <span>Bank Transfer</span>
                </button>
              </div>
              <p className="text-[10px] text-[#5A655D] leading-relaxed">
                {paymentMethod === 'COD'
                  ? 'Pay cash to the rider when your order arrives.'
                  : "You'll receive the seller's bank details after placing the order."}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-[#E7EBE7] space-y-1.5 text-xs">
            <div className="flex justify-between text-[#5A655D]">
              <span>
                Subtotal ({selections.reduce((n, s) => n + s.quantity, 0)} item
                {selections.reduce((n, s) => n + s.quantity, 0) === 1 ? '' : 's'})
              </span>
              <span className="font-semibold">{formatLKR(selectionsSubtotal)}</span>
            </div>
            <div className="flex justify-between text-[#5A655D]">
              <span>Delivery Fee</span>
              <span className="font-semibold">
                {deliveryFeeStatus === 'free' ? (
                  <span className="text-[#006241] font-black uppercase">FREE</span>
                ) : deliveryFeeStatus === 'pending' ? (
                  <span className="text-stone-400 italic">Pick district</span>
                ) : (
                  formatLKR(calculatedDeliveryFee)
                )}
              </span>
            </div>
            <div className="flex justify-between font-black text-base pt-2 border-t border-[#E7EBE7] text-[#006241]">
              <span>Total</span>
              <span>{formatLKR(grandTotal)}</span>
            </div>
          </div>

          {formError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3 py-2.5 rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={placing || selections.length === 0}
            className="w-full py-4 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-sm active:scale-[0.98] transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {placing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : selections.length === 0 ? (
              'Add an item to continue'
            ) : (
              <>Place Order • {formatLKR(grandTotal)}</>
            )}
          </button>

          <p className="text-[10px] text-center text-[#5A655D] pt-1">
            By placing this order you agree to the seller's delivery terms.
          </p>
        </form>

        <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-[#5A655D] pt-1 pb-2 flex-wrap">
          {seller.cod_enabled !== false && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#006241]" /> Cash on Delivery
            </span>
          )}
          {hasBankDetails && (
            <span className="flex items-center gap-1">
              <Landmark className="w-3 h-3 text-[#006241]" /> Bank Transfer
            </span>
          )}
          <span className="flex items-center gap-1">
            <Truck className="w-3 h-3 text-[#006241]" /> Islandwide Delivery
          </span>
        </div>

        {cleanWaNumber && (
          <div className="text-center pb-4">
            <a
              href={`https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(
                `Hi ${seller.shop_name}, I have a question about "${product.title}".`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#006241] hover:underline"
            >
              <MessageCircle className="w-3.5 h-3.5" /> Questions? Message the seller
            </a>
          </div>
        )}
      </main>
    </div>
  );
}