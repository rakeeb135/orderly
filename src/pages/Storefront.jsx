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
import { fetchSellerByHandle, fetchProducts, createOrder, formatLKR } from '../services/dbService';

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

  // Variant + quantity selection state
  const [chosenSize, setChosenSize] = useState(null);
  const [chosenColor, setChosenColor] = useState(null);
  const [chosenQty, setChosenQty] = useState(1);
  const [variantError, setVariantError] = useState('');

  // Checkout fields (auto-filled from local device storage if returning buyer)
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState(null);

  /* ---------------------------------------------------------------- */
  /*  Initial data fetch                                                */
  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /*  Load local buyer profile                                          */
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
      /* ignore storage read errors */
    }
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Product modal open / close                                        */
  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /*  Add to cart (respects chosenQty)                                  */
  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /*  Cart totals + delivery logic                                      */
  /* ---------------------------------------------------------------- */
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

  /* ---------------------------------------------------------------- */
  /*  Open / close checkout modal                                       */
  /* ---------------------------------------------------------------- */
  const openCheckout = () => {
    setPlacedOrderId(null); // Reset any previous success state
    setShowCheckout(true);
  };

  const closeCheckout = () => {
    setShowCheckout(false);
    setPlacedOrderId(null); // Reset success state so next open shows the form
  };

  /* ---------------------------------------------------------------- */
  /*  Place order                                                       */
  /* ---------------------------------------------------------------- */
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

      // Persist profile locally for 1-tap checkout on future visits
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
      {/* Mini Header */}
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
        {/* Brand Banner */}
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

            {/* Social Buttons */}
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
                  <svg className="w-3.5 h-3.5 text-pink-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
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
                  <svg className="w-3.5 h-3.5 text-black" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 2.89 3.5 2.73 1.35-.04 2.56-.89 3.01-2.16.27-.72.33-1.5.31-2.28-.02-4.93-.01-9.87-.01-14.8z"/>
                  </svg>
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
                  <svg className="w-3.5 h-3.5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
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

        {/* Product Catalog Grid */}
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

      {/* Product Detail Modal */}
      {selectedProductView && (
        <div className="fixed inset-0 bg-[#111813]/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-2">
              <span className="text-xs font-bold text-[#5A655D] uppercase tracking-wider">{selectedProductView.category}</span>
              <button onClick={closeProductModal} className="text-stone-400 hover:text-black">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Viewer */}
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

            {/* Variant Selection */}
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

                {seller.whatsapp_number && (
                  <div className="pt-1">
                    <a
                      href={`https://wa.me/${cleanWaNumber}?text=${encodeURIComponent(`Hi ${seller.shop_name}, I'm looking at "${selectedProductView.title}". Do you have other options?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#006241] hover:underline font-semibold flex items-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Looking for another color or size? Ask on WhatsApp
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Quantity Selector */}
            <div className="flex items-center justify-between bg-stone-50 border border-[#E7EBE7] rounded-xl p-3">
              <span className="text-xs font-bold text-[#5A655D]">Quantity</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setChosenQty((q) => Math.max(1, q - 1))}
                  disabled={chosenQty <= 1}
                  className="w-8 h-8 rounded-lg bg-white border border-[#E7EBE7] flex items-center justify-center disabled:opacity-40 active:scale-95 transition"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-black text-sm">{chosenQty}</span>
                <button
                  type="button"
                  onClick={() => setChosenQty((q) => Math.min(99, q + 1))}
                  className="w-8 h-8 rounded-lg bg-white border border-[#E7EBE7] flex items-center justify-center active:scale-95 transition"
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
              onClick={addToCartFromModal}
              className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs active:scale-95 transition shadow-xs mt-2 flex items-center justify-center gap-2"
            >
              Add {chosenQty} to Bag • {formatLKR(Number(selectedProductView.price) * chosenQty)}
            </button>
          </div>
        </div>
      )}

      {/* Floating Bottom Cart */}
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

      {/* Checkout Drawer */}
      {showCheckout && (
        <div className="fixed inset-0 bg-[#111813]/70 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white w-full sm:max-w-md rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
              <h3 className="font-black text-sm">Delivery & Checkout</h3>
              <button onClick={closeCheckout} className="text-stone-400 hover:text-black" aria-label="Close">
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
                {/* Financial Summary */}
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
                    placeholder="0719876543 (Recommended if primary is busy)"
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