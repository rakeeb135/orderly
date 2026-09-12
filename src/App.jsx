import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Loader2, PhoneCall, ShieldAlert } from 'lucide-react';
import { supabase } from './supabase';
import { fetchProducts } from './services/dbService';

import Layout from './components/Layout';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Products from './pages/Products';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import Storefront from './pages/Storefront';
import OrderTracker from './pages/OrderTracker';
import AdminPortal from './pages/AdminPortal';

function ProtectedShell() {
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const sellerId = localStorage.getItem('orderly_active_seller_id');

  const loadData = async () => {
    if (!sellerId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sellers')
        .select('*')
        .eq('id', sellerId)
        .single();

      if (error || !data) {
        localStorage.removeItem('orderly_active_seller_id');
        localStorage.removeItem('orderly_active_handle');
        navigate('/login');
        return;
      }

      setSeller(data);
      const prods = await fetchProducts(data.id);
      setProducts(prods);
    } catch (err) {
      console.error('Failed to load seller data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sellerId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  if (!sellerId) {
    return <Navigate to="/login" replace />;
  }

  // Subscription Expiry Check
  const expiryDate = seller.subscription_expires_at ? new Date(seller.subscription_expires_at) : null;
  const isExpired = expiryDate && expiryDate < new Date() && !seller.is_super_admin;

  if (isExpired || seller.is_active === false) {
    const renewalMsg = `Hi Rakeeb! I just transferred the Rs. 1,500 renewal fee for my shop "${seller.shop_name}" (Handle: ${seller.handle}). Here is my bank transfer slip:`;
    const waLink = `https://wa.me/94771234567?text=${encodeURIComponent(renewalMsg)}`;

    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center p-4 font-sans text-[#111813]">
        <div className="max-w-md w-full bg-white border border-[#E7EBE7] rounded-[32px] p-6 shadow-sm space-y-4 text-center">
          <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-700">
            <ShieldAlert className="w-7 h-7" />
          </div>

          <div>
            <h1 className="text-xl font-black">Store Access Expired</h1>
            <p className="text-xs text-[#5A655D] mt-1">
              Your 14-day trial or monthly access period for <strong>{seller.shop_name}</strong> has ended.
            </p>
          </div>

          <div className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-2xl p-4 text-left text-xs space-y-2">
            <div className="font-bold text-[#111813] border-b pb-1">Renew Access — Rs. 1,500 / 30 Days</div>
            <div className="text-[11px] text-[#5A655D] space-y-1">
              <div>Bank: <strong>Commercial Bank of Ceylon</strong></div>
              <div>Account Name: <strong>M.T.M Rakeeb</strong></div>
              <div>Account No: <strong>8000123456</strong></div>
              <div>Branch: <strong>Kandy Branch</strong></div>
            </div>
          </div>

          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95"
          >
            <PhoneCall className="w-4 h-4" /> Send Slip on WhatsApp
          </a>

          <button
            onClick={() => {
              localStorage.removeItem('orderly_active_seller_id');
              navigate('/login');
            }}
            className="text-xs font-semibold text-[#5A655D] hover:underline"
          >
            Sign in to another account
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      seller={seller}
      setSeller={setSeller}
      products={products}
      setProducts={setProducts}
      onOrderCreated={async () => {
        if (seller?.id) {
          const prods = await fetchProducts(seller.id);
          setProducts(prods);
        }
      }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/admin" element={<AdminPortal />} />
        <Route path="/order/:id" element={<OrderTracker />} />

        <Route element={<ProtectedShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardWrapper />} />
          <Route path="/orders" element={<OrdersWrapper />} />
          <Route path="/orders/:id" element={<OrderDetailWrapper />} />
          <Route path="/products" element={<ProductsWrapper />} />
          <Route path="/customers" element={<CustomersWrapper />} />
          <Route path="/settings" element={<SettingsWrapper />} />
        </Route>

        <Route path="/:handle" element={<Storefront />} />
      </Routes>
    </BrowserRouter>
  );
}

import { useOutletContext } from 'react-router-dom';

function DashboardWrapper() {
  const { seller } = useOutletContext();
  return <Dashboard seller={seller} />;
}

function OrdersWrapper() {
  const { seller } = useOutletContext();
  return <Orders seller={seller} />;
}

function OrderDetailWrapper() {
  const { seller } = useOutletContext();
  return <OrderDetail seller={seller} />;
}

function ProductsWrapper() {
  const { seller, products, setProducts } = useOutletContext();
  return <Products seller={seller} products={products} setProducts={setProducts} />;
}

function CustomersWrapper() {
  const { seller } = useOutletContext();
  return <Customers seller={seller} />;
}

function SettingsWrapper() {
  const { seller, setSeller } = useOutletContext();
  return <Settings seller={seller} setSeller={setSeller} />;
}