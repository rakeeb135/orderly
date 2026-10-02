import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Phone,
  MessageCircle,
  MapPin,
  ShoppingBag,
  Trash2,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { fetchCustomers, updateCustomer, deleteCustomerSafe } from '../services/dbService';
import { supabase } from '../supabase';
import { notify } from '../components/Toast';
import { confirm } from '../components/ConfirmModal';
import EmptyState from '../components/EmptyState';

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

export default function Customers({ seller }) {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSecondaryPhone, setEditSecondaryPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editDistrict, setEditDistrict] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCustomers = async () => {
    if (!seller?.id) return;
    try {
      setLoading(true);
      const data = await fetchCustomers(seller.id);
      setCustomers(data || []);
    } catch (err) {
      notify('Failed to load customers: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller?.id]);

  /* Realtime — customer list syncs live across tabs / devices */
  useEffect(() => {
    if (!seller?.id) return;
    let isMounted = true;

    const channelName = `customers-rt-${seller.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
          filter: `seller_id=eq.${seller.id}`,
        },
        (payload) => {
          if (!isMounted) return;
          const { eventType, new: newRow, old: oldRow } = payload;

          if (eventType === 'INSERT' && newRow?.id) {
            setCustomers((prev) => {
              if (prev.some((c) => c.id === newRow.id)) return prev;
              return [newRow, ...prev];
            });
          } else if (eventType === 'UPDATE' && newRow?.id) {
            setCustomers((prev) =>
              prev.map((c) => (c.id === newRow.id ? { ...c, ...newRow } : c))
            );
          } else if (eventType === 'DELETE' && oldRow?.id) {
            setCustomers((prev) => prev.filter((c) => c.id !== oldRow.id));
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [seller?.id]);

  const openEditModal = (cust) => {
    setEditingCustomer(cust);
    setEditName(cust.name || '');
    setEditPhone(cust.phone || '');
    setEditSecondaryPhone(cust.secondary_phone || '');
    setEditAddress(cust.delivery_address || '');
    setEditCity(cust.city || '');
    setEditDistrict(cust.district || 'Colombo');
  };

  const handleSaveCustomer = async (e) => {
    e.preventDefault();
    if (!editPhone.trim()) {
      notify('Primary phone number is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateCustomer(editingCustomer.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        secondary_phone: editSecondaryPhone.trim(),
        delivery_address: editAddress.trim(),
        city: editCity.trim(),
        district: editDistrict.trim(),
      });

      setCustomers(customers.map((c) => (c.id === updated.id ? updated : c)));
      notify('Customer details updated!');
      setEditingCustomer(null);
    } catch (err) {
      notify('Failed to update: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async (cust) => {
    const ok = await confirm({
      title: `Remove ${cust.name || 'this customer'}?`,
      message:
        (cust.total_orders || 0) > 0
          ? 'Their past orders will remain in your records, but the profile will be removed.'
          : 'This customer record will be permanently deleted.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      await deleteCustomerSafe(cust.id);
      setCustomers(customers.filter((c) => c.id !== cust.id));
      notify('Customer record removed.');
      setEditingCustomer(null);
    } catch (err) {
      notify('Delete failed: ' + err.message, 'error');
    }
  };

  const handleViewOrders = (cust) => {
    const cleanPhone = (cust.phone || '').replace(/[^0-9]/g, '');
    navigate(`/?phone=${encodeURIComponent(cleanPhone)}`);
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.secondary_phone?.includes(q) ||
      c.city?.toLowerCase().includes(q) ||
      c.district?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4 pb-32 max-w-5xl mx-auto">
      {/* Header */}
      <div className="px-1 pt-1">
        <h1 className="text-xl font-black tracking-tight text-[#111813]">Customers</h1>
        <p className="text-xs text-[#5A655D] mt-1">
          {customers.length} {customers.length === 1 ? 'customer' : 'customers'} in your directory
        </p>
      </div>

      {/* Search */}
      {customers.length > 0 && (
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, phone, city…"
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-[#E7EBE7] focus:border-[#006241] rounded-xl text-sm outline-none font-medium transition placeholder:text-stone-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-stone-400 hover:text-[#111813] hover:bg-stone-100 transition cursor-pointer"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-16 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-[#006241] animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Customer profiles are created automatically the moment someone places an order. Share your store link to get started."
        />
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F6F4] flex items-center justify-center mx-auto">
            <Search className="w-5 h-5 text-stone-400" />
          </div>
          <p className="font-black text-sm text-[#111813]">No customers match</p>
          <p className="text-xs text-[#5A655D]">Try a different keyword.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="px-4 py-2 bg-[#F4F6F4] hover:bg-stone-200 border border-[#E7EBE7] text-[#111813] rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredCustomers.map((cust) => {
            const cleanWa = cust.phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
            const location = [cust.city, cust.district].filter(Boolean).join(', ');
            const orderCount = cust.total_orders || 0;

            return (
              <div
                key={cust.id}
                onClick={() => openEditModal(cust)}
                className="group bg-white border border-[#E7EBE7] rounded-2xl p-3 hover:border-stone-300 hover:shadow-xs transition cursor-pointer flex items-center gap-3"
              >
                {/* Avatar */}
                <div className="w-14 h-14 rounded-2xl bg-[#E8F0E9] border border-[#C2D6C5] flex items-center justify-center shrink-0">
                  <span className="font-black text-base text-[#006241]">
                    {(cust.name || 'U')[0].toUpperCase()}
                  </span>
                </div>

                {/* Text */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-extrabold text-sm text-[#111813] truncate">
                      {cust.name || 'Unnamed customer'}
                    </h2>
                    {orderCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#E8F0E9] text-[#006241] text-[10px] font-bold border border-[#C2D6C5]">
                        <ShoppingBag className="w-2.5 h-2.5" />
                        {orderCount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-mono font-bold text-[#006241] mt-0.5 truncate">
                    {cust.phone}
                    {cust.secondary_phone && (
                      <span className="text-[11px] text-[#5A655D] font-normal ml-1.5">/ {cust.secondary_phone}</span>
                    )}
                  </div>
                  {location && (
                    <div className="text-[11px] text-[#5A655D] mt-1 flex items-center gap-1 truncate">
                      <MapPin className="w-3 h-3 text-stone-400 shrink-0" />
                      <span className="truncate">{location}</span>
                    </div>
                  )}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <a
                    href={`tel:${cust.phone}`}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-500 hover:text-[#111813] hover:bg-stone-100 transition active:scale-95 cursor-pointer"
                    aria-label="Call"
                    title="Call"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                  {cleanWa && (
                    <a
                      href={`https://wa.me/${cleanWa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-stone-500 hover:text-[#006241] hover:bg-[#E8F0E9] transition active:scale-95 cursor-pointer"
                      aria-label="Open WhatsApp"
                      title="WhatsApp"
                    >
                      <MessageCircle className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {editingCustomer && (
        <div className="fixed inset-x-0 top-0 h-[100dvh] bg-[#111813]/70 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl space-y-4 text-xs max-h-[92dvh] overflow-y-auto scroll-pb-40 text-[#111813]">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
              <h3 className="font-extrabold text-sm">Customer Profile</h3>
              <button onClick={() => setEditingCustomer(null)} className="text-stone-400 hover:text-black cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick jump to their orders */}
            {(editingCustomer.total_orders || 0) > 0 && (
              <button
                type="button"
                onClick={() => {
                  const c = editingCustomer;
                  setEditingCustomer(null);
                  handleViewOrders(c);
                }}
                className="w-full py-3 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] font-bold rounded-2xl text-xs transition active:scale-95 flex items-center justify-between px-4 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  View {editingCustomer.total_orders} order{editingCustomer.total_orders === 1 ? '' : 's'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <form onSubmit={handleSaveCustomer} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">Primary Phone *</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Backup Phone</label>
                  <input
                    type="tel"
                    value={editSecondaryPhone}
                    onChange={(e) => setEditSecondaryPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold mb-1">District</label>
                  <select
                    value={editDistrict}
                    onChange={(e) => setEditDistrict(e.target.value)}
                    className="w-full px-3 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold text-xs cursor-pointer"
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
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Delivery Address</label>
                <textarea
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl text-xs active:scale-95 transition mt-2 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Changes'}
              </button>
            </form>

            <button
              type="button"
              onClick={() => handleDeleteCustomer(editingCustomer)}
              className="w-full py-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-2xl text-xs font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Delete Customer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}