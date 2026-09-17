import React, { useState, useRef, memo, useCallback, useMemo } from 'react';
import {
  Plus,
  RefreshCw,
  Trash2,
  X,
  Loader2,
  Share2,
  Tag,
  Upload,
  ImageIcon,
  Layers,
  DollarSign,
  Pencil,
  Truck,
  Check
} from 'lucide-react';
import { createProduct, updateProduct, updateProductStock, deleteProduct, formatLKR } from '../services/dbService';
import { uploadStoreAsset } from '../services/storageService';
import { notify } from '../components/Toast';

const PRESET_COLOR_NAMES = ['Black', 'White', 'Navy', 'Beige', 'Olive', 'Brown', 'Maroon', 'Grey'];

const PRESET_SIZE_GROUPS = {
  Clothing: ['XS', 'S', 'M', 'L', 'XL', '2XL'],
  Footwear: ['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11'],
  Universal: ['Free Size', 'One Size']
};

const ALL_PRESET_SIZES_SET = new Set(Object.values(PRESET_SIZE_GROUPS).flat());
const PRESET_COLORS_SET = new Set(PRESET_COLOR_NAMES);
const DEFAULT_CATEGORIES = ['Apparel', 'Watches', 'Footwear', 'Accessories', 'Beauty', 'General'];

/* ------------------------------------------------------------------ */
/*  Build the direct order link for a product                          */
/* ------------------------------------------------------------------ */
function buildProductLink(handle, productId) {
  if (!handle || !productId) return '';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/${handle}?p=${productId}`;
}

/* ------------------------------------------------------------------ */
/*  Detect whether the native share sheet is actually useful          */
/*                                                                    */
/*  On mobile (iOS + Android), navigator.share gives a great OS       */
/*  sheet with WhatsApp, Instagram, Copy, etc.                        */
/*                                                                    */
/*  On Windows / macOS / Linux desktop, navigator.share exists but    */
/*  the sheet shows useless targets (Teams, Outlook, Mail) and often  */
/*  has no "Copy link" option. So we skip it entirely and go straight */
/*  to clipboard copy.                                                */
/* ------------------------------------------------------------------ */
function prefersNativeShare() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // iPads on iPadOS 13+ masquerade as Macintosh — detect via touch points
  const isIPadOS = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || isIPadOS;
  const isAndroid = /Android/i.test(ua);

  return isIOS || isAndroid;
}

/* ------------------------------------------------------------------ */
/*  Photo tray                                                         */
/* ------------------------------------------------------------------ */
const PhotoTray = memo(function PhotoTray({
  photoUrls,
  onPhotoSelect,
  onRemovePhoto,
  onMakeMain,
  uploading
}) {
  const fileInputRef = useRef(null);

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <label className="font-bold text-[#111813] flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-[#006241]" />
          <span>Gallery ({photoUrls.length}/8)</span>
        </label>
        <span className="text-[10px] text-[#5A655D]">Tap photo to set as cover</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {photoUrls.map((url, index) => (
          <div
            key={url}
            className="relative aspect-square rounded-xl bg-stone-100 border border-[#E7EBE7] overflow-hidden cursor-pointer"
            onClick={() => onMakeMain(index)}
            title="Click to set as Cover"
          >
            <img src={url} alt={`Photo ${index}`} className="w-full h-full object-cover" loading="lazy" />
            {index === 0 && (
              <div className="absolute top-1 left-1 bg-[#006241] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs">
                Cover
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemovePhoto(index); }}
              className="absolute top-1 right-1 p-1 bg-black/60 hover:bg-rose-600 text-white rounded-md transition"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}

        {photoUrls.length < 8 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-[#C2D6C5] hover:border-[#006241] bg-[#F4F6F4]/50 flex flex-col items-center justify-center text-[#006241] transition active:scale-95"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Upload className="w-5 h-5 mb-1" />
                <span className="text-[10px] font-bold">+ Add</span>
              </>
            )}
          </button>
        )}
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onPhotoSelect}
        multiple
        accept="image/*"
        className="hidden"
      />
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Category selector                                                  */
/* ------------------------------------------------------------------ */
const CategorySelector = memo(function CategorySelector({
  category,
  onChangeCategory,
  savedCategories
}) {
  return (
    <div className="space-y-1.5">
      <label className="block font-semibold">Category</label>
      <input
        type="text"
        value={category}
        onChange={(e) => onChangeCategory(e.target.value)}
        placeholder="Select pill or type..."
        className="w-full px-3.5 py-2 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-semibold"
      />

      <div className="flex flex-wrap gap-1 pt-1">
        {savedCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onChangeCategory(cat)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
              category.toLowerCase() === cat.toLowerCase()
                ? 'bg-[#006241] text-white border-[#006241]'
                : 'bg-white text-[#5A655D] border-[#E7EBE7] hover:border-stone-400'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Variants section                                                   */
/* ------------------------------------------------------------------ */
const VariantsSection = memo(function VariantsSection({
  hasVariants,
  onToggleVariants,
  selectedColors,
  onToggleColor,
  onAddCustomColor,
  selectedSizes,
  onToggleSize,
  onAddCustomSize
}) {
  const [sizeType, setSizeType] = useState('Clothing');
  const [customColorInput, setCustomColorInput] = useState('');
  const [customSizeInput, setCustomSizeInput] = useState('');

  const customColors = useMemo(
    () => selectedColors.filter((c) => !PRESET_COLORS_SET.has(c)),
    [selectedColors]
  );

  const customSizes = useMemo(
    () => selectedSizes.filter((s) => !ALL_PRESET_SIZES_SET.has(s)),
    [selectedSizes]
  );

  const handleColorKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = customColorInput.trim();
      if (val) {
        onAddCustomColor(val);
        setCustomColorInput('');
      }
    }
  };

  const handleSizeKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = customSizeInput.trim();
      if (val) {
        onAddCustomSize(val);
        setCustomSizeInput('');
      }
    }
  };

  return (
    <div className="border border-[#E7EBE7] rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-bold text-[#111813]">
          <Layers className="w-4 h-4 text-[#006241]" />
          <span>Product Variants (Options)</span>
        </div>
        <input
          type="checkbox"
          checked={hasVariants}
          onChange={(e) => onToggleVariants(e.target.checked)}
          className="w-4 h-4 accent-[#006241] cursor-pointer"
        />
      </div>

      {hasVariants && (
        <div className="space-y-4 pt-3 border-t border-[#E7EBE7]">
          <div className="space-y-2">
            <span className="block text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">
              Colors
            </span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLOR_NAMES.map((col) => {
                const active = selectedColors.includes(col);
                return (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onToggleColor(col)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                      active
                        ? 'bg-[#006241] text-white border-[#006241]'
                        : 'bg-[#F4F6F4] text-[#5A655D] border-[#E7EBE7] hover:border-stone-400'
                    }`}
                  >
                    {col}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={customColorInput}
                onChange={(e) => setCustomColorInput(e.target.value)}
                onKeyDown={handleColorKeyDown}
                placeholder="Custom color & press Enter..."
                className="flex-1 px-3 py-1.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const val = customColorInput.trim();
                  if (val) {
                    onAddCustomColor(val);
                    setCustomColorInput('');
                  }
                }}
                className="px-3 py-1.5 bg-[#111813] text-white rounded-xl text-xs font-bold active:scale-95"
              >
                + Add
              </button>
            </div>

            {customColors.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customColors.map((c) => (
                  <span
                    key={c}
                    className="px-2.5 py-1 bg-[#E8F0E9] border border-[#C2D6C5] text-[#006241] rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>{c}</span>
                    <button type="button" onClick={() => onToggleColor(c)}>
                      <X className="w-3 h-3 text-stone-500 hover:text-black" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 pt-2 border-t border-[#E7EBE7]">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">
                Sizes
              </span>
              <div className="flex bg-[#F4F6F4] p-0.5 rounded-lg border border-[#E7EBE7] text-[10px] font-bold">
                {Object.keys(PRESET_SIZE_GROUPS).map((grp) => (
                  <button
                    key={grp}
                    type="button"
                    onClick={() => setSizeType(grp)}
                    className={`px-2 py-0.5 rounded-md transition ${
                      sizeType === grp ? 'bg-white text-[#111813] shadow-xs' : 'text-[#5A655D]'
                    }`}
                  >
                    {grp}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_SIZE_GROUPS[sizeType].map((sz) => {
                const active = selectedSizes.includes(sz);
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => onToggleSize(sz)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold border transition ${
                      active
                        ? 'bg-[#006241] text-white border-[#006241]'
                        : 'bg-[#F4F6F4] text-[#5A655D] border-[#E7EBE7] hover:border-stone-400'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-1.5 pt-1">
              <input
                type="text"
                value={customSizeInput}
                onChange={(e) => setCustomSizeInput(e.target.value)}
                onKeyDown={handleSizeKeyDown}
                placeholder="Custom size (e.g. 42mm) & press Enter..."
                className="flex-1 px-3 py-1.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  const val = customSizeInput.trim();
                  if (val) {
                    onAddCustomSize(val);
                    setCustomSizeInput('');
                  }
                }}
                className="px-3 py-1.5 bg-[#111813] text-white rounded-xl text-xs font-bold active:scale-95"
              >
                + Add
              </button>
            </div>

            {customSizes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {customSizes.map((sz) => (
                  <span
                    key={sz}
                    className="px-2.5 py-1 bg-[#E8F0E9] border border-[#C2D6C5] text-[#006241] rounded-lg text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>{sz}</span>
                    <button type="button" onClick={() => onToggleSize(sz)}>
                      <X className="w-3 h-3 text-stone-500 hover:text-black" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Product modal                                                      */
/* ------------------------------------------------------------------ */
const ProductModal = memo(function ProductModal({
  isOpen,
  onClose,
  editingProduct,
  sellerId,
  savedCategories,
  onSaveCategory,
  onProductSaved
}) {
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [title, setTitle] = useState(editingProduct?.title || '');
  const [description, setDescription] = useState(editingProduct?.description || '');
  const [price, setPrice] = useState(editingProduct?.price?.toString() || '');
  const [compareAtPrice, setCompareAtPrice] = useState(editingProduct?.compare_at_price?.toString() || '');
  const [costPrice, setCostPrice] = useState(editingProduct?.cost_price?.toString() || '');
  const [stockCount, setStockCount] = useState(editingProduct?.stock_count?.toString() || '');
  const [category, setCategory] = useState(editingProduct?.category || 'General');
  const [photoUrls, setPhotoUrls] = useState(editingProduct?.photo_urls || []);
  const [freeDelivery, setFreeDelivery] = useState(Boolean(editingProduct?.free_delivery));

  const initialVariants = editingProduct?.variants || [];
  const [hasVariants, setHasVariants] = useState(initialVariants.length > 0);
  const [selectedSizes, setSelectedSizes] = useState(() =>
    Array.from(new Set(initialVariants.map((v) => v.size).filter(Boolean)))
  );
  const [selectedColors, setSelectedColors] = useState(() =>
    Array.from(new Set(initialVariants.map((v) => v.color).filter(Boolean)))
  );

  const { profit, margin } = useMemo(() => {
    const p = parseFloat(price || 0);
    const c = parseFloat(costPrice || 0);
    if (p > 0 && c > 0) {
      const prof = p - c;
      return { profit: prof, margin: Math.round((prof / p) * 100) };
    }
    return { profit: null, margin: null };
  }, [price, costPrice]);

  const handlePhotoSelect = useCallback(async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files.slice(0, 8 - photoUrls.length)) {
        const url = await uploadStoreAsset(file, 'products');
        uploadedUrls.push(url);
      }
      setPhotoUrls((prev) => [...prev, ...uploadedUrls]);
      notify(`Uploaded ${uploadedUrls.length} image(s)!`);
    } catch (err) {
      notify('Upload failed: ' + err.message, 'error');
    } finally {
      setUploading(false);
    }
  }, [photoUrls.length]);

  const handleRemovePhoto = useCallback((idx) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleMakeMain = useCallback((idx) => {
    if (idx === 0) return;
    setPhotoUrls((prev) => [prev[idx], ...prev.filter((_, i) => i !== idx)]);
    notify('Main cover photo set.');
  }, []);

  const handleToggleColor = useCallback((col) => {
    setSelectedColors((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  }, []);

  const handleAddCustomColor = useCallback((col) => {
    setSelectedColors((prev) => prev.includes(col) ? prev : [...prev, col]);
  }, []);

  const handleToggleSize = useCallback((sz) => {
    setSelectedSizes((prev) => prev.includes(sz) ? prev.filter((s) => s !== sz) : [...prev, sz]);
  }, []);

  const handleAddCustomSize = useCallback((sz) => {
    setSelectedSizes((prev) => prev.includes(sz) ? prev : [...prev, sz]);
  }, []);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !price) {
      notify('Title and price are required.', 'error');
      return;
    }
    setSubmitting(true);

    try {
      const cleanCat = category.trim() || 'General';
      onSaveCategory(cleanCat);

      const variantPayload = [];
      const baseStock = parseInt(stockCount || 0, 10);

      if (hasVariants) {
        if (selectedSizes.length > 0 && selectedColors.length > 0) {
          selectedSizes.forEach((sz) => {
            selectedColors.forEach((col) => {
              variantPayload.push({
                size: sz,
                color: col,
                stock: Math.max(1, Math.floor(baseStock / (selectedSizes.length * selectedColors.length)) || 1)
              });
            });
          });
        } else if (selectedSizes.length > 0) {
          selectedSizes.forEach((sz) => {
            variantPayload.push({
              size: sz,
              color: null,
              stock: Math.max(1, Math.floor(baseStock / selectedSizes.length) || 1)
            });
          });
        } else if (selectedColors.length > 0) {
          selectedColors.forEach((col) => {
            variantPayload.push({
              size: null,
              color: col,
              stock: Math.max(1, Math.floor(baseStock / selectedColors.length) || 1)
            });
          });
        }
      }

      if (editingProduct?.id) {
        const updated = await updateProduct(editingProduct.id, {
          title: title.trim(),
          price: parseFloat(price),
          compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : null,
          cost_price: costPrice ? parseFloat(costPrice) : null,
          description: description.trim(),
          category: cleanCat,
          stock_count: baseStock,
          photo_urls: photoUrls,
          variants: variantPayload,
          free_delivery: freeDelivery
        });
        onProductSaved(updated, true);
        notify('Product updated successfully!');
      } else {
        const created = await createProduct({
          sellerId,
          title: title.trim(),
          price: parseFloat(price),
          compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
          costPrice: costPrice ? parseFloat(costPrice) : null,
          description: description.trim(),
          trackStock: true,
          stockCount: baseStock,
          category: cleanCat,
          photoUrls: photoUrls,
          variants: variantPayload,
          freeDelivery
        });
        onProductSaved(created, false);
        notify('Product published to store!');
      }
      onClose();
    } catch (err) {
      notify(err.message || 'Failed to save product', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#111813]/70 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-[32px] p-6 max-w-lg w-full shadow-2xl space-y-4 max-h-[92dvh] overflow-y-auto text-[#111813]">
        <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
          <h3 className="font-extrabold text-sm">
            {editingProduct ? 'Edit Product' : 'Add New Product'}
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-black">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <PhotoTray
            photoUrls={photoUrls}
            onPhotoSelect={handlePhotoSelect}
            onRemovePhoto={handleRemovePhoto}
            onMakeMain={handleMakeMain}
            uploading={uploading}
          />

          <div className="space-y-3">
            <div>
              <label className="block font-semibold mb-1">Product Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Classic Automatic Watch"
                required
                className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe specifications or materials..."
                className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
              />
            </div>
          </div>

          <CategorySelector
            category={category}
            onChangeCategory={setCategory}
            savedCategories={savedCategories}
          />

          <div className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-[#111813]">
              <DollarSign className="w-4 h-4 text-[#006241]" />
              <span>Pricing & Margins</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-[#5A655D] mb-1">Selling Price *</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="15000"
                  required
                  className="w-full px-3 py-2 bg-white border border-[#E7EBE7] rounded-xl font-bold text-[#006241] font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#5A655D] mb-1">Compare-at Price</label>
                <input
                  type="number"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  placeholder="18000"
                  className="w-full px-3 py-2 bg-white border border-[#E7EBE7] rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-[#5A655D] mb-1">Cost (Private)</label>
                <input
                  type="number"
                  value={costPrice}
                  onChange={(e) => setCostPrice(e.target.value)}
                  placeholder="9500"
                  className="w-full px-3 py-2 bg-white border border-[#E7EBE7] rounded-xl font-mono"
                />
              </div>
            </div>

            <p className="text-[10px] text-[#5A655D] leading-relaxed">
              Compare-at price shows as a strikethrough "was" price on the storefront. Cost is private — used for profit calc only.
            </p>

            {profit !== null && (
              <div className="pt-2 border-t border-[#E7EBE7] flex justify-between items-center text-[11px]">
                <span className="font-semibold text-[#5A655D]">Calculated Profit:</span>
                <span className={`font-black ${margin < 20 ? 'text-amber-700' : 'text-[#006241]'}`}>
                  {formatLKR(profit)} ({margin}% Margin)
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block font-semibold mb-1">Available Stock Units</label>
            <input
              type="number"
              min="0"
              value={stockCount}
              onChange={(e) => setStockCount(e.target.value)}
              placeholder="e.g. 15 (leave blank if made to order)"
              className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold font-mono"
            />
          </div>

          <div className="border border-[#E7EBE7] rounded-2xl p-3.5 bg-stone-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#006241]" />
                <div>
                  <div className="font-bold text-xs">Free Islandwide Delivery</div>
                  <div className="text-[10px] text-[#5A655D]">If checked, orders with this item ship free</div>
                </div>
              </div>
              <input
                type="checkbox"
                checked={freeDelivery}
                onChange={(e) => setFreeDelivery(e.target.checked)}
                className="w-4 h-4 accent-[#006241] cursor-pointer"
              />
            </div>
          </div>

          <VariantsSection
            hasVariants={hasVariants}
            onToggleVariants={setHasVariants}
            selectedColors={selectedColors}
            onToggleColor={handleToggleColor}
            onAddCustomColor={handleAddCustomColor}
            selectedSizes={selectedSizes}
            onToggleSize={handleToggleSize}
            onAddCustomSize={handleAddCustomSize}
          />

          <button
            type="submit"
            disabled={submitting || uploading}
            className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-3"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : editingProduct ? 'Save Changes' : 'Publish Product'}
          </button>
        </form>
      </div>
    </div>
  );
});

/* ------------------------------------------------------------------ */
/*  Main catalog page                                                  */
/* ------------------------------------------------------------------ */
export default function Products({ seller, products = [], setProducts }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [restockProduct, setRestockProduct] = useState(null);
  const [restockCount, setRestockCount] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Safe localStorage read — never crash on corrupt data
  const [savedCategories, setSavedCategories] = useState(() => {
    try {
      const local = localStorage.getItem(`ordy_cats_${seller?.id}`);
      if (!local) return DEFAULT_CATEGORIES;
      const parsed = JSON.parse(local);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_CATEGORIES;
    } catch {
      return DEFAULT_CATEGORIES;
    }
  });

  const handleSaveCategory = useCallback((newCat) => {
    setSavedCategories((prev) => {
      if (!prev.includes(newCat)) {
        const next = [newCat, ...prev];
        try {
          localStorage.setItem(`ordy_cats_${seller?.id}`, JSON.stringify(next));
        } catch {
          /* non-blocking */
        }
        return next;
      }
      return prev;
    });
  }, [seller?.id]);

  const handleProductSaved = useCallback((productData, isEdit) => {
    if (typeof setProducts === 'function') {
      if (isEdit) {
        setProducts((prev) => prev.map((p) => (p.id === productData.id ? productData : p)));
      } else {
        setProducts((prev) => [productData, ...prev]);
      }
    }
  }, [setProducts]);

  const handleRestockSubmit = async (e) => {
    e.preventDefault();
    if (!restockProduct || restockCount === '') return;

    try {
      const updated = await updateProductStock(restockProduct.id, restockCount);
      if (typeof setProducts === 'function') {
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
      setRestockProduct(null);
      notify('Stock updated successfully.');
    } catch (err) {
      notify(err.message || 'Restock failed', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product permanently?')) return;
    try {
      await deleteProduct(id);
      if (typeof setProducts === 'function') {
        setProducts((prev) => prev.filter((p) => p.id !== id));
      }
      notify('Product deleted.');
    } catch (err) {
      notify(err.message || 'Delete failed', 'error');
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Per-product share                                                 */
  /*  - Mobile (iOS / Android): native share sheet                     */
  /*  - Desktop (Windows / macOS / Linux): direct clipboard copy       */
  /* ---------------------------------------------------------------- */
  const handleShareProduct = async (product) => {
    const link = buildProductLink(seller?.handle, product.id);
    if (!link) {
      notify('Store handle not set. Configure it in Settings.', 'error');
      return;
    }

    const useNative = prefersNativeShare() && typeof navigator !== 'undefined' && navigator.share;

    if (useNative) {
      const shareMessage = `${product.title} — ${formatLKR(product.price)}\n\nOrder here: ${link}`;
      try {
        await navigator.share({
          title: product.title,
          text: shareMessage,
        });
        return;
      } catch (err) {
        // User cancelled — respect it, no fallback
        if (err?.name === 'AbortError') return;
        // Any other failure — fall through to clipboard copy
      }
    }

    // Clipboard copy (desktop default, and mobile fallback)
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(product.id);
      notify('Product order link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt('Copy this product order link:', link);
    }
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#E7EBE7] rounded-[28px] p-5 shadow-xs">
        <div>
          <h1 className="text-lg font-black text-[#111813]">Products Catalog</h1>
          <p className="text-xs text-[#5A655D]">
            {products.length} live item{products.length === 1 ? '' : 's'}
          </p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setModalOpen(true); }}
          className="px-4 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4" /> Add Product
        </button>
      </div>

      {/* Tip banner */}
      {products.length > 0 && (
        <div className="bg-[#E8F0E9] border border-[#C2D6C5] rounded-2xl p-3 text-[11px] text-[#006241] flex items-start gap-2">
          <Share2 className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Tip:</strong> Tap the <Share2 className="w-3 h-3 inline" /> icon on any product
            to get its <strong>direct order link</strong>. Paste it in your Instagram bio,
            WhatsApp status, or TikTok description — buyers tap once and go straight to
            that product's order page.
          </div>
        </div>
      )}

      {/* Product list */}
      <div className="space-y-2">
        {products.length === 0 ? (
          <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-10 text-center text-xs text-[#5A655D]">
            No products found. Tap <strong>"+ Add Product"</strong> to launch your catalog.
          </div>
        ) : (
          products.map((p) => {
            const hasImgs = p.photo_urls && p.photo_urls.length > 0;
            const hasVar = p.variants && p.variants.length > 0;
            const isCopied = copiedId === p.id;

            return (
              <div
                key={p.id}
                className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 flex justify-between items-center shadow-xs hover:border-[#006241] transition"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-14 h-14 rounded-2xl bg-[#F4F6F4] border border-[#E7EBE7] flex items-center justify-center overflow-hidden shrink-0">
                    {hasImgs ? (
                      <img src={p.photo_urls[0]} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Tag className="w-5 h-5 text-[#006241]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-extrabold text-xs text-[#111813] truncate">{p.title}</h2>
                    <div className="text-xs text-[#006241] font-black mt-0.5">{formatLKR(p.price)}</div>
                    <div className="text-[11px] text-[#5A655D] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span>{p.track_stock ? `${p.stock_count} units` : 'Made to order'}</span>
                      <span>•</span>
                      <span>{p.category}</span>
                      {p.free_delivery && (
                        <>
                          <span>•</span>
                          <span className="text-[#006241] font-bold">Free Delivery</span>
                        </>
                      )}
                      {hasVar && (
                        <>
                          <span>•</span>
                          <span className="text-[#006241] font-bold">{p.variants.length} options</span>
                        </>
                      )}
                      {hasImgs && p.photo_urls.length > 1 && (
                        <>
                          <span>•</span>
                          <span>{p.photo_urls.length} photos</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleShareProduct(p)}
                    className={`p-2 rounded-xl transition active:scale-95 ${
                      isCopied
                        ? 'bg-[#E8F0E9] text-[#006241]'
                        : 'text-[#5A655D] hover:text-[#006241] bg-[#F4F6F4]'
                    }`}
                    title={isCopied ? 'Link copied!' : 'Share product order link'}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => { setEditingProduct(p); setModalOpen(true); }}
                    className="p-2 text-stone-600 hover:text-[#006241] bg-[#F4F6F4] hover:bg-stone-200 rounded-xl transition active:scale-95"
                    title="Edit Product"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      setRestockProduct(p);
                      setRestockCount(p.stock_count.toString());
                    }}
                    className="p-2 text-[#006241] bg-[#E8F0E9] rounded-xl transition active:scale-95"
                    title="Update Stock"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-2 text-stone-400 hover:text-rose-600 transition active:scale-95"
                    title="Delete Product"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {modalOpen && (
        <ProductModal
          key={editingProduct?.id || 'new-product'}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          editingProduct={editingProduct}
          sellerId={seller?.id}
          savedCategories={savedCategories}
          onSaveCategory={handleSaveCategory}
          onProductSaved={handleProductSaved}
        />
      )}

      {restockProduct && (
        <div className="fixed inset-0 bg-[#111813]/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[28px] p-5 max-w-xs w-full shadow-2xl space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm">Update Stock Units</h3>
              <button onClick={() => setRestockProduct(null)} className="text-stone-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[#5A655D] truncate">Item: {restockProduct.title}</p>
            <form onSubmit={handleRestockSubmit} className="space-y-3">
              <input
                type="number"
                min="0"
                value={restockCount}
                onChange={(e) => setRestockCount(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold font-mono"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-[#006241] text-white font-bold rounded-xl active:scale-95"
              >
                Save Stock
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}