import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ShieldCheck,
  Calendar,
  ExternalLink,
  Search,
  Loader2,
  Power,
  Trash2,
  X
} from 'lucide-react';
import {
  fetchAllSellersAdmin,
  extendSubscription,
  setCustomSubscriptionExpiry,
  toggleStoreActiveStatus,
  deleteSellerAdmin,
  formatLKR
} from '../services/dbService';
import { notify } from '../components/Toast';

export default function AdminPortal() {
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [customDatePickerShop, setCustomDatePickerShop] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const navigate = useNavigate();

  const activeSellerId = localStorage.getItem('ordy_active_seller_id');

  const loadAllShops = async () => {
    try {
      setLoading(true);
      const data = await fetchAllSellersAdmin();

      const me = data.find((s) => s.id === activeSellerId);
      if (!me || !me.is_super_admin) {
        notify('Access denied: Super-Admin authorization required.', 'error');
        navigate('/dashboard');
        return;
      }
      setSellers(data);
    } catch (err) {
      notify(err.message || 'Failed to load shops', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllShops();
  }, [activeSellerId]);

  const handleQuickExtend = async (shop, days) => {
    setUpdatingId(shop.id);
    try {
      const updated = await extendSubscription(shop.id, days);
      setSellers(sellers.map((s) => (s.id === shop.id ? { ...s, ...updated } : s)));
      notify(`Extended ${shop.shop_name} by +${days} days.`);
    } catch (err) {
      notify('Extension failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCustomDateSubmit = async (e) => {
    e.preventDefault();
    if (!customDatePickerShop || !customDate) return;
    setUpdatingId(customDatePickerShop.id);

    try {
      const updated = await setCustomSubscriptionExpiry(customDatePickerShop.id, customDate);
      setSellers(sellers.map((s) => (s.id === customDatePickerShop.id ? { ...s, ...updated } : s)));
      notify(`Expiry date updated for ${customDatePickerShop.shop_name}.`);
      setCustomDatePickerShop(null);
      setCustomDate('');
    } catch (err) {
      notify('Update failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleToggleActive = async (shop) => {
    const action = shop.is_active !== false ? 'Suspend' : 'Reactivate';
    if (!window.confirm(`${action} storefront for "${shop.shop_name}"?`)) return;

    setUpdatingId(shop.id);
    try {
      const updated = await toggleStoreActiveStatus(shop.id, shop.is_active !== false);
      setSellers(sellers.map((s) => (s.id === shop.id ? { ...s, ...updated } : s)));
      notify(`Shop is now ${updated.is_active ? 'Active' : 'Suspended'}.`);
    } catch (err) {
      notify('Toggle failed: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteShop = async (shop) => {
    if (shop.id === activeSellerId) {
      notify('Cannot delete your own super-admin account.', 'error');
      return;
    }

    const confirmPrompt = window.confirm(
      `PERMANENT DELETION: Are you sure you want to completely delete "${shop.shop_name}" (${shop.handle})? All products and orders for this store will be permanently wiped.`
    );
    if (!confirmPrompt) return;

    setUpdatingId(shop.id);
    try {
      await deleteSellerAdmin(shop.id);
      setSellers(sellers.filter((s) => s.id !== shop.id));
      notify(`Deleted "${shop.shop_name}" successfully.`);
    } catch (err) {
      notify('Failed to delete shop: ' + err.message, 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredShops = sellers.filter((s) => {
    const q = search.toLowerCase().trim();
    return !q ||
      s.shop_name?.toLowerCase().includes(q) ||
      s.handle?.toLowerCase().includes(q) ||
      s.whatsapp_number?.includes(q) ||
      s.email?.toLowerCase().includes(q);
  });

  const totalStores = sellers.length;
  const activeStores = sellers.filter((s) => s.is_active !== false).length;
  const totalOrders = sellers.reduce((sum, s) => sum + (s.orders?.length || 0), 0);
  const totalGMV = sellers.reduce((sum, s) => {
    const storeSum = (s.orders || [])
      .filter((o) => o.status !== 'canceled')
      .reduce((sub, ord) => sub + Number(ord.total_amount || 0), 0);
    return sum + storeSum;
  }, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] font-sans p-4 sm:p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Super-Admin Top Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#111813] text-white flex items-center justify-center font-black">
              <ShieldCheck className="w-5 h-5 text-[#25D366]" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">Ordy Platform Operator</h1>
              <p className="text-xs text-[#5A655D]">Super-Admin Console & Store Governance</p>
            </div>
          </div>
          <Link
            to="/dashboard"
            className="px-4 py-2 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] rounded-xl text-xs font-bold transition"
          >
            ← Exit to My Shop
          </Link>
        </div>

        {/* Global Platform KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 space-y-1 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">Total Shops</span>
            <div className="text-2xl font-black text-[#111813]">{totalStores}</div>
            <span className="text-[10px] text-[#006241] font-bold">{activeStores} active</span>
          </div>

          <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 space-y-1 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">Total Orders</span>
            <div className="text-2xl font-black text-[#111813]">{totalOrders}</div>
            <span className="text-[10px] text-[#5A655D]">Cross-store processed</span>
          </div>

          <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 space-y-1 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">Platform GMV</span>
            <div className="text-2xl font-black text-[#006241]">{formatLKR(totalGMV)}</div>
            <span className="text-[10px] text-[#5A655D]">All-time GMV</span>
          </div>

          <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 space-y-1 shadow-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A655D]">Subscription Fee</span>
            <div className="text-2xl font-black text-[#111813]">Rs. 1,500</div>
            <span className="text-[10px] text-[#5A655D]">Standard monthly fee</span>
          </div>
        </div>

        {/* Shop Directory & Controls */}
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E7EBE7] pb-4">
            <div>
              <h2 className="text-base font-black text-[#111813]">Registered Merchant Stores</h2>
              <p className="text-xs text-[#5A655D]">Manage access, verify slips, and control expiration dates</p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search shop, phone, handle..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl text-xs focus:bg-white transition"
              />
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7EBE7] text-[10px] uppercase font-bold text-[#5A655D]">
                  <th className="pb-3 pr-4">Shop</th>
                  <th className="pb-3 px-4">Contact</th>
                  <th className="pb-3 px-4">Subscription Status</th>
                  <th className="pb-3 px-4">Expires</th>
                  <th className="pb-3 px-4 text-right">Extend Access</th>
                  <th className="pb-3 pl-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7EBE7]">
                {filteredShops.map((shop) => {
                  const expiry = shop.subscription_expires_at ? new Date(shop.subscription_expires_at) : null;
                  const isExpired = !expiry || expiry < new Date();
                  const daysRemaining = expiry ? Math.ceil((expiry - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                  const isBusy = updatingId === shop.id;

                  return (
                    <tr key={shop.id} className="hover:bg-[#F4F6F4]/60 transition">
                      <td className="py-3.5 pr-4">
                        <div className="font-extrabold text-[#111813] flex items-center gap-1.5">
                          <span>{shop.shop_name}</span>
                          <Link to={`/${shop.handle}`} target="_blank" className="text-stone-400 hover:text-[#006241]">
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                        <div className="text-[10px] text-[#5A655D] font-mono">/{shop.handle}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="font-bold text-[#111813]">{shop.whatsapp_number}</div>
                        <div className="text-[10px] text-[#5A655D]">{shop.email}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          shop.is_active === false
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : isExpired
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-[#E8F0E9] text-[#006241] border-[#C2D6C5]'
                        }`}>
                          {shop.is_active === false ? 'Suspended' : isExpired ? 'Expired' : `${daysRemaining} days left`}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-[#5A655D]">
                        {expiry ? expiry.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never'}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleQuickExtend(shop, 30)}
                            disabled={isBusy}
                            className="px-2.5 py-1 bg-[#006241] hover:bg-[#004F34] text-white rounded-lg text-[10px] font-bold transition active:scale-95 disabled:opacity-40"
                          >
                            +30d
                          </button>
                          <button
                            onClick={() => handleQuickExtend(shop, 60)}
                            disabled={isBusy}
                            className="px-2.5 py-1 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] text-[#111813] rounded-lg text-[10px] font-bold transition active:scale-95 disabled:opacity-40"
                          >
                            +60d
                          </button>
                          <button
                            onClick={() => {
                              setCustomDatePickerShop(shop);
                              setCustomDate(expiry ? expiry.toISOString().split('T')[0] : '');
                            }}
                            className="p-1 text-stone-500 hover:text-[#006241] rounded-lg transition"
                            title="Set specific expiry date"
                          >
                            <Calendar className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      <td className="py-3.5 pl-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleToggleActive(shop)}
                            disabled={isBusy}
                            className={`p-1.5 rounded-lg border transition ${
                              shop.is_active !== false
                                ? 'bg-[#E8F0E9] text-[#006241] border-[#C2D6C5]'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                            title={shop.is_active !== false ? 'Suspend store' : 'Reactivate store'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {shop.id !== activeSellerId && (
                            <button
                              onClick={() => handleDeleteShop(shop)}
                              disabled={isBusy}
                              className="p-1.5 rounded-lg bg-stone-100 hover:bg-rose-50 text-stone-400 hover:text-rose-600 transition"
                              title="Delete shop permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Custom Expiry Date Picker Modal */}
        {customDatePickerShop && (
          <div className="fixed inset-0 bg-[#111813]/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-[28px] p-6 max-w-xs w-full shadow-2xl space-y-3 text-xs text-[#111813]">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-extrabold text-sm">Set Expiry Date</h3>
                <button onClick={() => setCustomDatePickerShop(null)} className="text-stone-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[#5A655D]">Shop: <strong>{customDatePickerShop.shop_name}</strong></p>
              <form onSubmit={handleCustomDateSubmit} className="space-y-3">
                <div>
                  <label className="block font-semibold mb-1">New Expiration Date</label>
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={updatingId === customDatePickerShop.id}
                  className="w-full py-2.5 bg-[#006241] text-white font-bold rounded-xl active:scale-95"
                >
                  Save Expiration
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}