import React, { useState, useRef } from 'react';
import { 
  Save, 
  Loader2, 
  Truck, 
  Store, 
  Image as ImageIcon, 
  Share2, 
  Upload
} from 'lucide-react';
import { supabase } from '../supabase';
import { updateSellerProfile } from '../services/dbService';
import { uploadStoreAsset } from '../services/storageService';
import { notify } from '../components/Toast';

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

export default function Settings({ seller, setSeller }) {
  // Brand Identity Fields
  const [shopName, setShopName] = useState(seller?.shop_name || '');
  const [handle, setHandle] = useState(seller?.handle || '');
  const [bio, setBio] = useState(seller?.bio || '');
  const [logoUrl, setLogoUrl] = useState(seller?.logo_url || '');
  const [bannerUrl, setBannerUrl] = useState(seller?.banner_url || '');
  
  // Social Channels
  const [whatsapp, setWhatsapp] = useState(seller?.whatsapp_number || '');
  const [instagram, setInstagram] = useState(seller?.instagram_handle || '');
  const [tiktok, setTiktok] = useState(seller?.tiktok_handle || '');
  const [facebook, setFacebook] = useState(seller?.facebook_handle || '');

  // Delivery & Risk Controls
  const [homeDistrict, setHomeDistrict] = useState(seller?.home_district || 'Colombo');
  const [deliveryFee, setDeliveryFee] = useState(seller?.delivery_fee ?? 350);
  const [outstationFee, setOutstationFee] = useState(seller?.outstation_delivery_fee ?? 450);
  const [codEnabled, setCodEnabled] = useState(seller?.cod_enabled !== false);
  const [prepayHighRisk, setPrepayHighRisk] = useState(seller?.require_prepay_high_risk || false);

  // States
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // File Input References
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Logo Upload Handler
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const publicUrl = await uploadStoreAsset(file, 'logos');
      setLogoUrl(publicUrl);
      notify('Logo uploaded and compressed!');
    } catch (err) {
      notify('Logo upload failed: ' + err.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  // Banner Upload Handler
  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBanner(true);
    try {
      const publicUrl = await uploadStoreAsset(file, 'banners');
      setBannerUrl(publicUrl);
      notify('Banner uploaded and compressed!');
    } catch (err) {
      notify('Banner upload failed: ' + err.message, 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    const cleanIg = instagram.trim().replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '').replace(/\/$/, '');
    const cleanTiktok = tiktok.trim().replace(/^@/, '').replace(/^(https?:\/\/)?(www\.)?tiktok\.com\/@?/, '').replace(/\/$/, '');
    const cleanFb = facebook.trim().replace(/^(https?:\/\/)?(www\.)?facebook\.com\//, '').replace(/\/$/, '');

    try {
      if (cleanHandle !== seller.handle) {
        const { data: existing, error: checkErr } = await supabase
          .from('sellers')
          .select('id')
          .eq('handle', cleanHandle)
          .maybeSingle();

        if (checkErr) throw checkErr;
        if (existing && existing.id !== seller.id) {
          throw new Error(`The handle "${cleanHandle}" is already taken by another store.`);
        }
      }

      const updated = await updateSellerProfile(seller.id, {
        shop_name: shopName.trim(),
        handle: cleanHandle,
        bio: bio.trim(),
        logo_url: logoUrl,
        banner_url: bannerUrl,
        whatsapp_number: whatsapp.trim(),
        instagram_handle: cleanIg,
        tiktok_handle: cleanTiktok,
        facebook_handle: cleanFb,
        home_district: homeDistrict,
        delivery_fee: Number(deliveryFee),
        outstation_delivery_fee: Number(outstationFee),
        cod_enabled: codEnabled,
        require_prepay_high_risk: prepayHighRisk
      });

      setSeller(updated);
      localStorage.setItem('orderly_active_handle', updated.handle);
      notify('Store brand and settings updated successfully!');
    } catch (err) {
      notify(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-2xl mx-auto pb-12">
      {/* Top Save Sticky Bar */}
      <div className="flex justify-between items-center bg-white border border-[#E7EBE7] rounded-[28px] p-5 shadow-xs">
        <div>
          <h1 className="text-lg font-black text-[#111813]">Store Identity & Settings</h1>
          <p className="text-xs text-[#5A655D]">Manage branding, links, and fulfillment terms</p>
        </div>
        <button
          type="submit"
          disabled={saving || uploadingLogo || uploadingBanner}
          className="px-5 py-2.5 bg-[#006241] hover:bg-[#004F34] text-white rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Changes</>}
        </button>
      </div>

      {/* LIVE STOREFRONT HEADER PREVIEW */}
      <div className="bg-white border border-[#E7EBE7] rounded-[28px] overflow-hidden shadow-xs">
        <div className="px-5 py-3 border-b border-[#E7EBE7] flex justify-between items-center bg-stone-50/50">
          <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">Live Storefront Preview</span>
          <span className="text-[10px] text-[#006241] font-bold">Public Buyer View</span>
        </div>

        <div className="p-5 space-y-3">
          <div className="w-full h-32 sm:h-40 rounded-2xl bg-stone-100 border border-[#E7EBE7] overflow-hidden relative flex items-center justify-center">
            {bannerUrl ? (
              <img 
                src={bannerUrl} 
                alt="Banner preview" 
                className="w-full h-full object-cover"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            ) : (
              <div className="text-stone-400 text-xs flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4" /> Default Gradient Banner
              </div>
            )}
          </div>

          <div className="flex items-center gap-3.5 -mt-8 relative z-10 px-2">
            <div className="w-16 h-16 rounded-2xl bg-[#006241] border-4 border-white shadow-md flex items-center justify-center text-white font-black text-xl overflow-hidden shrink-0">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Logo preview" 
                  className="w-full h-full object-cover"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              ) : (
                shopName?.[0] || 'O'
              )}
            </div>
            <div className="pt-6 min-w-0">
              <div className="font-extrabold text-sm text-[#111813] truncate">{shopName || 'Store Name'}</div>
              <div className="text-[11px] text-[#006241] font-mono font-bold">orderly.lk/{handle || 'handle'}</div>
            </div>
          </div>
          {bio && <p className="text-xs text-[#5A655D] px-2 pt-1">{bio}</p>}
        </div>
      </div>

      {/* BRAND & VISUAL ASSETS */}
      <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-4 text-xs">
        <div className="flex items-center gap-2 font-black text-sm text-[#111813]">
          <Store className="w-4 h-4 text-[#006241]" />
          <span>Brand Visual Assets</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-[#E7EBE7] rounded-2xl p-4 space-y-3 bg-[#F4F6F4]/50">
            <div className="font-bold text-[#111813]">Store Logo (Square)</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-white border border-[#E7EBE7] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-stone-300" />
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] rounded-xl text-[11px] font-bold text-[#111813] flex items-center gap-1 shadow-xs transition active:scale-95"
                >
                  {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5" /> Pick Image</>}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="text-[10px] text-rose-600 hover:underline block font-semibold"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-[#5A655D]">Recommended: 500x500px JPG/PNG</p>
          </div>

          <div className="border border-[#E7EBE7] rounded-2xl p-4 space-y-3 bg-[#F4F6F4]/50">
            <div className="font-bold text-[#111813]">Store Banner (Wide)</div>
            <div className="flex items-center gap-3">
              <div className="w-20 h-14 rounded-xl bg-white border border-[#E7EBE7] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-stone-300" />
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <input
                  type="file"
                  ref={bannerInputRef}
                  onChange={handleBannerUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                  className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] rounded-xl text-[11px] font-bold text-[#111813] flex items-center gap-1 shadow-xs transition active:scale-95"
                >
                  {uploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5" /> Pick Image</>}
                </button>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="text-[10px] text-rose-600 hover:underline block font-semibold"
                  >
                    Remove Banner
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-[#5A655D]">Recommended: 1200x400px wide image</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label className="block font-semibold mb-1">Shop Display Name *</label>
            <input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Store URL Handle *</label>
            <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2 text-xs">
              <span className="text-[#5A655D] font-mono select-none">orderly.lk/</span>
              <input
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                required
                className="flex-1 bg-transparent font-mono font-bold focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-1">Store Bio / Slogan</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={2}
            placeholder="e.g. Handcrafted pure linen menswear. Islandwide Cash on Delivery."
            className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
          />
        </div>
      </div>

      {/* SOCIAL MEDIA & DIRECT CHANNELS */}
      <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-4 text-xs">
        <div className="flex items-center gap-2 font-black text-sm text-[#111813]">
          <Share2 className="w-4 h-4 text-[#006241]" />
          <span>Social Media & Direct Channels</span>
        </div>

        <div>
          <label className="block font-semibold mb-1">WhatsApp Business Number *</label>
          <input
            type="tel"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-bold"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block font-semibold mb-1">Instagram</label>
            <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2 text-xs">
              <span className="text-[#5A655D] select-none font-bold">@</span>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="cinnamonbay.lk"
                className="flex-1 bg-transparent font-bold focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">TikTok</label>
            <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2 text-xs">
              <span className="text-[#5A655D] select-none font-bold">@</span>
              <input
                type="text"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="cinnamonbay"
                className="flex-1 bg-transparent font-bold focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Facebook Page</label>
            <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2 text-xs">
              <span className="text-[#5A655D] select-none font-bold text-[10px]">fb.com/</span>
              <input
                type="text"
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="cinnamonbaylinen"
                className="flex-1 bg-transparent font-bold focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* DELIVERY RATES & COD SHIELD */}
      <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-4 text-xs">
        <div className="flex items-center gap-2 font-black text-sm text-[#111813]">
          <Truck className="w-4 h-4 text-[#006241]" />
          <span>Delivery Rates & COD Shield</span>
        </div>

        {/* STORE HOME DISTRICT PICKER */}
        <div>
          <label className="block font-semibold mb-1">Store Home District *</label>
          <select
            value={homeDistrict}
            onChange={(e) => setHomeDistrict(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold text-xs"
          >
            {SL_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <p className="text-[10px] text-[#5A655D] mt-1">
            Orders delivered inside this district will be charged your Base Local Rate. All other districts are charged the Outstation Rate.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Base Local Rate (Rs.)</label>
            <input
              type="number"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold font-mono"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1">Outstation Rate (Rs.)</label>
            <input
              type="number"
              value={outstationFee}
              onChange={(e) => setOutstationFee(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold font-mono"
            />
          </div>
        </div>

        <div className="pt-2 border-t border-[#E7EBE7] space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[#111813]">Enable Cash on Delivery (COD)</div>
              <div className="text-[11px] text-[#5A655D]">Allow customers to pay in cash upon receiving goods</div>
            </div>
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
              className="w-5 h-5 accent-[#006241] cursor-pointer"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-bold text-[#111813]">High-Risk Prepay Requirement</div>
              <div className="text-[11px] text-[#5A655D]">Require advance bank payment for flagged high-risk numbers</div>
            </div>
            <input
              type="checkbox"
              checked={prepayHighRisk}
              onChange={(e) => setPrepayHighRisk(e.target.checked)}
              className="w-5 h-5 accent-[#006241] cursor-pointer"
            />
          </div>
        </div>
      </div>
    </form>
  );
}