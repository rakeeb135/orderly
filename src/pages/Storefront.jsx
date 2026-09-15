import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Store,
  ShoppingCart,
  X,
  Loader2,
  ShieldCheck,
  Truck,
  MessageCircle,
  Layers,
  AlertCircle,
  Plus,
  Minus,
} from 'lucide-react';
import {
  fetchSellerByHandle,
  fetchProducts,
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

const BUYER_STORAGE_KEY = 'orderly_buyer_profile';

export default function Storefront() {
  const { handle } = useParams();
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProductView, setSelectedProductView] = useState(null);
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);

  const [chosenSize, setChosenSize] = useState(null);
  const [chosenColor, setChosenColor] = useState(null);
  const [chosenQty, setChosenQty] = useState(1);
  const [variantError, setVariantError] = useState('');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const s = await fetchSellerByHandle(handle);
        setSeller(s);
        if (s?.id) {
          const prods = await fetchProducts(s.id);
          setProducts(prods.filter((p) => p.status === 'active'));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [handle]);

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

  const openProductModal = (product) => {
    setSelectedProductView(product);
    setActivePhotoIdx(0);
    setVariantError('');
    setChosenQty(1);

    const variants = product.variants || [];
    const availableSizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
    const availableColors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));

    setChosenSize(availableSizes.length === 1 ? availableSizes[0] : null);
    setChosenColor(availableColors.length === 1 ? availableColors[0] : null);
  };

  const closeProductModal = () => {
    setSelectedProductView(null);
    setChosenQty(1);
    setVariantError('');
  };

  const addToCartFromModal = () => {
    if (!selectedProductView) return;

    const variants = selectedProductView.variants || [];
    const availableSizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
    const availableColors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));

    if (availableSizes.length > 0 && !chosenSize) {
      setVariantError('Please select a size to proceed.');
      return;
    }
    if (availableColors.length > 0 && !chosenColor) {
      setVariantError('Please select a color to proceed.');
      return;
    }

    let variantTitle = '';
    if (chosenSize && chosenColor) variantTitle = ` (${chosenSize} / ${chosenColor})`;
    else if (chosenSize) variantTitle = ` (${chosenSize})`;
    else if (chosenColor) variantTitle = ` (${chosenColor})`;

    const qtyToAdd = Math.max(1, Number(chosenQty) || 1);
    const itemKey = `${selectedProductView.id}-${chosenSize || ''}-${chosenColor || ''}`;

    setCart((prevCart) => {
      const idx = prevCart.findIndex((i) => i.itemKey === itemKey);
      if (idx > -1) {
        const next = [...prevCart];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qtyToAdd };
        return next;
      }
      return [
        ...prevCart,
        {
          ...selectedProductView,
          itemKey,
          title: `${selectedProductView.title}${variantTitle}`,
          chosenSize,
          chosenColor,
          free_delivery: selectedProductView.free_delivery,
          quantity: qtyToAdd,
        },
      ];
    });

    closeProductModal();
  };

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal = cart.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);

  const isFreeShippingOrder = cart.length > 0 && cart.some((i) => i.free_delivery);

  let calculatedDeliveryFee = 0;
  let deliveryFeeStatus = 'pending';

  if (cart.length === 0) {
    calculatedDeliveryFee = 0;
  } else if (isFreeShippingOrder) {
    calculatedDeliveryFee = 0;
    deliveryFeeStatus = 'free';
  } else if (!district) {
    calculatedDeliveryFee = 0;
    deliveryFeeStatus = 'pending';
  } else {
    const isLocalDistrict = district.toLowerCase() === (seller?.home_district || 'colombo').toLowerCase();
    calculatedDeliveryFee = isLocalDistrict
      ? (Number(seller?.delivery_fee) || 350)
      : (Number(seller?.outstation_delivery_fee) || 450);
    deliveryFeeStatus = 'calculated';
  }

  const grandTotal = subtotal + calculatedDeliveryFee;

  const openCheckout = () => {
    setPlacedOrderId(null);
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setPlacedOrderId(null);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    if (!district) {
      alert('Please select your delivery district.');
      return;
    }
    setPlacing(true);

    try {
      const cleanCity = city.trim();
      const cleanAddress = address.trim();
      const cleanName = name.trim();
      const cleanPhone = phone.trim();
      const cleanSecondary = secondaryPhone.trim();

      const order = await createOrder({
        sellerId: seller.id,
        customerName: cleanName,
        customerPhone: cleanPhone,
        secondaryPhone: cleanSecondary,
        deliveryAddress: cleanAddress,
        city: cleanCity,
        district: district.trim(),
        items: cart,
        deliveryFee: calculatedDeliveryFee,
        paymentMethod: 'COD',
        source: 'storefront',
      });

      // Persist buyer profile for 1-tap checkout next time
      try {
        localStorage.setItem(
          BUYER_STORAGE_KEY,
          JSON.stringify({
            name: cleanName,
            phone: cleanPhone,
            secondaryPhone: cleanSecondary,
            address: cleanAddress,
            district: district.trim(),
            city: cleanCity,
          })
        );
      } catch {
        /* non-blocking */
      }

      setPlacedOrderId(order.id);
      setCart([]);

      // Fire-and-forget push notification to the seller.
      // Non-blocking: if this fails, the order still succeeds.
      triggerPushNotification(seller.id, {
        title: `New Order #${order.order_code || order.id.slice(0, 4)}`,
        message: `${cleanName || 'A customer'} placed an order for ${formatLKR(order.total_amount)} (${order.payment_method || 'COD'})`,
        link: `/orders/${order.id}`,
        orderId: order.id,
      }).catch(() => {});
    } catch (err) {
      alert(err.message || 'Checkout failed');
    } finally {
      setPlacing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  if (!seller || seller.is_active === false) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center p-6 text-center text-xs text-[#5A655D]">
        This shop is currently undergoing scheduled maintenance. Please check back later.
      </div>
    );
  }

  const cleanWaNumber = seller.whatsapp_number?.replace(/[^0-9]/g, '').replace(/^0/, '94');
  const modalVariants = selectedProductView?.variants || [];
  const modalSizes = Array.from(new Set(modalVariants.map((v) => v.size).filter(Boolean)));
  const modalColors = Array.from(new Set(modalVariants.map((v) => v.color).filter(Boolean)));

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] font-sans pb-24">
      <header className="sticky top-0 z-30 bg-[#F4F6F4]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between max-w-lg mx-auto border-b border-[#E7EBE7]/50">
        <div className="flex items-center gap-2 font-black text-sm">
          <Store className="w-4 h-4 text-[#006241]" />
          <span className="truncate">{seller.shop_name}</span>
        </div>
        <button
          onClick={openCheckout}
          className="p-2 bg-white border border-[#E7EBE7] rounded-full text-[#5A655D] shadow-xs relative active:scale-95"
        >
          <ShoppingCart className="w-4 h-4" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#006241] text-white rounded-full text-[9px] font-bold flex items-center justify-center">
              {totalItems > 9 ? '9+' : totalItems}
            </span>
          )}
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 space-y-4 pt-2">
        <div className="bg-white border border-[#E7EBE7] rounded-[32px] overflow-hidden shadow-xs">
          {seller.banner_url ? (
            <div className="w-full h-36 sm:h-44 bg-stone-100 overflow-hidden">
              <img src={seller.banner_url} alt="Banner" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-full h-20 bg-gradient-to-r from-[#006241]/20 to-[#006241]/5" />
          )}

          <div className="p-6 pt-0 text-center relative space-y-2">
            <div className="w-20 h-20 rounded-3xl bg-[#006241] border-4 border-white shadow-md flex items-center justify-center text-white font-black text-2xl mx-auto -mt-10 overflow-hidden">
              {seller.logo_url ? (
                <img src={seller.logo_url} alt={seller.shop_name} className="w-full h-full object-cover" />
              ) : (
                seller.shop_name?.[0] || 'S'
              )}
            </div>

            <h1 className="text-xl font-black tracking-tight">{seller.shop_name}</h1>
            {seller.bio && <p className="text-xs text-[#5A655D] max-w-sm mx-auto leading-relaxed">{seller.bio}</p>}

            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
              {seller.whatsapp_number && (
                <a
                  href={`https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(`Hi ${seller.shop_name}, I have an inquiry.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-full text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              )}

              {seller.instagram_handle && (
                <a
                  href={`https://instagram.com/${seller.instagram_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#111813] rounded-full text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <span>@{seller.instagram_handle}</span>
                </a>
              )}

              {seller.tiktok_handle && (
                <a
                  href={`https://tiktok.com/@${seller.tiktok_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#111813] rounded-full text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <span>@{seller.tiktok_handle}</span>
                </a>
              )}

              {seller.facebook_handle && (
                <a
                  href={`https://facebook.com/${seller.facebook_handle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-[#111813] rounded-full text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <span>Facebook</span>
                </a>
              )}
            </div>

            <div className="flex justify-center gap-4 text-[11px] font-bold text-[#5A655D] pt-3 border-t border-[#E7EBE7]">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-[#006241]" /> Cash on Delivery
              </span>
              <span className="flex items-center gap-1">
                <Truck className="w-3.5 h-3.5 text-[#006241]" /> Islandwide Delivery
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {products.length === 0 ? (
            <div className="col-span-2 bg-white border border-[#E7EBE7] rounded-[24px] p-8 text-center text-xs text-[#5A655D]">
              No products listed yet. Check back soon!
            </div>
          ) : (
            products.map((p) => {
              const hasImgs = p.photo_urls && p.photo_urls.length > 0;
              const hasVariants = p.variants && p.variants.length > 0;

              return (
                <div
                  key={p.id}
                  className="bg-white border border-[#E7EBE7] rounded-[24px] p-3 shadow-xs space-y-2.5 flex flex-col justify-between hover:border-[#006241]/50 transition cursor-pointer"
                  onClick={() => openProductModal(p)}
                >
                  <div className="w-full h-36 rounded-2xl bg-stone-100 border border-[#E7EBE7] flex items-center justify-center font-bold text-xs text-[#5A655D] overflow-hidden relative">
                    {hasImgs ? (
                      <img src={p.photo_urls[0]} alt={p.title} className="w-full h-full object-cover" />
                    ) : (
                      p.title?.[0] || 'P'
                    )}
                    {p.free_delivery && (
                      <div className="absolute top-1.5 left-1.5 bg-[#006241] text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        Free Delivery
                      </div>
                    )}
                    {hasImgs && p.photo_urls.length > 1 && (
                      <div className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                        {p.photo_urls.length} photos
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-xs truncate text-[#111813]">{p.title}</h3>
                    <div className="text-xs font-black text-[#006241] mt-0.5">{formatLKR(p.price)}</div>
                    {hasVariants && (
                      <div className="text-[10px] text-[#5A655D] flex items-center gap-1 mt-0.5">
                        <Layers className="w-3 h-3" /> Options available
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openProductModal(p); }}
                    className="w-full py-2 bg-[#111813] hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-xs"
                  >
                    View Details
                  </button>
                </div>
              );
            })
          )}
        </div>
      </main>

      {selectedProductView && (
        <div className="fixed inset-0 bg-[#111813]/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-2">
              <span className="text-xs font-bold text-[#5A655D] uppercase tracking-wider">{selectedProductView.category}</span>
              <button onClick={closeProductModal} className="text-stone-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="w-full h-64 rounded-2xl bg-stone-100 border border-[#E7EBE7] overflow-hidden">
                {selectedProductView.photo_urls?.[activePhotoIdx] ? (
                  <img
                    src={selectedProductView.photo_urls[activePhotoIdx]}
                    alt={selectedProductView.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-xl text-stone-300">
                    {selectedProductView.title?.[0]}
                  </div>
                )}
              </div>

              {selectedProductView.photo_urls?.length > 1 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {selectedProductView.photo_urls.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePhotoIdx(idx)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 shrink-0 ${
                        activePhotoIdx === idx ? 'border-[#006241]' : 'border-transparent opacity-60'
                      }`}
                    >
                      <img src={img} alt="thumb" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black text-[#111813]">{selectedProductView.title}</h2>
                  <div className="text-base font-black text-[#006241] mt-1">{formatLKR(selectedProductView.price)}</div>
                </div>
                {selectedProductView.free_delivery && (
                  <span className="px-2.5 py-1 bg-[#E8F0E9] text-[#006241] font-bold text-[10px] rounded-full">
                    Free Delivery
                  </span>
                )}
              </div>
              {selectedProductView.description && (
                <p className="text-xs text-[#5A655D] mt-2 leading-relaxed">{selectedProductView.description}</p>
              )}
            </div>

            {(modalSizes.length > 0 || modalColors.length > 0) && (
              <div className="space-y-3 pt-3 border-t border-[#E7EBE7]">
                {modalColors.length > 0 && (
                  <div>
                    <span className="block text-[11px] font-bold mb-1.5 text-[#5A655D]">
                      Select Color: {chosenColor && <span className="text-[#006241]">({chosenColor})</span>}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {modalColors.map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => { setChosenColor(col); setVariantError(''); }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
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
                  <div>
                    <span className="block text-[11px] font-bold mb-1.5 text-[#5A655D]">
                      Select Size: {chosenSize && <span className="text-[#006241]">({chosenSize})</span>}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {modalSizes.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => { setChosenSize(sz); setVariantError(''); }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
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
              </div>
            )}

            <div className="flex items-center justify-between bg-stone-50 border border-[#E7EBE7] rounded-xl p-3">
              <span className="text-xs font-bold text-[#5A655D]">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setChosenQty((q) => Math.max(1, q - 1))}
                  disabled={chosenQty <= 1}
                  className="w-8 h-8 rounded-lg bg-white border border-[#E7EBE7] flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-black text-sm">{chosenQty}</span>
                <button
                  type="button"
                  onClick={() => setChosenQty((q) => Math.min(99, q + 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-[#E7EBE7] flex items-center justify-center active:scale-95 transition"
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
              onClick={addToCartFromModal}
              className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs active:scale-95 transition shadow-xs mt-2 flex items-center justify-center gap-2"
            >
              Add {chosenQty} to Bag • {formatLKR(Number(selectedProductView.price) * chosenQty)}
            </button>
          </div>
        </div>
      )}

      {totalItems > 0 && !showCheckout && (
        <div className="fixed bottom-4 left-4 right-4 max-w-lg mx-auto bg-[#111813] text-white p-3.5 rounded-[28px] shadow-2xl flex justify-between items-center z-40">
          <span className="text-xs font-black pl-2">{totalItems} item(s) • {formatLKR(subtotal)}</span>
          <button
            onClick={openCheckout}
            className="px-5 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-2xl text-xs font-bold active:scale-95 transition"
          >
            Checkout
          </button>
        </div>
      )}

      {showCheckout && (
        <div className="fixed inset-0 bg-[#111813]/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
              <h3 className="font-black text-sm">Delivery & Checkout</h3>
              <button onClick={closeCheckout} className="text-stone-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {placedOrderId ? (
              <div className="py-6 text-center space-y-3">
                <h4 className="font-black text-base">Order Placed Successfully!</h4>
                <p className="text-xs text-[#5A655D]">We have recorded your order. Track your delivery live below:</p>
                <Link
                  to={`/order/${placedOrderId}`}
                  className="inline-block px-6 py-3 bg-[#006241] text-white rounded-2xl text-xs font-bold active:scale-95 transition shadow-xs"
                >
                  Track Order Status
                </Link>
                <div>
                  <button
                    type="button"
                    onClick={closeCheckout}
                    className="text-[11px] text-[#5A655D] hover:text-black font-semibold mt-2"
                  >
                    Continue shopping
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCheckoutSubmit} className="space-y-3 text-xs">
                <div className="bg-[#F4F6F4] p-3 rounded-2xl border border-[#E7EBE7] space-y-1.5">
                  {cart.map((i) => (
                    <div key={i.itemKey || i.id} className="flex justify-between items-center">
                      <span className="truncate pr-2">{i.title} (x{i.quantity})</span>
                      <span className="font-bold shrink-0">{formatLKR(Number(i.price) * i.quantity)}</span>
                    </div>
                  ))}

                  <div className="flex justify-between pt-1 border-t border-[#E7EBE7] text-[#5A655D]">
                    <span>Delivery Fee</span>
                    <span className="font-semibold">
                      {deliveryFeeStatus === 'free' ? (
                        <span className="text-[#006241] font-black uppercase">FREE</span>
                      ) : deliveryFeeStatus === 'pending' ? (
                        <span className="text-stone-400 italic">Select district below</span>
                      ) : (
                        formatLKR(calculatedDeliveryFee)
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between font-black text-sm pt-1 border-t border-[#E7EBE7] text-[#006241]">
                    <span>Total (COD)</span>
                    <span>{formatLKR(grandTotal)}</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="Kasun Mendis"
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">WhatsApp Phone Number *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0771234567"
                    required
                    autoComplete="tel"
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold">Secondary Phone <span className="text-stone-400 font-normal">(Optional)</span></label>
                    <span className="text-[10px] text-[#5A655D]">For Courier Delivery</span>
                  </div>
                  <input
                    type="tel"
                    value={secondaryPhone}
                    onChange={(e) => setSecondaryPhone(e.target.value)}
                    placeholder="0719876543"
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-semibold mb-1">District *</label>
                    <select
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      required
                      className="w-full px-3 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold text-xs"
                    >
                      <option value="">Select District</option>
                      {SL_DISTRICTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold mb-1">City / Town *</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      required
                      autoComplete="address-level2"
                      placeholder="e.g. Peradeniya"
                      className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Delivery Address *</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                    autoComplete="address-line1"
                    placeholder="No. 42, Temple Road"
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
                  />
                </div>

                <button
                  type="submit"
                  disabled={placing || cart.length === 0}
                  className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl active:scale-95 transition shadow-xs disabled:opacity-50 mt-2"
                >
                  {placing ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : `Confirm Order • ${formatLKR(grandTotal)}`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}