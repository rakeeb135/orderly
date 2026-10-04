import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Save,
  Loader2,
  Truck,
  Store,
  Image as ImageIcon,
  Share2,
  Upload,
  Bell,
  BellOff,
  Smartphone,
  Landmark,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  ChevronDown,
  ShieldCheck,
  LogOut,
  ExternalLink,
  AlertCircle,
  Calendar,
} from 'lucide-react';
import { supabase } from '../supabase';
import {
  updateSellerProfile,
  getPushStatus,
  subscribeToPush,
  unsubscribeFromPush,
  fetchAllOrdersForExport,
  fetchAllCustomersForExport,
} from '../services/dbService';
import { uploadStoreAsset } from '../services/storageService';
import {
  generateCSV,
  downloadTextFile,
  datedFilename,
  formatDateForCSV,
  formatItemsForCSV,
  forceText,
} from '../utils/csvExport';
import { notify } from '../components/Toast';
import ImageCropper from '../components/ImageCropper';

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

const DEFAULT_FEE = 2990;

/* ------------------------------------------------------------------ */
/*  Collapsible section component                                     */
/* ------------------------------------------------------------------ */
function AccountSection({
  icon: Icon,
  title,
  summary,
  isOpen,
  onToggle,
  hasUnsavedChanges,
  children,
}) {
  return (
    <div className="bg-white border border-[#E7EBE7] rounded-[24px] shadow-xs overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover:bg-[#F4F6F4]/40 transition cursor-pointer"
      >
        <div className="w-9 h-9 rounded-xl bg-[#E8F0E9] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[#006241]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-[#111813]">{title}</span>
            {hasUnsavedChanges && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Unsaved changes" />
            )}
          </div>
          {summary && (
            <div className="text-[11px] text-[#5A655D] mt-0.5 truncate">{summary}</div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-stone-400 shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-[#E7EBE7] p-4 sm:p-6 space-y-4 text-xs animate-in fade-in duration-150">
          {children}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Subscription card — always visible at top                          */
/* ------------------------------------------------------------------ */
function SubscriptionCard({ seller }) {
  const navigate = useNavigate();

  if (seller?.is_super_admin) return null;

  const expiryDate = seller?.subscription_expires_at
    ? new Date(seller.subscription_expires_at)
    : null;
  const msRemaining = expiryDate ? expiryDate.getTime() - Date.now() : 0;
  const daysRemaining = expiryDate ? Math.ceil(msRemaining / (1000 * 60 * 60 * 24)) : 0;
  const isExpired = daysRemaining < 0;
  const isExpiring = daysRemaining >= 0 && daysRemaining <= 7;
  const isTrial = seller?.subscription_status === 'trial';
  const fee = Number(seller?.monthly_fee) || DEFAULT_FEE;

  const statusMeta = isExpired
    ? { label: `Expired ${Math.abs(daysRemaining)}d ago`, wrapper: 'bg-rose-50 border-rose-200', iconColor: 'text-rose-600', titleColor: 'text-rose-900', subColor: 'text-rose-700', ctaBg: 'bg-rose-600 hover:bg-rose-700' }
    : isExpiring
    ? { label: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left`, wrapper: 'bg-amber-50 border-amber-200', iconColor: 'text-amber-700', titleColor: 'text-amber-900', subColor: 'text-amber-700', ctaBg: 'bg-amber-700 hover:bg-amber-800' }
    : { label: 'Active', wrapper: 'bg-[#E8F0E9] border-[#C2D6C5]', iconColor: 'text-[#006241]', titleColor: 'text-[#006241]', subColor: 'text-[#006241]/80', ctaBg: 'bg-[#006241] hover:bg-[#004F34]' };

  const expiryDisplay = expiryDate
    ? expiryDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Not set';

  return (
    <div className={`border rounded-[24px] p-5 shadow-xs ${statusMeta.wrapper}`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/70 flex items-center justify-center shrink-0">
          <Calendar className={`w-4 h-4 ${statusMeta.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black text-sm ${statusMeta.titleColor}`}>Subscription</span>
            <span className="px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold">
              {statusMeta.label}
            </span>
          </div>
          <div className={`text-[11px] mt-1 leading-relaxed ${statusMeta.subColor}`}>
            {isExpired
              ? `Your access ended on ${expiryDisplay}. Renew to bring your store back online.`
              : isTrial
              ? `Free trial · expires ${expiryDisplay}. Renew anytime to keep your store live.`
              : `Renews on ${expiryDisplay} · Rs. ${fee.toLocaleString('en-LK')}/month`}
          </div>
        </div>
      </div>

      {(isExpired || isExpiring) && (
        <button
          type="button"
          onClick={() => navigate('/renew')}
          className={`mt-3 w-full py-2.5 text-white rounded-xl text-xs font-bold transition active:scale-[0.98] cursor-pointer ${statusMeta.ctaBg}`}
        >
          Renew Now
        </button>
      )}
    </div>
  );
}

export default function Settings({ seller, setSeller }) {
  const navigate = useNavigate();

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

  // Bank Transfer / Payment Collection
  const [bankName, setBankName] = useState(seller?.bank_details?.bank_name || '');
  const [accountName, setAccountName] = useState(seller?.bank_details?.account_name || '');
  const [accountNumber, setAccountNumber] = useState(seller?.bank_details?.account_number || '');
  const [bankBranch, setBankBranch] = useState(seller?.bank_details?.branch || '');

  // States
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);

  // Push notification state
  const [pushStatus, setPushStatus] = useState('checking');
  const [pushBusy, setPushBusy] = useState(false);

  // Data export state
  const [exporting, setExporting] = useState(null);
  const [exportProgress, setExportProgress] = useState({ loaded: 0, total: 0 });
  const [lastExported, setLastExported] = useState(null);

  // File Input References
  const logoInputRef = useRef(null);
  const bannerInputRef = useRef(null);

  // Crop state
  const [logoCrop, setLogoCrop] = useState(null);
  const [bannerCrop, setBannerCrop] = useState(null);

  // Section expansion state — only one open at a time
  const [openSection, setOpenSection] = useState('subscription');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const status = await getPushStatus();
      if (mounted) setPushStatus(status);
    })();
    return () => { mounted = false; };
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Dirty checks per section                                         */
  /* ---------------------------------------------------------------- */
  const brandingDirty = useMemo(() => {
    if (!seller) return false;
    return (
      shopName !== (seller.shop_name || '') ||
      handle !== (seller.handle || '') ||
      bio !== (seller.bio || '') ||
      logoUrl !== (seller.logo_url || '') ||
      bannerUrl !== (seller.banner_url || '') ||
      whatsapp !== (seller.whatsapp_number || '') ||
      instagram !== (seller.instagram_handle || '') ||
      tiktok !== (seller.tiktok_handle || '') ||
      facebook !== (seller.facebook_handle || '')
    );
  }, [seller, shopName, handle, bio, logoUrl, bannerUrl, whatsapp, instagram, tiktok, facebook]);

  const deliveryDirty = useMemo(() => {
    if (!seller) return false;
    return (
      homeDistrict !== (seller.home_district || 'Colombo') ||
      String(deliveryFee) !== String(seller.delivery_fee ?? 350) ||
      String(outstationFee) !== String(seller.outstation_delivery_fee ?? 450) ||
      codEnabled !== (seller.cod_enabled !== false) ||
      prepayHighRisk !== (seller.require_prepay_high_risk || false) ||
      bankName !== (seller.bank_details?.bank_name || '') ||
      accountName !== (seller.bank_details?.account_name || '') ||
      accountNumber !== (seller.bank_details?.account_number || '') ||
      bankBranch !== (seller.bank_details?.branch || '')
    );
  }, [seller, homeDistrict, deliveryFee, outstationFee, codEnabled, prepayHighRisk, bankName, accountName, accountNumber, bankBranch]);

  const isDirty = brandingDirty || deliveryDirty;

  const handleDiscard = () => {
    if (!seller) return;
    setShopName(seller.shop_name || '');
    setHandle(seller.handle || '');
    setBio(seller.bio || '');
    setLogoUrl(seller.logo_url || '');
    setBannerUrl(seller.banner_url || '');
    setWhatsapp(seller.whatsapp_number || '');
    setInstagram(seller.instagram_handle || '');
    setTiktok(seller.tiktok_handle || '');
    setFacebook(seller.facebook_handle || '');
    setHomeDistrict(seller.home_district || 'Colombo');
    setDeliveryFee(seller.delivery_fee ?? 350);
    setOutstationFee(seller.outstation_delivery_fee ?? 450);
    setCodEnabled(seller.cod_enabled !== false);
    setPrepayHighRisk(seller.require_prepay_high_risk || false);
    setBankName(seller.bank_details?.bank_name || '');
    setAccountName(seller.bank_details?.account_name || '');
    setAccountNumber(seller.bank_details?.account_number || '');
    setBankBranch(seller.bank_details?.branch || '');
    notify('Changes discarded.');
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    }
    navigate('/login?mode=login');
  };

  /* ---------------------------------------------------------------- */
  /*  Push notifications                                               */
  /* ---------------------------------------------------------------- */
  const handleEnablePush = async () => {
    if (!seller?.id) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
      notify('Push is not configured. Missing VAPID key.', 'error');
      return;
    }
    setPushBusy(true);
    try {
      await subscribeToPush(seller.id, vapidKey);
      setPushStatus('subscribed');
      notify('Notifications enabled on this device!');
    } catch (err) {
      notify(err.message || 'Failed to enable notifications', 'error');
      const status = await getPushStatus();
      setPushStatus(status);
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      setPushStatus('not_subscribed');
      notify('Notifications disabled on this device.');
    } catch (err) {
      notify(err.message || 'Failed to disable notifications', 'error');
    } finally {
      setPushBusy(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Image upload helpers                                              */
  /* ---------------------------------------------------------------- */
  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const dataUrl = await fileToDataUrl(file);
      setLogoCrop({ dataUrl, originalFile: file });
    } catch (err) {
      notify('Could not read image: ' + err.message, 'error');
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const dataUrl = await fileToDataUrl(file);
      setBannerCrop({ dataUrl, originalFile: file });
    } catch (err) {
      notify('Could not read image: ' + err.message, 'error');
    }
  };

  const handleLogoApply = async (blob) => {
    setUploadingLogo(true);
    try {
      const file = new File([blob], 'logo.webp', { type: 'image/webp' });
      const publicUrl = await uploadStoreAsset(file, 'logos');
      setLogoUrl(publicUrl);
      notify('Logo uploaded!');
      setLogoCrop(null);
    } catch (err) {
      notify('Logo upload failed: ' + err.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleLogoSkipped = async () => {
    if (!logoCrop) return;
    setUploadingLogo(true);
    try {
      const publicUrl = await uploadStoreAsset(logoCrop.originalFile, 'logos');
      setLogoUrl(publicUrl);
      notify('Logo uploaded!');
      setLogoCrop(null);
    } catch (err) {
      notify('Logo upload failed: ' + err.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleBannerApply = async (blob) => {
    setUploadingBanner(true);
    try {
      const file = new File([blob], 'banner.webp', { type: 'image/webp' });
      const publicUrl = await uploadStoreAsset(file, 'banners');
      setBannerUrl(publicUrl);
      notify('Banner uploaded!');
      setBannerCrop(null);
    } catch (err) {
      notify('Banner upload failed: ' + err.message, 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleBannerSkipped = async () => {
    if (!bannerCrop) return;
    setUploadingBanner(true);
    try {
      const publicUrl = await uploadStoreAsset(bannerCrop.originalFile, 'banners');
      setBannerUrl(publicUrl);
      notify('Banner uploaded!');
      setBannerCrop(null);
    } catch (err) {
      notify('Banner upload failed: ' + err.message, 'error');
    } finally {
      setUploadingBanner(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Save                                                             */
  /* ---------------------------------------------------------------- */
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
        require_prepay_high_risk: prepayHighRisk,
        bank_details: {
          bank_name: bankName.trim(),
          account_name: accountName.trim(),
          account_number: accountNumber.trim(),
          branch: bankBranch.trim(),
        },
      });

      setSeller(updated);
      notify('Account updated successfully!');
    } catch (err) {
      notify(err.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Data export                                                      */
  /* ---------------------------------------------------------------- */
  const handleExportOrders = async () => {
    if (!seller?.id || exporting) return;
    setExporting('orders');
    setExportProgress({ loaded: 0, total: 0 });
    try {
      const orders = await fetchAllOrdersForExport(seller.id, (loaded, total) => {
        setExportProgress({ loaded, total });
      });
      if (!orders.length) {
        notify('No orders to export yet.', 'error');
        return;
      }
      const columns = [
        { key: 'order_code', label: 'Order Code' },
        { key: 'created_at', label: 'Date', map: (r) => forceText(formatDateForCSV(r.created_at)) },
        { key: 'status', label: 'Status' },
        { key: 'customer_name', label: 'Customer Name' },
        { key: 'customer_phone', label: 'Phone', map: (r) => forceText(r.customer_phone) },
        { key: 'secondary_phone', label: 'Secondary Phone', map: (r) => forceText(r.secondary_phone) },
        { key: 'delivery_address', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'district', label: 'District' },
        { key: 'items', label: 'Items', map: (r) => formatItemsForCSV(r.items) },
        { key: 'subtotal', label: 'Subtotal' },
        { key: 'delivery_fee', label: 'Delivery Fee' },
        { key: 'total_amount', label: 'Total' },
        { key: 'payment_method', label: 'Payment Method' },
        { key: 'payment_status', label: 'Payment Status' },
        { key: 'source', label: 'Source' },
      ];
      const csv = generateCSV(orders, columns);
      downloadTextFile(datedFilename('ordy-orders'), csv);
      notify(`Exported ${orders.length} orders.`);
      setLastExported('orders');
      setTimeout(() => setLastExported(null), 3000);
    } catch (err) {
      notify('Export failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setExporting(null);
      setExportProgress({ loaded: 0, total: 0 });
    }
  };

  const handleExportCustomers = async () => {
    if (!seller?.id || exporting) return;
    setExporting('customers');
    try {
      const customers = await fetchAllCustomersForExport(seller.id);
      if (!customers.length) {
        notify('No customers to export yet.', 'error');
        return;
      }
      const columns = [
        { key: 'name', label: 'Name' },
        { key: 'phone', label: 'Phone', map: (r) => forceText(r.phone) },
        { key: 'secondary_phone', label: 'Secondary Phone', map: (r) => forceText(r.secondary_phone) },
        { key: 'delivery_address', label: 'Address' },
        { key: 'city', label: 'City' },
        { key: 'district', label: 'District' },
        { key: 'total_orders', label: 'Total Orders' },
        { key: 'created_at', label: 'First Seen', map: (r) => forceText(formatDateForCSV(r.created_at)) },
      ];
      const csv = generateCSV(customers, columns);
      downloadTextFile(datedFilename('ordy-customers'), csv);
      notify(`Exported ${customers.length} customers.`);
      setLastExported('customers');
      setTimeout(() => setLastExported(null), 3000);
    } catch (err) {
      notify('Export failed: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      setExporting(null);
    }
  };

  const hasBankDetails = Boolean(bankName.trim() || accountNumber.trim());

  /* ---------------------------------------------------------------- */
  /*  Section summaries                                                */
  /* ---------------------------------------------------------------- */
  const brandingSummary = `${shopName || 'Your store'} · /${handle || 'handle'}`;

  const deliverySummary = (() => {
    const fee = Number(deliveryFee) || 350;
    const out = Number(outstationFee) || 450;
    const bankBit = hasBankDetails ? ' · Bank enabled' : '';
    return `Rs. ${fee} local · Rs. ${out} outstation${bankBit}`;
  })();

  const notificationsSummary =
    pushStatus === 'subscribed'
      ? 'Alerts on for this device'
      : pushStatus === 'denied'
      ? 'Alerts blocked'
      : pushStatus === 'unsupported'
      ? 'Alerts not supported here'
      : 'Alerts off · tap to enable';

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */
  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-2xl mx-auto pb-32">
      {/* Header */}
      <div className="px-1 pt-1">
        <h1 className="text-xl font-black tracking-tight text-[#111813]">Account</h1>
        <p className="text-xs text-[#5A655D] mt-1">Manage your store, delivery, and notifications</p>
      </div>

      {/* Subscription — always visible */}
      <SubscriptionCard seller={seller} />

      {/* Store & Branding */}
      <AccountSection
        icon={Store}
        title="Store & Branding"
        summary={brandingSummary}
        isOpen={openSection === 'branding'}
        onToggle={() => setOpenSection(openSection === 'branding' ? null : 'branding')}
        hasUnsavedChanges={brandingDirty}
      >
        {/* Logo + Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-[#E7EBE7] rounded-2xl p-4 space-y-3 bg-[#F4F6F4]/50">
            <div className="font-bold text-[#111813]">Store Logo</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-white border border-[#E7EBE7] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <Store className="w-6 h-6 text-stone-300" />
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] rounded-xl text-[11px] font-bold text-[#111813] flex items-center gap-1 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {uploadingLogo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5" /> Pick Image</>}
                </button>
                {logoUrl && (
                  <button
                    type="button"
                    onClick={() => setLogoUrl('')}
                    className="text-[10px] text-rose-600 hover:underline block font-semibold cursor-pointer"
                  >
                    Remove Logo
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-[#5A655D]">500×500px recommended</p>
          </div>

          <div className="border border-[#E7EBE7] rounded-2xl p-4 space-y-3 bg-[#F4F6F4]/50">
            <div className="font-bold text-[#111813]">Store Banner</div>
            <div className="flex items-center gap-3">
              <div className="w-20 h-14 rounded-xl bg-white border border-[#E7EBE7] flex items-center justify-center overflow-hidden shrink-0 shadow-xs">
                {bannerUrl ? (
                  <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-stone-300" />
                )}
              </div>
              <div className="space-y-1.5 flex-1">
                <input type="file" ref={bannerInputRef} onChange={handleBannerUpload} accept="image/*" className="hidden" />
                <button
                  type="button"
                  onClick={() => bannerInputRef.current?.click()}
                  disabled={uploadingBanner}
                  className="px-3 py-1.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] rounded-xl text-[11px] font-bold text-[#111813] flex items-center gap-1 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {uploadingBanner ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Upload className="w-3.5 h-3.5" /> Pick Image</>}
                </button>
                {bannerUrl && (
                  <button
                    type="button"
                    onClick={() => setBannerUrl('')}
                    className="text-[10px] text-rose-600 hover:underline block font-semibold cursor-pointer"
                  >
                    Remove Banner
                  </button>
                )}
              </div>
            </div>
            <p className="text-[10px] text-[#5A655D]">1200×400px recommended</p>
          </div>
        </div>

        {/* Live preview */}
        <div className="border border-[#E7EBE7] rounded-2xl overflow-hidden bg-white">
          <div className="px-4 py-2 border-b border-[#E7EBE7] flex justify-between items-center bg-[#F4F6F4]/50">
            <span className="text-[10px] font-bold text-[#5A655D] uppercase tracking-wider">Preview</span>
            <span className="text-[10px] text-[#006241] font-bold">Buyer view</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="w-full h-24 rounded-xl bg-stone-100 border border-[#E7EBE7] overflow-hidden relative flex items-center justify-center">
              {bannerUrl ? (
                <img src={bannerUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <div className="text-stone-400 text-[11px] flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" /> Default gradient
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 -mt-6 relative z-10 px-1">
              <div className="w-12 h-12 rounded-2xl bg-[#006241] border-4 border-white shadow-md flex items-center justify-center text-white font-black text-base overflow-hidden shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                ) : (
                  shopName?.[0] || 'O'
                )}
              </div>
              <div className="pt-5 min-w-0">
                <div className="font-extrabold text-xs text-[#111813] truncate">{shopName || 'Store Name'}</div>
                <div className="text-[10px] text-[#006241] font-mono font-bold truncate">
                  {window.location.host}/{handle || 'handle'}
                </div>
              </div>
            </div>
            {bio && <p className="text-[11px] text-[#5A655D] px-1 pt-1">{bio}</p>}
          </div>
        </div>

        {/* Name + Handle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <label className="block font-semibold mb-1">Your Store Link *</label>
            <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2.5 text-xs">
              <span className="text-[#5A655D] font-mono select-none">{window.location.host}/</span>
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

        {/* Bio */}
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

        {/* Social channels */}
        <div className="pt-3 border-t border-[#E7EBE7] space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-[#111813]">
            <Share2 className="w-3.5 h-3.5 text-[#006241]" />
            <span>Social & Contact</span>
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
              <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2.5 text-xs">
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
              <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2.5 text-xs">
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
              <label className="block font-semibold mb-1">Facebook</label>
              <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2.5 text-xs">
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
      </AccountSection>

      {/* Delivery & Payment */}
      <AccountSection
        icon={Truck}
        title="Delivery & Payment"
        summary={deliverySummary}
        isOpen={openSection === 'delivery'}
        onToggle={() => setOpenSection(openSection === 'delivery' ? null : 'delivery')}
        hasUnsavedChanges={deliveryDirty}
      >
        <div>
          <label className="block font-semibold mb-1">Your Home District *</label>
          <select
            value={homeDistrict}
            onChange={(e) => setHomeDistrict(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold text-xs cursor-pointer"
          >
            {SL_DISTRICTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <p className="text-[10px] text-[#5A655D] mt-1">
            Orders to this district use the local rate. All other districts use the outstation rate.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-semibold mb-1">Local Rate (Rs.)</label>
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

        <div className="pt-3 border-t border-[#E7EBE7] space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#111813]">Cash on Delivery</div>
              <div className="text-[11px] text-[#5A655D]">Let buyers pay in cash when delivered</div>
            </div>
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
              className="w-5 h-5 accent-[#006241] cursor-pointer shrink-0"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-bold text-[#111813]">Prepay for flagged buyers</div>
              <div className="text-[11px] text-[#5A655D]">Require advance payment from high-risk numbers</div>
            </div>
            <input
              type="checkbox"
              checked={prepayHighRisk}
              onChange={(e) => setPrepayHighRisk(e.target.checked)}
              className="w-5 h-5 accent-[#006241] cursor-pointer shrink-0"
            />
          </div>
        </div>

        <div className="pt-3 border-t border-[#E7EBE7] space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-[#111813]">
            <Landmark className="w-3.5 h-3.5 text-[#006241]" />
            <span>Bank Transfer</span>
          </div>

          <p className="text-[11px] text-[#5A655D] leading-relaxed">
            Add your bank account so buyers can pay by transfer. Leave empty to accept COD only.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. Commercial Bank of Ceylon"
                className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-semibold"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Account Name</label>
              <input
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g. Cinnamon Bay (Pvt) Ltd"
                className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Account Number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="e.g. 8001234567"
                className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Branch</label>
              <input
                type="text"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                placeholder="e.g. Kandy Branch"
                className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
              />
            </div>
          </div>

          {hasBankDetails && (
            <div className="bg-[#E8F0E9] border border-[#C2D6C5] rounded-2xl p-3 text-[11px] text-[#006241] font-semibold flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Buyers will see "Bank Transfer" as a payment option at checkout.</span>
            </div>
          )}
        </div>
      </AccountSection>

      {/* Notifications & Data */}
      <AccountSection
        icon={Smartphone}
        title="Notifications & Data"
        summary={notificationsSummary}
        isOpen={openSection === 'notifications'}
        onToggle={() => setOpenSection(openSection === 'notifications' ? null : 'notifications')}
        hasUnsavedChanges={false}
      >
        <p className="text-[11px] text-[#5A655D] leading-relaxed">
          Get an instant alert on this device when a new order arrives — even when Ordy is closed.
        </p>

        {pushStatus === 'unsupported' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-[11px] text-amber-800 font-semibold">
            This browser does not support push. Try installing Ordy as an app first.
          </div>
        )}

        {pushStatus === 'denied' && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-[11px] text-rose-800 font-semibold">
            Notifications were blocked. Tap the lock icon in your address bar → Notifications → Allow, then reload this page.
          </div>
        )}

        {pushStatus === 'subscribed' && (
          <div className="flex items-center justify-between bg-[#E8F0E9] border border-[#C2D6C5] rounded-2xl p-4 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-[#006241]" />
              </div>
              <div className="min-w-0">
                <div className="font-black text-xs text-[#006241] truncate">Notifications Active</div>
                <div className="text-[10px] text-[#006241]/70 truncate">This device will receive order alerts</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisablePush}
              disabled={pushBusy}
              className="px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold transition active:scale-95 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {pushBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><BellOff className="w-3.5 h-3.5" /> Disable</>}
            </button>
          </div>
        )}

        {(pushStatus === 'not_subscribed' || pushStatus === 'checking') && (
          <button
            type="button"
            onClick={handleEnablePush}
            disabled={pushBusy || pushStatus === 'checking'}
            className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {pushBusy || pushStatus === 'checking' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Bell className="w-4 h-4" /> Enable Notifications
              </>
            )}
          </button>
        )}

        <div className="pt-3 border-t border-[#E7EBE7] space-y-3">
          <div className="flex items-center gap-1.5 font-bold text-[#111813]">
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#006241]" />
            <span>Export Your Data</span>
          </div>
          <p className="text-[11px] text-[#5A655D] leading-relaxed">
            Download CSV files — opens in Excel, Google Sheets, or Numbers.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="border border-[#E7EBE7] rounded-2xl p-3 space-y-2">
              <div className="font-bold text-[11px] text-[#111813]">Orders</div>
              <div className="text-[10px] text-[#5A655D]">Every order with items + payment status.</div>
              <button
                type="button"
                onClick={handleExportOrders}
                disabled={!!exporting}
                className={`w-full py-2 font-bold rounded-xl text-[11px] transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer ${
                  lastExported === 'orders'
                    ? 'bg-[#E8F0E9] text-[#006241]'
                    : 'bg-[#F4F6F4] hover:bg-stone-200 text-[#111813] border border-[#E7EBE7]'
                }`}
              >
                {exporting === 'orders' && exportProgress.total > 0 ? (
                  <span className="font-mono">{exportProgress.loaded}/{exportProgress.total}</span>
                ) : lastExported === 'orders' ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Downloaded</>
                ) : (
                  <><Download className="w-3.5 h-3.5" /> Export Orders</>
                )}
              </button>
            </div>

            <div className="border border-[#E7EBE7] rounded-2xl p-3 space-y-2">
              <div className="font-bold text-[11px] text-[#111813]">Customers</div>
              <div className="text-[10px] text-[#5A655D]">Every buyer with contact + order count.</div>
              <button
                type="button"
                onClick={handleExportCustomers}
                disabled={!!exporting}
                className={`w-full py-2 font-bold rounded-xl text-[11px] transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer ${
                  lastExported === 'customers'
                    ? 'bg-[#E8F0E9] text-[#006241]'
                    : 'bg-[#F4F6F4] hover:bg-stone-200 text-[#111813] border border-[#E7EBE7]'
                }`}
              >
                {lastExported === 'customers' ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Downloaded</>
                ) : (
                  <><Download className="w-3.5 h-3.5" /> Export Customers</>
                )}
              </button>
            </div>
          </div>
        </div>
      </AccountSection>

      {/* Footer actions */}
      <div className="pt-4 space-y-2">
        {seller?.is_super_admin && (
          <Link
            to="/admin"
            className="flex items-center justify-between bg-[#E8F0E9] border border-[#C2D6C5] rounded-2xl p-4 text-xs font-bold text-[#006241] hover:bg-[#D5E5D7] transition"
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              Operator Portal
            </span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 p-3.5 bg-white border border-[#E7EBE7] rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition active:scale-[0.98] cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>

      {/* Image croppers */}
      <ImageCropper
        isOpen={!!logoCrop}
        imageSrc={logoCrop?.dataUrl}
        aspect={1}
        outputWidth={400}
        title="Crop Store Logo"
        onCancel={() => setLogoCrop(null)}
        onApply={handleLogoApply}
        onSkip={handleLogoSkipped}
      />
      <ImageCropper
        isOpen={!!bannerCrop}
        imageSrc={bannerCrop?.dataUrl}
        aspect={3}
        outputWidth={1200}
        title="Crop Store Banner"
        onCancel={() => setBannerCrop(null)}
        onApply={handleBannerApply}
        onSkip={handleBannerSkipped}
      />

      {/* Floating save bar */}
      {isDirty && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-40 pointer-events-none">
          <div className="bg-[#18181B] text-white rounded-[20px] shadow-2xl shadow-stone-900/40 border border-stone-800/80 flex items-center gap-2 p-2 pl-4 pointer-events-auto">
            <div className="flex-1 sm:flex-none min-w-0 pr-1">
              <div className="text-xs font-black leading-tight">Unsaved changes</div>
              <div className="text-[10px] text-stone-400 leading-tight">Tap Save to keep them</div>
            </div>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={saving}
              className="px-3 py-2 text-xs font-bold text-stone-300 hover:text-white rounded-xl hover:bg-white/10 transition disabled:opacity-50 cursor-pointer shrink-0"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={saving || uploadingLogo || uploadingBanner}
              className="px-4 py-2 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold transition active:scale-95 disabled:opacity-60 flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save</>
              )}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}