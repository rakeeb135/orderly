import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Phone, 
  MessageCircle, 
  MapPin, 
  ShoppingBag, 
  Pencil, 
  Trash2, 
  X, 
  Loader2 
} from 'lucide-react';
import { fetchCustomers, updateCustomer, deleteCustomerSafe } from '../services/dbService';
import { supabase } from '../supabase';
import { notify } from '../components/Toast';
import { confirm } from '../components/ConfirmModal';

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
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Edit Modal State
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
  }, [seller?.id]);
  /* ---------------------------------------------------------------- */
  /*  Realtime — customer list syncs live across tabs / devices        */
  /* ---------------------------------------------------------------- */
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
        district: editDistrict.trim()
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
    } catch (err) {
      notify('Delete failed: ' + err.message, 'error');
    }
  };

  const filteredCustomers = customers.filter((c) => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone?.includes(searchQuery) ||
    c.secondary_phone?.includes(searchQuery) ||
    c.city?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.district?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-12 text-[#111813]">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#E7EBE7] rounded-[28px] p-5 shadow-xs">
        <div>
          <h1 className="text-lg font-black">Customer Directory</h1>
          <p className="text-xs text-[#5A655D]">{customers.length} total customer profiles recorded</p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, city..."
            className="w-full pl-9 pr-3 py-2 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl text-xs font-medium"
          />
        </div>
      </div>

      {/* Customers Grid */}
      {loading ? (
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-12 flex justify-center items-center">
          <Loader2 className="w-6 h-6 text-[#006241] animate-spin" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-12 text-center text-xs text-[#5A655D]">
          {searchQuery ? 'No customers matched your search query.' : 'No customer records yet. Orders will automatically populate profiles here.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCustomers.map((cust) => {
            const cleanWa = cust.phone?.replace(/[^0-9]/g, '').replace(/^0/, '94');
            const locationStr = [cust.city, cust.district].filter(Boolean).join(', ');

            return (
              <div 
                key={cust.id} 
                className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 shadow-xs space-y-3 flex flex-col justify-between hover:border-[#006241]/40 transition"
              >
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-extrabold text-sm text-[#111813]">{cust.name || 'Unnamed Customer'}</h3>
                      <div className="font-mono text-xs font-bold text-[#006241] mt-0.5 flex items-center gap-2">
                        <span>{cust.phone}</span>
                        {cust.secondary_phone && (
                          <span className="text-[11px] text-[#5A655D] font-normal">/ {cust.secondary_phone}</span>
                        )}
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-[#E8F0E9] text-[#006241] rounded-full text-[10px] font-black flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3" /> {cust.total_orders || 0} order{cust.total_orders === 1 ? '' : 's'}
                    </span>
                  </div>

                  {(cust.delivery_address || locationStr) && (
                    <div className="text-[11px] text-[#5A655D] mt-2 flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">{[cust.delivery_address, locationStr].filter(Boolean).join(' • ')}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-[#E7EBE7] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${cust.phone}`}
                      className="p-2 bg-[#F4F6F4] hover:bg-stone-200 text-[#111813] rounded-xl transition active:scale-95"
                      title="Call Primary Phone"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${cleanWa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-[#E8F0E9] hover:bg-[#D5E5D7] text-[#006241] rounded-xl transition active:scale-95"
                      title="Open WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(cust)}
                      className="p-2 bg-[#F4F6F4] hover:bg-stone-200 text-[#5A655D] hover:text-black rounded-xl transition active:scale-95"
                      title="Edit Customer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCustomer(cust)}
                      className="p-2 text-stone-400 hover:text-rose-600 rounded-xl transition active:scale-95"
                      title="Delete Customer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EDIT CUSTOMER MODAL */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-[#111813]/70 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-[28px] p-6 max-w-md w-full shadow-2xl space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
              <h3 className="font-extrabold text-sm">Edit Customer Profile</h3>
              <button onClick={() => setEditingCustomer(null)} className="text-stone-400 hover:text-black">
                <X className="w-4 h-4" />
              </button>
            </div>

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
                  <label className="block font-semibold mb-1">Secondary Phone</label>
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
                    className="w-full px-3 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold text-xs"
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
                className="w-full py-3 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-xl text-xs active:scale-95 transition mt-2 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Customer Changes'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}