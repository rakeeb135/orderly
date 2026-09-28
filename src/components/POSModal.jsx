import React, { useState, useEffect } from 'react';
import { 
  X, 
  Search, 
  Plus, 
  Minus, 
  Loader2, 
  UserCheck, 
  ShoppingBag,
  PackagePlus,
  Layers,
  Trash2
} from 'lucide-react';
import { createOrder, formatLKR, findCustomerByPhone } from '../services/dbService';
import TrustReportCard from './TrustReportCard';
import { normalizeSLPhone, isValidSLPhone } from '../utils/phone';
import { notify } from './Toast';

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

export default function POSModal({ isOpen, onClose, seller, products = [], onOrderCreated }) {
  // Customer inputs
  const [phone, setPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState(seller?.home_district || 'Colombo');
  const [city, setCity] = useState('');
  
  // Status indicators
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false);
  const [existingCustomerFound, setExistingCustomerFound] = useState(false);

  // Cart & Catalog modes: null | 'catalog' | 'custom'
  const [activeItemMode, setActiveItemMode] = useState(null);
  const [cart, setCart] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Catalog variant picker state inside POS
  const [selectedCatalogProduct, setSelectedCatalogProduct] = useState(null);
  const [catalogVariantSize, setCatalogVariantSize] = useState(null);
  const [catalogVariantColor, setCatalogVariantColor] = useState(null);

  // Custom Line Item inputs
  const [customTitle, setCustomTitle] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customVariant, setCustomVariant] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');

  // Checkout controls
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setPhone('');
      setSecondaryPhone('');
      setName('');
      setAddress('');
      setDistrict(seller?.home_district || 'Colombo');
      setCity('');
      setCart([]);
      setActiveItemMode(null);
      setSearchQuery('');
      setExistingCustomerFound(false);
      setSelectedCatalogProduct(null);
      setCustomTitle('');
      setCustomPrice('');
      setCustomVariant('');
      setCustomQuantity('1');
    }
  }, [isOpen, seller?.home_district]);

  // Phone Lookup Engine
  const handlePhoneChange = async (val) => {
    setPhone(val);
    const cleaned = normalizeSLPhone(val);

    if (isValidSLPhone(cleaned)) {
      setLookingUpCustomer(true);
      try {
        const found = await findCustomerByPhone(seller?.id, cleaned);
        if (found) {
          if (found.name) setName(found.name);
          if (found.secondary_phone) setSecondaryPhone(found.secondary_phone);
          if (found.delivery_address) setAddress(found.delivery_address);
          if (found.city) setCity(found.city);
          if (found.district && SL_DISTRICTS.includes(found.district)) {
            setDistrict(found.district);
          }
          setExistingCustomerFound(true);
          notify(`Loaded customer details: ${found.name}!`);
        } else {
          setExistingCustomerFound(false);
        }
      } catch (err) {
        console.error('Customer lookup error:', err);
      } finally {
        setLookingUpCustomer(false);
      }
    } else {
      setExistingCustomerFound(false);
    }
  };

  // Add Catalog Product
  const handleCatalogAddClick = (prod) => {
    const variants = prod.variants || [];
    if (variants.length > 0) {
      setSelectedCatalogProduct(prod);
      const availableSizes = Array.from(new Set(variants.map((v) => v.size).filter(Boolean)));
      const availableColors = Array.from(new Set(variants.map((v) => v.color).filter(Boolean)));
      setCatalogVariantSize(availableSizes[0] || null);
      setCatalogVariantColor(availableColors[0] || null);
    } else {
      pushToCart({
        id: prod.id,
        title: prod.title,
        price: Number(prod.price),
        free_delivery: Boolean(prod.free_delivery),
        quantity: 1,
        is_custom: false
      });
      notify(`Added ${prod.title}`);
    }
  };

  const confirmCatalogVariantAdd = () => {
    if (!selectedCatalogProduct) return;

    let variantLabel = '';
    if (catalogVariantSize && catalogVariantColor) variantLabel = ` (${catalogVariantSize} / ${catalogVariantColor})`;
    else if (catalogVariantSize) variantLabel = ` (${catalogVariantSize})`;
    else if (catalogVariantColor) variantLabel = ` (${catalogVariantColor})`;

    pushToCart({
      id: selectedCatalogProduct.id,
      title: `${selectedCatalogProduct.title}${variantLabel}`,
      price: Number(selectedCatalogProduct.price),
      free_delivery: Boolean(selectedCatalogProduct.free_delivery),
      quantity: 1,
      is_custom: false,
      variantKey: `${selectedCatalogProduct.id}-${catalogVariantSize || ''}-${catalogVariantColor || ''}`
    });

    notify(`Added ${selectedCatalogProduct.title}${variantLabel}`);
    setSelectedCatalogProduct(null);
  };

  // Add Custom Off-Catalog Item
  const handleAddCustomItem = (e) => {
    e.preventDefault();
    if (!customTitle.trim() || !customPrice) {
      notify('Item name and price are required.', 'error');
      return;
    }

    const priceNum = parseFloat(customPrice);
    const qtyNum = parseInt(customQuantity, 10) || 1;
    const variantTag = customVariant.trim() ? ` (${customVariant.trim()})` : '';

    pushToCart({
      id: null,
      title: `${customTitle.trim()}${variantTag}`,
      price: priceNum,
      quantity: qtyNum,
      free_delivery: false,
      is_custom: true,
      variantKey: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`
    });

    notify(`Added custom item: ${customTitle.trim()}`);
    setCustomTitle('');
    setCustomPrice('');
    setCustomVariant('');
    setCustomQuantity('1');
    setActiveItemMode(null);
  };

  const pushToCart = (item) => {
    const key = item.variantKey || item.id || item.title;
    const existingIndex = cart.findIndex((i) => (i.variantKey || i.id || i.title) === key);

    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += item.quantity || 1;
      setCart(updated);
    } else {
      setCart([...cart, item]);
    }
  };

  const updateQuantity = (key, delta) => {
    const updated = cart
      .map((item) => {
        const itemKey = item.variantKey || item.id || item.title;
        if (itemKey === key) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter(Boolean);
    setCart(updated);
  };

  const removeFromCart = (key) => {
    setCart(cart.filter((item) => (item.variantKey || item.id || item.title) !== key));
  };

  // Pricing & Dynamic Shipping
  const subtotal = cart.reduce((sum, item) => sum + (Number(item.price) * item.quantity), 0);
  const isFreeDeliveryOrder = cart.length > 0 && cart.some((i) => i.free_delivery);

  let deliveryFee = 0;
  if (cart.length > 0 && !isFreeDeliveryOrder) {
    const isLocal = district.toLowerCase() === (seller?.home_district || 'colombo').toLowerCase();
    deliveryFee = isLocal 
      ? (Number(seller?.delivery_fee) || 350)
      : (Number(seller?.outstation_delivery_fee) || 450);
  }

  const grandTotal = subtotal + deliveryFee;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone.trim()) {
      notify('Phone number is required.', 'error');
      return;
    }
    if (cart.length === 0) {
      notify('Please add at least one item to the order.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder({
        sellerId: seller.id,
        customerName: name.trim() || 'Direct Customer',
        customerPhone: phone.trim(),
        secondaryPhone: secondaryPhone.trim(),
        deliveryAddress: address.trim(),
        city: city.trim(),
        district: district.trim(),
        items: cart,
        deliveryFee,
        paymentMethod,
        source: 'manual_pos'
      });

      if (typeof onOrderCreated === 'function') {
        onOrderCreated(order);
      }

      notify(`Order #${order.order_code} recorded!`);
      onClose();
    } catch (err) {
      notify(err.message || 'Failed to place order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const filteredProducts = products.filter((p) => 
    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-x-0 top-0 h-[100dvh] bg-[#111813]/70 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-[32px] p-6 max-w-2xl w-full shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto scroll-pb-40 text-[#111813]">
        {/* Top Header */}
        <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
          <div>
            <h3 className="font-extrabold text-sm">Create Manual POS Order</h3>
            <p className="text-[11px] text-[#5A655D]">Record orders taken over WhatsApp, Instagram DM, or phone call</p>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-black">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* 1. CUSTOMER DETAILS */}
          <div className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-2xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[#111813]">Customer Details</span>
              {lookingUpCustomer && (
                <span className="text-[10px] text-[#006241] flex items-center gap-1 font-semibold">
                  <Loader2 className="w-3 h-3 animate-spin" /> Checking customer memory...
                </span>
              )}
              {existingCustomerFound && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                  <UserCheck className="w-3 h-3" /> Returning Customer Auto-Filled
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">Primary WhatsApp *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="0771234567"
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E7EBE7] rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Secondary Phone</label>
                <input
                  type="tel"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  placeholder="0719876543 (Optional)"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E7EBE7] rounded-xl font-mono font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Kasun Mendis"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E7EBE7] rounded-xl font-medium"
                />
              </div>
            </div>

            {/* Buyer Trust Report — network check on phone number */}
            {phone && phone.replace(/[^0-9]/g, '').length >= 9 && (
              <TrustReportCard phone={phone} compact />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Delivery District *</label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-[#E7EBE7] rounded-xl font-bold text-xs"
                >
                  {SL_DISTRICTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">City / Town</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Peradeniya"
                  className="w-full px-3.5 py-2.5 bg-white border border-[#E7EBE7] rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Street Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="No. 42, Temple Road"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E7EBE7] rounded-xl"
              />
            </div>
          </div>

          {/* 2. ORDER ITEMS SELECTION */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[#111813]">Order Items</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveItemMode(activeItemMode === 'catalog' ? null : 'catalog')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 border ${
                    activeItemMode === 'catalog'
                      ? 'bg-[#006241] text-white border-[#006241]'
                      : 'bg-[#F4F6F4] text-[#111813] border-[#E7EBE7] hover:border-stone-400'
                  }`}
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Browse Catalog</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveItemMode(activeItemMode === 'custom' ? null : 'custom')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition active:scale-95 border ${
                    activeItemMode === 'custom'
                      ? 'bg-[#006241] text-white border-[#006241]'
                      : 'bg-[#F4F6F4] text-[#111813] border-[#E7EBE7] hover:border-stone-400'
                  }`}
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>+ Custom Item</span>
                </button>
              </div>
            </div>

            {/* CATALOG DRAWER */}
            {activeItemMode === 'catalog' && (
              <div className="border border-[#E7EBE7] rounded-2xl p-3 bg-stone-50/60 space-y-3 animate-in fade-in duration-150">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by title or category..."
                    className="w-full pl-8 pr-3 py-2 bg-white border border-[#E7EBE7] rounded-xl text-xs"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-[#E7EBE7] bg-white rounded-xl border border-[#E7EBE7]">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-center text-stone-400 text-xs">No catalog products found.</div>
                  ) : (
                    filteredProducts.map((prod) => {
                      const hasVariants = prod.variants && prod.variants.length > 0;
                      return (
                        <div key={prod.id} className="p-2.5 flex justify-between items-center hover:bg-stone-50 transition">
                          <div className="min-w-0 pr-2">
                            <div className="font-bold truncate text-xs">{prod.title}</div>
                            <div className="text-[11px] text-[#006241] font-mono font-bold flex items-center gap-2">
                              <span>{formatLKR(prod.price)}</span>
                              {hasVariants && (
                                <span className="text-[10px] text-[#5A655D] font-normal flex items-center gap-0.5">
                                  <Layers className="w-3 h-3" /> Has options
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCatalogAddClick(prod)}
                            className="px-3 py-1.5 bg-[#111813] hover:bg-stone-800 text-white rounded-xl text-xs font-bold active:scale-95 transition flex items-center gap-1 shrink-0"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Catalog Variant Quick Picker */}
                {selectedCatalogProduct && (
                  <div className="bg-white border-2 border-[#006241] rounded-2xl p-3.5 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs">Select Option for: {selectedCatalogProduct.title}</span>
                      <button onClick={() => setSelectedCatalogProduct(null)} className="text-stone-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Sizes */}
                    {Array.from(new Set(selectedCatalogProduct.variants.map((v) => v.size).filter(Boolean))).length > 0 && (
                      <div>
                        <span className="block text-[10px] font-bold text-[#5A655D] mb-1">Size:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(new Set(selectedCatalogProduct.variants.map((v) => v.size).filter(Boolean))).map((sz) => (
                            <button
                              key={sz}
                              type="button"
                              onClick={() => setCatalogVariantSize(sz)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                catalogVariantSize === sz ? 'bg-[#006241] text-white border-[#006241]' : 'bg-[#F4F6F4] text-[#111813]'
                              }`}
                            >
                              {sz}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Colors */}
                    {Array.from(new Set(selectedCatalogProduct.variants.map((v) => v.color).filter(Boolean))).length > 0 && (
                      <div>
                        <span className="block text-[10px] font-bold text-[#5A655D] mb-1">Color:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {Array.from(new Set(selectedCatalogProduct.variants.map((v) => v.color).filter(Boolean))).map((col) => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => setCatalogVariantColor(col)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                catalogVariantColor === col ? 'bg-[#006241] text-white border-[#006241]' : 'bg-[#F4F6F4] text-[#111813]'
                              }`}
                            >
                              {col}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={confirmCatalogVariantAdd}
                      className="w-full py-2 bg-[#006241] text-white rounded-xl font-bold text-xs active:scale-95 transition"
                    >
                      Confirm Item
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* CUSTOM ITEM CARD */}
            {activeItemMode === 'custom' && (
              <div className="border border-[#E7EBE7] rounded-2xl p-4 bg-stone-50/60 space-y-3 animate-in fade-in duration-150">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-xs text-[#111813] flex items-center gap-1.5">
                    <PackagePlus className="w-4 h-4 text-[#006241]" />
                    <span>Enter Off-Catalog Item</span>
                  </span>
                  <button onClick={() => setActiveItemMode(null)} className="text-stone-400 hover:text-black">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Item Title / Name *</label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="e.g. Tailored Linen Kurta"
                      className="w-full px-3 py-2 bg-white border border-[#E7EBE7] rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Price (Rs.) *</label>
                    <input
                      type="number"
                      value={customPrice}
                      onChange={(e) => setCustomPrice(e.target.value)}
                      placeholder="3500"
                      className="w-full px-3 py-2 bg-white border border-[#E7EBE7] rounded-xl font-mono font-bold text-[#006241]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Variant / Specifics (Optional)</label>
                    <input
                      type="text"
                      value={customVariant}
                      onChange={(e) => setCustomVariant(e.target.value)}
                      placeholder="e.g. XL - Black or 42mm Gold"
                      className="w-full px-3 py-2 bg-white border border-[#E7EBE7] rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#E7EBE7] rounded-xl font-mono font-bold"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomItem}
                  className="w-full py-2.5 bg-[#111813] hover:bg-stone-800 text-white font-bold rounded-xl text-xs active:scale-95 transition shadow-xs"
                >
                  + Add Item to Order
                </button>
              </div>
            )}

            {/* ACTIVE CART ITEMS */}
            {cart.length > 0 ? (
              <div className="border border-[#E7EBE7] rounded-2xl p-3 space-y-2 bg-[#F4F6F4]/50">
                <div className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">
                  Cart Items ({cart.length})
                </div>
                <div className="space-y-1.5">
                  {cart.map((item) => {
                    const key = item.variantKey || item.id || item.title;
                    return (
                      <div key={key} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#E7EBE7]">
                        <div className="min-w-0 pr-2">
                          <div className="font-bold truncate flex items-center gap-1.5">
                            <span>{item.title}</span>
                            {item.is_custom && (
                              <span className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-bold rounded">
                                Custom
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#5A655D] font-mono font-medium">
                            {formatLKR(item.price)} × {item.quantity} = {formatLKR(Number(item.price) * item.quantity)}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1 bg-[#F4F6F4] rounded-lg p-0.5 border border-[#E7EBE7]">
                            <button
                              type="button"
                              onClick={() => updateQuantity(key, -1)}
                              className="p-1 hover:bg-white rounded text-[#5A655D]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs px-1">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(key, 1)}
                              className="p-1 hover:bg-white rounded text-[#5A655D]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => removeFromCart(key)}
                            className="p-1.5 text-stone-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-5 border-2 border-dashed border-[#E7EBE7] rounded-2xl text-center text-[#5A655D] text-xs">
                No items added yet. Tap <strong>Browse Catalog</strong> or <strong>+ Custom Item</strong> above.
              </div>
            )}
          </div>

          {/* 3. PAYMENT METHOD & PRICING SUMMARY */}
          <div className="border border-[#E7EBE7] rounded-2xl p-4 space-y-3 bg-white">
            <div className="flex justify-between items-center">
              <span className="font-bold">Payment Method</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('COD')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                    paymentMethod === 'COD' ? 'bg-[#006241] text-white' : 'bg-[#F4F6F4] text-[#5A655D]'
                  }`}
                >
                  Cash on Delivery
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('Bank')}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                    paymentMethod === 'Bank' ? 'bg-[#006241] text-white' : 'bg-[#F4F6F4] text-[#5A655D]'
                  }`}
                >
                  Bank Transfer
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-[#E7EBE7] space-y-1">
              <div className="flex justify-between text-[#5A655D]">
                <span>Items Subtotal</span>
                <span>{formatLKR(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[#5A655D]">
                <span>Delivery Fee ({district})</span>
                <span>{isFreeDeliveryOrder ? <strong className="text-[#006241]">FREE</strong> : formatLKR(deliveryFee)}</span>
              </div>
              <div className="flex justify-between font-black text-sm text-[#006241] pt-1 border-t border-[#E7EBE7]">
                <span>Total Amount Due</span>
                <span>{formatLKR(grandTotal)}</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || cart.length === 0}
            className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 shadow-xs text-xs"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : `Record Order • ${formatLKR(grandTotal)}`}
          </button>
        </form>
      </div>
    </div>
  );
}