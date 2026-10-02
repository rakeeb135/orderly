import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useOutletContext } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from './supabase';
import { fetchProducts, fetchCurrentSeller } from './services/dbService';

/* ------------------------------------------------------------------ */
/*  Eager imports (buyer-facing + shell)                              */
/* ------------------------------------------------------------------ */
import Layout from './components/Layout';
import ConfirmHost from './components/ConfirmModal';
import Auth from './pages/Auth';
import Storefront from './pages/Storefront';
import OrderTracker from './pages/OrderTracker';
import QuickOrder from './pages/QuickOrder';

/* ------------------------------------------------------------------ */
/*  Lazy imports (seller-only — buyers never download these)           */
/* ------------------------------------------------------------------ */
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Products = lazy(() => import('./pages/Products'));
const Customers = lazy(() => import('./pages/Customers'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPortal = lazy(() => import('./pages/AdminPortal'));
const Renewal = lazy(() => import('./pages/Renewal'));

/* ------------------------------------------------------------------ */
/*  Suspense fallback                                                  */
/* ------------------------------------------------------------------ */
function PageLoading() {
  return (
    <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#006241] animate-spin" />
    </div>
  );
}

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

  // Super admin: always full access
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

  // Admin-suspended → full lockout
  if (seller.is_active === false) {
    return (
      <Suspense fallback={<PageLoading />}>
        <Renewal seller={seller} variant="full" />
      </Suspense>
    );
  }

  // Expiry check
  if (seller.subscription_expires_at) {
    const expiryDate = new Date(seller.subscription_expires_at);
    const msRemaining = expiryDate.getTime() - Date.now();
    const daysRemaining = Math.ceil(msRemaining / (1000 * 60 * 60 * 24));

    if (daysRemaining <= -3) {
      return (
        <Suspense fallback={<PageLoading />}>
          <Renewal seller={seller} variant="full" />
        </Suspense>
      );
    }
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
      <ConfirmHost />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/admin" element={<AdminPortalWrapper />} />
          <Route path="/order/:id" element={<OrderTracker />} />

          <Route element={<ProtectedShell />}>
            {/* Home (renders Orders) */}
            <Route path="/" element={<OrdersWrapper />} />

            {/* Legacy redirects — old links still work */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/orders" element={<Navigate to="/" replace />} />

            {/* Rest of the seller app */}
            <Route path="/orders/:id" element={<OrderDetailWrapper />} />
            <Route path="/products" element={<ProductsWrapper />} />
            <Route path="/customers" element={<CustomersWrapper />} />
            <Route path="/settings" element={<SettingsWrapper />} />
            <Route path="/renew" element={<RenewWrapper />} />
          </Route>

          <Route path="/:handle/p/:slug" element={<QuickOrder />} />
          <Route path="/:handle" element={<Storefront />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

/* ------------------------------------------------------------------ */
/*  Auth-gated wrappers                                                */
/* ------------------------------------------------------------------ */
function OrdersWrapper() {
  const { seller, onOpenPOS } = useOutletContext();
  return <Orders seller={seller} onOpenPOS={onOpenPOS} />;
}

function OrderDetailWrapper() {
  const { seller } = useOutletContext();
  return <OrderDetail seller={seller} />;
}

function ProductsWrapper() {
  const { seller, products, setProducts, onOpenPOS } = useOutletContext();
  return (
    <Products
      seller={seller}
      products={products}
      setProducts={setProducts}
      onOpenPOS={onOpenPOS}
    />
  );
}

function CustomersWrapper() {
  const { seller, onOpenPOS } = useOutletContext();
  return <Customers seller={seller} onOpenPOS={onOpenPOS} />;
}

function SettingsWrapper() {
  const { seller, setSeller } = useOutletContext();
  return <Settings seller={seller} setSeller={setSeller} />;
}

function RenewWrapper() {
  const { seller } = useOutletContext();
  return <Renewal seller={seller} variant="embedded" />;
}

function AdminPortalWrapper() {
  return <AdminPortal />;
}