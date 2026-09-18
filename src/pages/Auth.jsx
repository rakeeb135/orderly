import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../supabase';
import { createSeller } from '../services/dbService';
import { normalizeSLPhone, isValidSLPhone } from '../utils/phone';

export default function Auth() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [handle, setHandle] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
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

      // Session created. ProtectedShell will pick it up via onAuthStateChange.
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
    setLoading(true);

    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
      const cleanPhone = normalizeSLPhone(phone);

      if (!isValidSLPhone(cleanPhone)) {
        throw new Error('Please enter a valid 10-digit Sri Lankan phone number.');
      }

      // 1. Create the auth user account
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

      // 2. Create the seller row linked to the new auth user
      await createSeller({
        authUserId: authData.user.id,
        shopName,
        handle: cleanHandle,
        email: cleanEmail,
        whatsappNumber: cleanPhone,
      });

      // If email confirmation is required, there's no session yet
      if (!authData.session) {
        setErrorMsg('Check your email to confirm your account, then log in.');
        setIsRegistering(false);
        return;
      }

      // Session exists — user is logged in
      navigate('/dashboard');
    } catch (err) {
      // If auth user was created but seller row failed, clean up the auth user
      // so they can try again with the same email
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

  return (
    <div className="min-h-screen bg-[#F4F6F4] text-[#111813] flex flex-col justify-between p-4 sm:p-6 font-sans">
      <header className="w-full max-w-md mx-auto py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-[#006241] flex items-center justify-center text-white font-black text-base shadow-sm">
            O
          </div>
          <span className="font-black text-xl tracking-tight text-[#111813]">ordy</span>
        </div>
        <span className="text-[11px] font-semibold text-[#5A655D] bg-white px-3 py-1 rounded-full border border-[#E7EBE7]">
          0% commission • LK
        </span>
      </header>

      <main className="max-w-md w-full mx-auto space-y-5">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-black text-[#111813] tracking-tight uppercase leading-[1.1]">
            {isRegistering ? 'LAUNCH YOUR STORE IN 60 SECONDS.' : 'YOUR WHOLE BUSINESS. ONE APP.'}
          </h1>
          <p className="text-xs text-[#5A655D] leading-relaxed">
            Run your social commerce calmly from your phone or desktop. Eliminate COD returns and messy DM logs.
          </p>
        </div>

        <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-[#E7EBE7] pb-3">
            <h2 className="text-sm font-bold text-[#111813]">
              {isRegistering ? 'Create Merchant Account' : 'Sign in to your shop'}
            </h2>
            <button
              onClick={() => { setIsRegistering(!isRegistering); setErrorMsg(''); }}
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

          {isRegistering ? (
            <form onSubmit={handleRegister} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Shop Name *</label>
                <input
                  type="text"
                  name="shop_name"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Colombo Apparel"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Store Handle (URL) *</label>
                <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl px-3 py-2 text-xs">
                  <span className="text-[#5A655D] font-mono select-none">{window.location.host}/</span>
                  <input
                    type="text"
                    name="handle"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''))}
                    placeholder="colombo-apparel"
                    required
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
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl"
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
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">WhatsApp Business Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0771234567"
                  required
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl font-mono font-bold"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 mt-2"
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
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl text-xs focus:bg-white"
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
                  className="w-full px-3.5 py-2.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-xl text-xs font-mono focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-bold rounded-2xl text-xs transition shadow-sm flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 mt-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enter Shop'}
              </button>
            </form>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-[#5A655D]">
        Built for Sri Lanka's Independent Merchants
      </footer>
    </div>
  );
}