import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabase';
import { createSeller } from '../services/dbService';
import { normalizeSLPhone, isValidSLPhone } from '../utils/phone';
import OrdyLogo from '../components/OrdyLogo';

const FEATURES = [
  'Track every order in one dashboard',
  'Alert buyers with one-tap WhatsApp links',
  'Print labels, thermal stickers, and courier manifests',
  'Protect yourself from bad COD buyers',
];

export default function Auth() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) {
        navigate('/dashboard', { replace: true });
      }
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        if (error.message?.toLowerCase().includes('invalid login')) {
          throw new Error('Incorrect email or password.');
        }
        throw new Error(error.message || 'Login failed.');
      }

      navigate('/dashboard');
    } catch (err) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
      const cleanPhone = normalizeSLPhone(phone);

      if (!isValidSLPhone(cleanPhone)) {
        throw new Error('Please enter a valid 10-digit Sri Lankan phone number.');
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
      });

      if (authError) {
        if (authError.message?.toLowerCase().includes('already')) {
          throw new Error('This email is already registered. Try logging in instead.');
        }
        throw new Error(authError.message || 'Could not create account.');
      }

      if (!authData?.user) {
        throw new Error('Could not create account. Try again.');
      }

      await createSeller({
        authUserId: authData.user.id,
        shopName,
        handle: cleanHandle,
        email: cleanEmail,
        whatsappNumber: cleanPhone,
      });

      if (!authData.session) {
        setSuccessMsg('Check your email to confirm your account, then log in.');
        setIsRegistering(false);
        return;
      }

      navigate('/dashboard');
    } catch (err) {
      if (err.message?.includes('Shop handle')) {
        try {
          await supabase.auth.signOut();
        } catch {
          /* best effort */
        }
      }
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate a URL-safe slug from the shop name — but only until
  // the seller manually edits the handle field. After that, we leave it alone.
  const handleShopNameChange = (val) => {
    setShopName(val);
    if (!handleTouched) {
      const slug = val
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30);
      setHandle(slug);
    }
  };

  const handleHandleChange = (val) => {
    setHandleTouched(true);
    setHandle(val.toLowerCase().replace(/[^a-z0-9-_]/g, ''));
  };

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] flex flex-col justify-between font-sans">
      <header className="w-full max-w-md mx-auto px-4 sm:px-6 py-5 flex justify-between items-center">
        <OrdyLogo size={36} />
        <span className="text-[11px] font-semibold text-[#5A655D] bg-white px-3 py-1 rounded-full border border-[#E7EBE7]">
          0% commission • LK
        </span>
      </header>

      <main className="max-w-md w-full mx-auto px-4 sm:px-6 space-y-6 pb-6">
        {/* Hero copy */}
        <div className="space-y-3">
          <h1 className="text-3xl font-black text-[#111813] tracking-tight uppercase leading-[1.05]">
            {isRegistering ? 'Launch your store in 60 seconds.' : 'Turn DMs into orders.'}
          </h1>
          <p className="text-xs text-[#5A655D] leading-relaxed">
            {isRegistering
              ? 'Set up your store, add products, and start taking orders from WhatsApp and Instagram — all in one place.'
              : 'The calm command center for Sri Lankan social sellers. Track orders, print labels, and protect yourself from bad COD buyers.'}
          </p>
        </div>

        {/* Feature chips (login screen only) */}
        {!isRegistering && (
          <ul className="space-y-1.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[11px] text-[#5A655D]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#006241] shrink-0 mt-0.5" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Form card */}
        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
            <h2 className="text-sm font-bold text-[#111813]">
              {isRegistering ? 'Create Merchant Account' : 'Sign in to your shop'}
            </h2>
            <button
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="text-xs font-bold text-[#006241] hover:underline"
            >
              {isRegistering ? 'Already have a shop?' : 'Create shop'}
            </button>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-[#E8F0E9] border border-[#C2D6C5] text-[#006241] text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Shop Name *</label>
                <input
                  type="text"
                  name="shop_name"
                  value={shopName}
                  onChange={(e) => handleShopNameChange(e.target.value)}
                  placeholder="e.g. Colombo Apparel"
                  required
                  autoComplete="organization"
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-bold outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Your Store Link *</label>
                <p className="text-[10px] text-[#5A655D] mb-1.5 leading-relaxed">
                  This is the link you'll share on WhatsApp and Instagram. We auto-filled it from your shop name — edit if you like.
                </p>
                <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] focus-within:border-[#006241] focus-within:bg-white rounded-xl px-3 py-2 text-xs transition">
                  <span className="text-[#5A655D] font-mono select-none">{window.location.host}/</span>
                  <input
                    type="text"
                    name="handle"
                    value={handle}
                    onChange={(e) => handleHandleChange(e.target.value)}
                    placeholder="colombo-apparel"
                    required
                    autoComplete="off"
                    className="flex-1 bg-transparent font-mono font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Email Address *</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@colomboapparel.lk"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Password *</label>
                <input
                  type="password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  minLength={6}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-mono outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">WhatsApp Business Number *</label>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0771234567"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl font-mono font-bold outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Launch Store'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="yourshop@example.com"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-xs outline-none transition"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Password</label>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-xs font-mono outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 mt-2 cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enter Shop'}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="py-5 text-center text-xs text-[#5A655D]">
        Built for Sri Lanka's Independent Merchants
      </footer>
    </div>
  );
}