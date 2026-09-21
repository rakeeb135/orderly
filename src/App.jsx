import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from './supabase';
import { fetchProducts, fetchCurrentSeller } from './services/dbService';

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
import QuickOrder from './pages/QuickOrder';
import Renewal from './pages/Renewal';

function ProtectedShell() {
  const [seller, setSeller] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadSeller = async (authUserId) => {
    if (!authUserId) {
      setSeller(null);
      setProducts([]);
      setLoading(false);
      return;
    }
    try {
      const sellerRow = await fetchCurrentSeller(authUserId);
      if (!sellerRow) {
        console.warn('[ProtectedShell] No seller row found for auth user', authUserId);
        await supabase.auth.signOut();
        setSeller(null);
        setProducts([]);
        setLoading(false);
        return;
      }
      setSeller(sellerRow);
      const prods = await fetchProducts(sellerRow.id);
      setProducts(prods);
    } catch (err) {
      console.error('Failed to load seller data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      loadSeller(data?.session?.user?.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      loadSeller(session?.user?.id);
    });

    return () => {
      isMounted = false;
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
      </div>
    );
  }

  if (!seller) {
    return <Navigate to="/login" replace />;
  }

  // Super admin: always has full access
  if (seller.is_super_admin) {
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

  // Admin-suspended → always locked out
  if (seller.is_active === false) {
    return <Renewal seller={seller} variant="full" />;
  }

  // Expiry check → compute days remaining
  if (seller.subscription_expires_at) {
    const expiryDate = new Date(seller.subscription_expires_at);
    const msRemaining = expiryDate.getTime() - Date.now();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    // Locked out: 3+ days past expiry
    if (daysRemaining <= -3) {
      return <Renewal seller={seller} variant="full" />;
    }
    // Otherwise: -3 < daysRemaining <= 7 → grace/reminder handled by banner
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
          <Route path="/renew" element={<RenewWrapper />} />
        </Route>

        {/* Public buyer-facing routes (order matters!) */}
        <Route path="/:handle/p/:slug" element={<QuickOrder />} />
        <Route path="/:handle" element={<Storefront />} />
      </Routes>
    </BrowserRouter>
  );
}

/* ------------------------------------------------------------------ */
/*  Auth-gated wrappers                                                */
/* ------------------------------------------------------------------ */
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

function RenewWrapper() {
  const { seller } = useOutletContext();
  return <Renewal seller={seller} variant="embedded" />;
}