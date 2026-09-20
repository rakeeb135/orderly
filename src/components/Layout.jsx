import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, Link } from 'react-router-dom';
import {
  Home,
  FileText,
  Tag,
  Users,
  Settings,
  ExternalLink,
  Plus,
  LogOut,
  Store
} from 'lucide-react';
import { supabase } from '../supabase';
import POSModal from './POSModal';
import Toast from './Toast';
import NotificationCenter from './NotificationCenter';
import InstallAppModal from './InstallAppModal';

/* ------------------------------------------------------------------ */
/*  Viewport hook — mount only one NotificationCenter at a time        */
/*  (prevents double realtime subscriptions + double chime)            */
/* ------------------------------------------------------------------ */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(min-width: 768px)').matches;
  });

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isDesktop;
}

export default function Layout({ seller, setSeller, products, setProducts, onOrderCreated }) {
  const [showPOS, setShowPOS] = useState(false);
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    }
    navigate('/login');
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Home },
    { label: 'Orders', path: '/orders', icon: FileText },
    { label: 'Products', path: '/products', icon: Tag },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] font-sans flex flex-col md:flex-row">
      <Toast />
      <InstallAppModal shopName={seller?.shop_name || 'Ordy'} />

      {/* Desktop floating notification bell — top-right of screen */}
      {isDesktop && (
        <div className="fixed top-4 right-6 z-40">
          <NotificationCenter sellerId={seller?.id} />
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E7EBE7] p-5 justify-between shrink-0 fixed inset-y-0 left-0 z-30">
        <div className="space-y-5">
          {/* Shop Header (bell removed — it lives top-right now) */}
          <div className="flex items-center gap-2.5 pb-4 border-b border-[#E7EBE7] min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#006241] flex items-center justify-center text-white font-black text-sm shadow-xs shrink-0 overflow-hidden">
              {seller?.logo_url ? (
                <img src={seller.logo_url} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                seller?.shop_name?.[0] || 'O'
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-sm truncate">{seller?.shop_name || 'My Store'}</div>
              <div className="text-[11px] text-[#5A655D] truncate font-mono">/{seller?.handle}</div>
            </div>
          </div>

          {/* New Order POS Shortcut */}
          <button
            onClick={() => setShowPOS(true)}
            className="w-full py-3 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New Order
          </button>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-2xl text-xs font-bold transition ${
                      isActive
                        ? 'bg-[#E8F0E9] text-[#006241]'
                        : 'text-[#5A655D] hover:bg-stone-100 hover:text-[#111813]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions */}
        <div className="space-y-2 pt-4 border-t border-[#E7EBE7]">
          {seller?.is_super_admin && (
            <Link
              to="/admin"
              className="flex items-center justify-between px-4 py-2 text-xs font-bold text-[#006241] bg-[#E8F0E9] rounded-xl transition"
            >
              <span>Operator Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          {seller?.handle && (
            <Link
              to={`/${seller.handle}`}
              target="_blank"
              className="flex items-center justify-between px-4 py-2 text-xs font-semibold text-[#5A655D] hover:text-[#006241] rounded-xl hover:bg-stone-50 transition"
            >
              <span className="flex items-center gap-2">
                <Store className="w-4 h-4" /> View Storefront
              </span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          )}

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition text-left cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR */}
      <header className="md:hidden sticky top-0 z-30 bg-[#F4F6F4]/90 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-[#E7EBE7]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-[#006241] flex items-center justify-center text-white font-bold text-xs shadow-xs overflow-hidden shrink-0">
            {seller?.logo_url ? (
              <img src={seller.logo_url} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              seller?.shop_name?.[0] || 'O'
            )}
          </div>
          <span className="font-extrabold text-sm truncate">{seller?.shop_name || 'My Store'}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Only mount the mobile notification center on mobile */}
          {!isDesktop && <NotificationCenter sellerId={seller?.id} />}

          <button
            onClick={() => setShowPOS(true)}
            className="px-3 py-2 bg-[#006241] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Order
          </button>

          {seller?.handle && (
            <Link
              to={`/${seller.handle}`}
              target="_blank"
              className="p-2 bg-white border border-[#E7EBE7] rounded-xl text-[#5A655D] shadow-xs"
              title="View Store"
            >
              <ExternalLink className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 md:ml-64 p-4 sm:p-8 max-w-5xl mx-auto w-full pb-28 md:pb-8 md:pt-8">
        <Outlet context={{ seller, setSeller, products, setProducts, onOrderCreated, onOpenPOS: () => setShowPOS(true) }} />
      </main>

      {/* MOBILE BOTTOM DOCK */}
      <nav className="md:hidden fixed bottom-4 left-4 right-4 max-w-sm mx-auto bg-white/95 backdrop-blur-md border border-[#E7EBE7] rounded-[32px] p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.08)] flex justify-between items-center z-40">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex-1 py-2 px-1 rounded-full flex flex-col items-center gap-0.5 transition ${
                  isActive ? 'bg-[#E8F0E9] text-[#006241]' : 'text-[#5A655D]'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-bold">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* POS MODAL */}
      <POSModal
        isOpen={showPOS}
        onClose={() => setShowPOS(false)}
        seller={seller}
        products={products}
        onOrderCreated={onOrderCreated}
      />
    </div>
  );
}