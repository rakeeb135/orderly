import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, AlertCircle, CheckCircle2, Check, Store, Truck, Printer, ShieldCheck,
  MessageCircle, Smartphone, Plus, Eye, EyeOff, AlertTriangle, MapPin, Bell,
  ArrowRight, ArrowLeft, Pencil,
} from 'lucide-react';
import { supabase } from '../supabase';
import { createSeller } from '../services/dbService';
import { normalizeSLPhone, isValidSLPhone } from '../utils/phone';
import OrdyLogo from '../components/OrdyLogo';

const PRICE = 1990;
const STANDARD_PRICE = 2490;
const TRIAL_DAYS = 14;
const fmt = (n) => n.toLocaleString('en-LK');
const WA_HELP = `https://wa.me/94769944414?text=${encodeURIComponent('Hi! I have a question about Ordy.')}`;
const DISPLAY = "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const G = '#006241';

const FAQ = [
  ['Do I need a card to start?', `No. Your ${TRIAL_DAYS} days are free and nothing is charged automatically. If you don't continue, your trial just ends.`],
  ['Which email should I use?', "Any email you can open: Gmail, Yahoo, anything. We don't send a confirmation mail, so your shop opens right away. Remember it, you use it to log in."],
  [`What happens after ${TRIAL_DAYS} days?`, `You pay Rs. ${fmt(PRICE)} a month by simple bank transfer, or you let it pause. Join now and Rs. ${fmt(PRICE)} stays your price for life.`],
  ['Do you take a cut of my sales?', 'No. 0% commission. Buyers pay you directly (COD or bank transfer). Every rupee is yours.'],
  ['Is my customer data safe?', 'Yes. Only you can see your orders, customers and prices. Buyer warnings are anonymous, nobody sees who reported.'],
  ["I'm not good with tech. Can I manage?", 'If you can use WhatsApp, you can use Ordy. Stuck? Message us on WhatsApp and a real person helps you.'],
];

const TABS = [
  ['orders', Bell, 'Orders come to you', 'A sound and a notification on your phone the second a buyer orders. Name, address and items are already filled in.'],
  ['shop', Store, 'Your own shop link', 'Put one link in your bio. Buyers see your products, pick a size, choose their district and order. No more "price?" messages.'],
  ['trust', ShieldCheck, 'Fake buyers flagged', 'Before you pack a COD parcel, Ordy checks the number. If other sellers reported this buyer, you see a red warning.'],
  ['label', Printer, 'Print labels in one tap', 'Print parcel labels from your phone. A4 or thermal sticker. Courier sheet ready too.'],
];

const STYLES = `
@keyframes o-float{0%,100%{transform:translateY(0) rotate(var(--r,0deg))}50%{transform:translateY(-10px) rotate(var(--r,0deg))}}
@keyframes o-pop{from{opacity:0;transform:translateY(8px) scale(.95)}to{opacity:1;transform:none}}
@keyframes o-drop{0%{opacity:0;transform:translateY(-24px)}12%,85%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-24px)}}
@keyframes o-ring{0%{box-shadow:0 0 0 0 rgba(245,184,61,.6)}100%{box-shadow:0 0 0 14px rgba(245,184,61,0)}}
@keyframes o-bar{from{width:0}to{width:100%}}
.o-float{animation:o-float 6s ease-in-out infinite}
.o-pop{opacity:0;animation:o-pop .45s cubic-bezier(.2,.8,.2,1) forwards}
.o-drop{animation:o-drop 4s ease-in-out infinite}
.o-ring{animation:o-ring 1.6s ease-out infinite}
.o-rev{opacity:0;transform:translateY(16px);transition:all .7s cubic-bezier(.2,.8,.2,1)}
.o-rev.o-in{opacity:1;transform:none}
details>summary{list-style:none}details>summary::-webkit-details-marker{display:none}
details .o-plus{transition:transform .2s}details[open] .o-plus{transform:rotate(45deg)}
.o-grain{background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1px);background-size:18px 18px}
@media (prefers-reduced-motion:reduce){.o-float,.o-drop,.o-ring{animation:none}.o-pop,.o-rev{opacity:1;animation:none;transform:none}}
`;

const inp = 'w-full px-4 py-3 bg-[#F4F6F4] border border-[#E3E8E3] focus:border-[#006241] focus:bg-white rounded-xl text-[15px] outline-none transition focus-visible:ring-2 focus-visible:ring-[#006241]/20';

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.o-rev');
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('o-in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('o-in'); io.unobserve(e.target); }
    }), { threshold: 0.08 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);
}

/* ---------------- Phone + screens ---------------- */
function Phone({ children, className = '', style }) {
  return (
    <div style={style} className={`relative bg-[#111813] rounded-[2.4rem] p-[7px] shadow-[0_40px_80px_-30px_rgba(0,40,25,.55)] ${className}`}>
      <div className="relative bg-white rounded-[2rem] overflow-hidden h-full">
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-[#111813] rounded-full z-20" />
        {children}
      </div>
    </div>
  );
}

function Screen({ id }) {
  if (id === 'orders') return (
    <div className="pt-9 px-3 pb-4 h-full bg-[#F4F6F4]">
      <div className="o-drop bg-[#111813] text-white rounded-2xl p-2.5 flex items-center gap-2.5 shadow-lg mb-3">
        <div className="w-8 h-8 rounded-lg bg-[#F5B83D] flex items-center justify-center shrink-0"><Bell className="w-4 h-4 text-[#111813]" /></div>
        <div className="min-w-0 text-[11px] leading-tight"><b>New order! Rs. 3,200</b><div className="text-white/60">Nadeesha · Peradeniya</div></div>
      </div>
      {[['#1042', 'Nadeesha P.', 'Rs. 3,200', 'Ready to pack', 'bg-amber-50 text-amber-800'], ['#1041', 'Kasun S.', 'Rs. 5,400', 'Dispatched', 'bg-emerald-50 text-[#006241]'], ['#1040', 'Fathima R.', 'Rs. 1,750', 'Delivered', 'bg-stone-100 text-stone-600']].map(([n, w, p, s, c], i) => (
        <div key={n} className="o-pop bg-white rounded-2xl p-3 mb-2 border border-[#E3E8E3]" style={{ animationDelay: `${i * 0.12}s` }}>
          <div className="flex justify-between text-[12px] font-extrabold"><span className="font-mono">{n}</span><span className="font-mono text-[#006241]">{p}</span></div>
          <div className="flex justify-between items-center mt-1.5 text-[11px] text-stone-500"><span>{w}</span><span className={`px-2 py-0.5 rounded-full font-bold ${c}`}>{s}</span></div>
        </div>
      ))}
      <div className="mt-3 py-2.5 bg-[#006241] text-white rounded-xl text-[12px] font-bold text-center flex items-center justify-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Confirm on WhatsApp</div>
    </div>
  );
  if (id === 'shop') return (
    <div className="pt-9 h-full bg-white">
      <div className="px-3 pb-3 text-center border-b border-[#E3E8E3]">
        <div className="w-10 h-10 mx-auto rounded-full bg-[#006241] text-white font-black flex items-center justify-center text-sm">CA</div>
        <div className="font-extrabold text-[13px] mt-1">Colombo Apparel</div>
        <div className="text-[10px] text-stone-500">ordy.lk/colombo-apparel</div>
      </div>
      <div className="grid grid-cols-2 gap-2 p-3">
        {[['👗', 'Peplum top', '2,850', '#FBE3E8'], ['👜', 'Tote bag', '1,900', '#FFF1CC'], ['👟', 'Sneakers', '4,500', '#DDEBFA'], ['💄', 'Lip set', '1,250', '#E8F0E9']].map(([e, n, p, bg], i) => (
          <div key={n} className="o-pop rounded-2xl border border-[#E3E8E3] overflow-hidden" style={{ animationDelay: `${i * 0.1}s` }}>
            <div className="h-16 flex items-center justify-center text-3xl" style={{ background: bg }}>{e}</div>
            <div className="p-2"><div className="text-[11px] font-bold">{n}</div><div className="text-[10.5px] font-mono text-[#006241] font-bold">Rs. {p}</div></div>
          </div>
        ))}
      </div>
      <div className="mx-3 py-2.5 bg-[#006241] text-white rounded-xl text-[12px] font-bold text-center">View cart · 1 item</div>
    </div>
  );
  if (id === 'trust') return (
    <div className="pt-9 px-3 h-full bg-[#F4F6F4]">
      <div className="text-[10px] font-bold text-stone-500 mb-2">New order #1043 · COD</div>
      <div className="o-pop bg-rose-50 border-2 border-rose-200 rounded-2xl p-3.5">
        <div className="flex items-center gap-2"><div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center"><AlertTriangle className="w-5 h-5 text-rose-600" /></div>
          <div><div className="text-[13px] font-black text-rose-900 leading-tight">Careful with this buyer</div><div className="text-[11px] text-rose-700">3 reports from 2 sellers</div></div></div>
        <div className="mt-3 pt-2 border-t border-rose-200 text-[11px] space-y-1">
          <div className="flex justify-between"><span className="text-rose-700">Common reason</span><b className="text-rose-900">Refused delivery</b></div>
          <div className="flex justify-between"><span className="text-rose-700">Last report</span><b className="text-rose-900">3 weeks ago</b></div>
        </div>
      </div>
      <div className="o-pop mt-3 bg-white rounded-2xl p-3 border border-[#E3E8E3] text-[11px]" style={{ animationDelay: '.2s' }}>
        <div className="font-bold">Kamal P. · 077 555 0101</div>
        <div className="mt-2 grid grid-cols-2 gap-2"><div className="py-2 rounded-lg bg-stone-100 text-center font-bold">Ask for advance</div><div className="py-2 rounded-lg bg-rose-600 text-white text-center font-bold">Cancel</div></div>
      </div>
      <p className="mt-3 text-[10px] text-stone-500 text-center">Anonymous. Nobody sees who reported.</p>
    </div>
  );
  return (
    <div className="pt-9 px-3 h-full bg-[#F4F6F4]">
      <div className="o-pop border-2 border-[#111813] rounded-lg p-3 bg-white">
        <div className="flex justify-between pb-2 border-b-2 border-[#111813]"><div className="font-black text-[11px]">COLOMBO APPAREL</div><div className="font-mono font-black text-[13px]">#1042</div></div>
        <div className="py-2 text-[10.5px] space-y-0.5"><div><b>To:</b> Nadeesha Perera</div><div className="font-mono">077 123 4567</div><div className="text-stone-600">No. 42, Temple Road, Peradeniya</div><div className="font-black">DISTRICT: KANDY</div></div>
        <div className="pt-2 border-t-2 border-[#111813] text-center"><div className="text-[9px] font-black">CASH ON DELIVERY</div><div className="font-mono font-black text-[15px]">Rs. 3,200</div></div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-[10px] font-bold text-center">
        {['A4 · 4 labels', 'Thermal', 'Courier sheet'].map((t, i) => <div key={t} className={`py-2 rounded-lg border ${i === 0 ? 'bg-[#006241] text-white border-[#006241]' : 'bg-white border-[#E3E8E3]'}`}>{t}</div>)}
      </div>
      <div className="mt-3 py-2.5 bg-[#111813] text-white rounded-xl text-[12px] font-bold text-center flex items-center justify-center gap-1.5"><Printer className="w-3.5 h-3.5" /> Print now</div>
    </div>
  );
}

function Showcase({ onStart }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => setI((x) => (x + 1) % TABS.length), 5000);
    return () => clearTimeout(t);
  }, [i, auto]);
  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 o-rev">
      <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl leading-[1.05]" style={{ fontFamily: DISPLAY }}>
        Everything your shop needs, in your pocket.
      </h2>
      <p className="mt-4 text-[#4B564E] text-[16px] max-w-lg">Tap each one to see how it looks on your phone.</p>
      <div className="mt-10 grid md:grid-cols-[1fr_auto] gap-10 md:gap-16 items-center">
        <div className="space-y-2.5 order-2 md:order-1">
          {TABS.map(([id, Icon, title, body], k) => (
            <button key={id} type="button" onClick={() => { setI(k); setAuto(false); }}
              className={`relative w-full text-left rounded-2xl p-4 sm:p-5 border transition cursor-pointer overflow-hidden ${i === k ? 'bg-white border-[#006241]/30 shadow-[0_12px_30px_-18px_rgba(0,98,65,.5)]' : 'bg-transparent border-transparent hover:bg-white/60'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${i === k ? 'bg-[#006241] text-white' : 'bg-[#E8F0E9] text-[#006241]'}`}><Icon className="w-5 h-5" /></div>
                <div className="font-extrabold text-[17px]" style={{ fontFamily: DISPLAY }}>{title}</div>
              </div>
              {i === k && <p className="mt-2.5 text-[14.5px] text-[#4B564E] leading-relaxed pl-[52px]">{body}</p>}
              {i === k && auto && <span key={`b${i}`} className="absolute bottom-0 left-0 h-[3px] bg-[#F5B83D]" style={{ animation: 'o-bar 5s linear forwards' }} />}
            </button>
          ))}
          <div className="pt-3 grid grid-cols-2 gap-2.5 text-[13.5px] font-semibold">
            {[[Smartphone, 'Install like an app (PWA)'], [Truck, 'Sri Lanka districts & delivery fees']].map(([Ic, t]) => (
              <div key={t} className="flex items-center gap-2 bg-white/70 rounded-xl px-3 py-2.5 border border-[#E3E8E3]"><Ic className="w-4 h-4 text-[#006241] shrink-0" />{t}</div>
            ))}
          </div>
        </div>
        <div className="order-1 md:order-2 flex justify-center">
          <Phone className="w-[250px] sm:w-[270px] h-[520px] sm:h-[550px]"><div key={i} className="h-full"><Screen id={TABS[i][0]} /></div></Phone>
        </div>
      </div>
    </section>
  );
}

/* ---------------- DM mess vs Ordy ---------------- */
const CHAT = [['b', 'Is the maroon top there in M?'], ['s', 'Yes! Rs. 2,850 + delivery'], ['b', '42 Temple Rd, Peradeniya. Nadeesha 077 123 4567'], ['b', 'Oh wait, navy please 🙏'], ['b', 'If I don’t pick up call 077 987 6543']];
function DmToOrder() {
  return (
    <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
      <div className="bg-white border border-[#E3E8E3] rounded-3xl p-5">
        <div className="text-[13px] font-bold text-stone-500 mb-3 flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Now: orders in DMs</div>
        <div className="space-y-1.5">
          {CHAT.map(([w, t], k) => (
            <div key={k} className={`max-w-[88%] px-3 py-2 text-[13px] leading-snug ${w === 'b' ? 'bg-[#F4F6F4] rounded-2xl rounded-bl-md' : 'bg-[#DCF8C6] rounded-2xl rounded-br-md ml-auto'}`}>{t}</div>
          ))}
          <div className="text-[12px] text-stone-500 italic pt-1">…and 6 more messages 😮‍💨</div>
        </div>
      </div>
      <div className="mx-auto w-11 h-11 rounded-full bg-[#F5B83D] flex items-center justify-center rotate-90 md:rotate-0 shadow-lg"><ArrowRight className="w-5 h-5" /></div>
      <div className="bg-[#006241] text-white rounded-3xl p-5">
        <div className="text-[13px] font-bold text-white/80 mb-3 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> With Ordy: one clean order</div>
        <div className="bg-white text-[#111813] rounded-2xl p-4 space-y-2.5 text-[13px]">
          <div className="flex justify-between items-center"><b className="font-mono text-[15px]">#1042</b><span className="text-[10.5px] font-bold bg-emerald-50 text-[#006241] px-2 py-0.5 rounded-full border border-emerald-200">Ready to pack</span></div>
          <div><b>Nadeesha Perera</b><div className="font-mono text-[12px] text-stone-500">077 123 4567</div></div>
          <div className="flex gap-1.5 text-[12px] text-stone-500"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />No. 42, Temple Road, Peradeniya</div>
          <div className="border-t border-[#E3E8E3] pt-2 flex justify-between"><span>Peplum top (Navy, M)</span><b className="font-mono">Rs. 2,850</b></div>
          <div className="flex justify-between font-bold"><span>COD total</span><span className="font-mono text-[#006241]">Rs. 3,200</span></div>
        </div>
        <div className="text-[12.5px] text-white/85 mt-3">The buyer typed everything. You just pack.</div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */
export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'login' ? 'login' : 'signup');
  const isSignup = mode === 'signup';
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [shopName, setShopName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [editHandle, setEditHandle] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showBar, setShowBar] = useState(false);
  const formRef = useRef(null);
  useReveal();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data?.session) navigate('/', { replace: true }); });
  }, [navigate]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Ordy — Run your shop from one screen';
    if (!document.getElementById('ordy-display-font')) {
      const a = document.createElement('link'); a.rel = 'preconnect'; a.href = 'https://fonts.googleapis.com'; document.head.appendChild(a);
      const b = document.createElement('link'); b.rel = 'preconnect'; b.href = 'https://fonts.gstatic.com'; b.crossOrigin = 'anonymous'; document.head.appendChild(b);
      const l = document.createElement('link'); l.id = 'ordy-display-font'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap';
      document.head.appendChild(l);
    }
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    const el = formRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const reset = () => { setErrorMsg(''); setSuccessMsg(''); setPassword(''); setShowPw(false); };
  const switchMode = (m) => { setMode(m); setStep(1); reset(); };
  const jumpTo = useCallback((m) => {
    setMode(m); setStep(1); setErrorMsg(''); setSuccessMsg(''); setPassword(''); setShowPw(false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const onShopName = (v) => {
    setShopName(v);
    if (!handleTouched) setHandle(v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 20));
  };
  const onHandle = (v) => { setHandleTouched(true); setHandle(v.toLowerCase().replace(/[^a-z0-9-_]/g, '')); };

  const handleLogin = async (e) => {
    e.preventDefault(); reset(); setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        if (error.message?.toLowerCase().includes('invalid login')) throw new Error('Wrong email or password. Check both and try again.');
        throw new Error(error.message || 'Login failed.');
      }
      navigate('/');
    } catch (err) { setErrorMsg(err.message || 'Login failed.'); } finally { setLoading(false); }
  };

  const nextStep = (e) => {
    e.preventDefault(); setErrorMsg('');
    const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (!isValidSLPhone(normalizeSLPhone(phone))) return setErrorMsg('Enter a valid 10-digit mobile number, like 0771234567.');
    if (!cleanHandle) { setEditHandle(true); return setErrorMsg('Pick a shop link using letters or numbers, like colombo-apparel.'); }
    setStep(2);
  };

  const handleRegister = async (e) => {
    e.preventDefault(); setErrorMsg(''); setSuccessMsg(''); setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanHandle = handle.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
      const cleanPhone = normalizeSLPhone(phone);
      if (!isValidSLPhone(cleanPhone)) throw new Error('Enter a valid 10-digit mobile number, like 0771234567.');
      if (!cleanHandle) throw new Error('Pick a shop link using letters or numbers, like colombo-apparel.');

      let taken = false;
      try {
        const { data: ex } = await supabase.rpc('get_public_seller', { p_handle: cleanHandle });
        taken = Boolean(ex?.id);
      } catch { /* fall through */ }
      if (taken) { setStep(1); setEditHandle(true); throw new Error('That shop link is already taken. Try another one.'); }

      const { data: authData, error: authError } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (authError) {
        if (authError.message?.toLowerCase().includes('already')) throw new Error('This email already has a shop. Use the Log in tab.');
        throw new Error(authError.message || 'Could not create your shop. Try again.');
      }
      if (!authData?.user) throw new Error('Could not create your shop. Try again.');

      await createSeller({
        authUserId: authData.user.id, shopName, handle: cleanHandle, email: cleanEmail,
        whatsappNumber: cleanPhone, monthlyFee: PRICE,
      });

      if (!authData.session) {
        setSuccessMsg('Check your email to confirm your account, then log in.');
        setPassword(''); setShowPw(false); setStep(1); setMode('login');
        return;
      }
      navigate('/');
    } catch (err) {
      if (err.message?.includes('Shop handle') || err.message?.includes('shop link')) {
        setStep(1); setEditHandle(true);
        try { await supabase.auth.signOut(); } catch { /* best effort */ }
      }
      setErrorMsg(err.message || 'Something went wrong. Try again.');
    } finally { setLoading(false); }
  };

  const PwField = (ac) => (
    <div className="relative">
      <input type={showPw ? 'text' : 'password'} name="password" required minLength={6} autoComplete={ac}
        value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (6+ letters)" className={`${inp} pr-12`} />
      <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-[#111813] p-1 cursor-pointer">
        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  const Btn = ({ children, ...p }) => (
    <button {...p} className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-extrabold rounded-2xl text-[15px] transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 cursor-pointer shadow-[0_10px_24px_-10px_rgba(0,98,65,.7)]">{children}</button>
  );

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F4] text-[#111813] font-sans overflow-x-hidden">
      <style>{STYLES}</style>

      <header className="sticky top-0 z-30 bg-[#F4F6F4]/85 backdrop-blur border-b border-[#E3E8E3]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <OrdyLogo size={32} />
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => jumpTo('login')} className="text-[13px] font-bold px-3 py-2 rounded-full hover:bg-white transition cursor-pointer">Log in</button>
            <button type="button" onClick={() => jumpTo('signup')} className="text-[13px] font-bold px-4 py-2 rounded-full bg-[#006241] hover:bg-[#004F34] text-white transition cursor-pointer">Start free</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-[#003D29] text-white overflow-hidden">
        <div className="o-grain absolute inset-0" aria-hidden="true" />
        <div className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-[#F5B83D] opacity-[0.14] blur-[110px]" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-12 sm:pb-20 grid lg:grid-cols-[1.05fr_0.95fr] gap-8 lg:gap-14 items-center">
          <div>
            <h1 className="text-[38px] sm:text-6xl lg:text-[66px] font-extrabold tracking-tight leading-[1.02]" style={{ fontFamily: DISPLAY }}>
              Stop chasing orders in DMs.
              <span className="block text-[#F5B83D]">Let them come to you.</span>
            </h1>
            <p className="mt-4 sm:mt-5 text-[16px] sm:text-lg text-white/80 leading-relaxed max-w-lg">
              Make your own online shop in 1 minute. Buyers order by themselves, and you get everything ready to pack and send.
            </p>
            <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold">
              {[`${TRIAL_DAYS} days free`, 'No card needed', '0% commission'].map((t) => (
                <li key={t} className="flex items-center gap-1.5"><Check className="w-4 h-4 text-[#F5B83D]" strokeWidth={3} />{t}</li>
              ))}
            </ul>
            <div className="hidden lg:block mt-10 relative h-[250px]">
              <div className="o-float absolute left-0 top-0 w-[230px] bg-white text-[#111813] rounded-2xl p-3.5 shadow-2xl" style={{ '--r': '-3deg' }}>
                <div className="flex items-center gap-2.5">
                  <div className="o-ring w-9 h-9 rounded-xl bg-[#F5B83D] flex items-center justify-center"><Bell className="w-4 h-4" /></div>
                  <div className="text-[12px] leading-tight"><b>New order! Rs. 3,200</b><div className="text-stone-500">Nadeesha · just now</div></div>
                </div>
              </div>
              <div className="o-float absolute left-24 top-20 w-[250px] bg-white text-[#111813] rounded-2xl p-3.5 shadow-2xl" style={{ '--r': '2deg', animationDelay: '-2s' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center"><AlertTriangle className="w-4 h-4 text-rose-600" /></div>
                  <div className="text-[12px] leading-tight"><b>Flagged buyer</b><div className="text-stone-500">3 reports from 2 sellers</div></div>
                </div>
              </div>
              <div className="o-float absolute left-8 top-40 w-[240px] bg-white text-[#111813] rounded-2xl p-3.5 shadow-2xl" style={{ '--r': '-1deg', animationDelay: '-4s' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#E8F0E9] flex items-center justify-center"><Store className="w-4 h-4 text-[#006241]" /></div>
                  <div className="text-[12px] leading-tight"><b>Your shop is live</b><div className="text-stone-500 font-mono">ordy.lk/colombo-apparel</div></div>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div ref={formRef} className="scroll-mt-20 min-w-0">
            <div className="bg-white text-[#111813] rounded-[28px] p-5 sm:p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,.6)] min-w-0">
              <div role="tablist" className="grid grid-cols-2 bg-[#F4F6F4] rounded-full p-1 text-[13px] font-bold mb-4">
                {[['signup', 'Start free'], ['login', 'Log in']].map(([m, label]) => (
                  <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => switchMode(m)}
                    className={`py-2 rounded-full transition cursor-pointer ${mode === m ? 'bg-white shadow-sm text-[#006241]' : 'text-stone-500'}`}>{label}</button>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-extrabold leading-tight" style={{ fontFamily: DISPLAY }}>
                    {isSignup ? (step === 1 ? 'Make your shop' : 'Almost done') : 'Welcome back'}
                  </h2>
                  <p className="text-[13px] text-stone-500 mt-0.5">
                    {isSignup ? (step === 1 ? 'Step 1 of 2 · takes 30 seconds' : 'Step 2 of 2 · your login') : 'Log in to see your orders.'}
                  </p>
                </div>
                {isSignup && <span className="shrink-0 text-[11px] font-extrabold bg-[#F5B83D] px-2.5 py-1 rounded-full">{TRIAL_DAYS} days free</span>}
              </div>

              {isSignup && <div className="h-1.5 bg-[#F4F6F4] rounded-full mb-4 overflow-hidden"><div className="h-full bg-[#006241] rounded-full transition-all duration-500" style={{ width: step === 1 ? '50%' : '100%' }} /></div>}

              {errorMsg && (
                <div role="alert" className="mb-3 bg-rose-50 border border-rose-200 text-rose-800 text-[13px] px-3.5 py-2.5 rounded-2xl flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div role="status" className="mb-3 bg-[#E8F0E9] border border-[#C2D6C5] text-[#006241] text-[13px] px-3.5 py-2.5 rounded-2xl flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /><span>{successMsg}</span>
                </div>
              )}

              {isSignup && step === 1 && (
                <form onSubmit={nextStep} className="space-y-3">
                  <input type="text" name="shop_name" required autoComplete="organization" value={shopName} onChange={(e) => onShopName(e.target.value)}
                    placeholder="Shop name  (e.g. Colombo Apparel)" aria-label="Shop name" className={`${inp} font-semibold`} />
                  <input type="tel" name="phone" required autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="WhatsApp number  (0771234567)" aria-label="WhatsApp number" className={`${inp} font-semibold font-mono`} />
                  <div className="flex items-center gap-2 bg-[#E8F0E9] rounded-xl px-3.5 py-2.5 text-[13px] min-h-[44px] min-w-0">
                    {editHandle ? (
                      <>
                        <span className="text-stone-500 shrink-0">{window.location.host}/</span>
                        <input autoFocus type="text" required aria-label="Shop link" value={handle} onChange={(e) => onHandle(e.target.value)}
                          onBlur={() => handle.trim() && setEditHandle(false)} className="flex-1 min-w-0 bg-transparent font-bold outline-none" />
                      </>
                    ) : (
                      <>
                        <span className="flex-1 min-w-0 truncate"><span className="text-stone-500">Your link: {window.location.host}/</span><b className="text-[#006241]">{handle || 'your-shop'}</b></span>
                        <button type="button" onClick={() => setEditHandle(true)} className="ml-auto shrink-0 flex items-center gap-1 text-[12px] font-bold text-[#006241] cursor-pointer"><Pencil className="w-3 h-3" />Edit</button>
                      </>
                    )}
                  </div>
                  <Btn type="submit">Next <ArrowRight className="w-4 h-4" /></Btn>
                  <p className="text-[11.5px] text-stone-500 text-center">We only use your number for order alerts. Never shared.</p>
                </form>
              )}

              {isSignup && step === 2 && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <input type="email" name="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email  (myshop@gmail.com)" aria-label="Email" className={inp} />
                  {PwField('new-password')}
                  <Btn type="submit" disabled={loading}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : `Open my shop`}
                  </Btn>
                  <button type="button" onClick={() => { setStep(1); setErrorMsg(''); }} className="w-full text-[13px] font-bold text-stone-500 hover:text-[#111813] flex items-center justify-center gap-1 cursor-pointer"><ArrowLeft className="w-3.5 h-3.5" />Back</button>
                  <p className="text-[11.5px] text-stone-500 text-center leading-snug">No card. Nothing auto-charges. After {TRIAL_DAYS} days it's Rs. {fmt(PRICE)}/month, only if you continue.</p>
                </form>
              )}

              {!isSignup && (
                <form onSubmit={handleLogin} className="space-y-3">
                  <input type="email" name="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email" aria-label="Email" className={inp} />
                  {PwField('current-password')}
                  <Btn type="submit" disabled={loading}>{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log in to my shop'}</Btn>
                  <p className="text-[12px] text-stone-500 text-center">
                    Forgot password? <a href={WA_HELP} target="_blank" rel="noopener noreferrer" className="font-bold text-[#006241] hover:underline">Message us on WhatsApp</a>
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Problem -> solution */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 o-rev">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl leading-[1.05]" style={{ fontFamily: DISPLAY }}>
          One order. Ten messages. Or one clean screen.
        </h2>
        <p className="mt-4 text-[#4B564E] text-[16px] max-w-lg">Selling on WhatsApp and Instagram is tiring. Ordy makes the buyer do the typing.</p>
        <div className="mt-9"><DmToOrder /></div>
      </section>

      <div className="bg-white border-y border-[#E3E8E3]"><Showcase /></div>

      {/* Steps */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 o-rev">
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]" style={{ fontFamily: DISPLAY }}>Start selling in 3 easy steps.</h2>
        <ol className="mt-9 grid md:grid-cols-3 gap-4">
          {[['Make your shop', 'Type your shop name and WhatsApp number. That is all.', Store], ['Share your link', 'Put it in your Instagram bio, story or WhatsApp status.', MessageCircle], ['Pack and send', 'Orders arrive complete. Print the label and hand to the courier.', Truck]].map(([t, b, Ic], k) => (
            <li key={t} className="relative bg-white border border-[#E3E8E3] rounded-3xl p-6 overflow-hidden">
              <span className="absolute -top-3 right-4 text-[96px] font-black leading-none text-[#006241] opacity-[0.07]" style={{ fontFamily: DISPLAY }} aria-hidden="true">{k + 1}</span>
              <div className="w-11 h-11 rounded-2xl bg-[#E8F0E9] text-[#006241] flex items-center justify-center mb-4"><Ic className="w-5 h-5" /></div>
              <h3 className="font-extrabold text-[18px]" style={{ fontFamily: DISPLAY }}>{t}</h3>
              <p className="text-[14.5px] text-[#4B564E] mt-2 leading-relaxed">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Pricing */}
      <section className="relative bg-[#003D29] text-white overflow-hidden">
        <div className="o-grain absolute inset-0" aria-hidden="true" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24 grid md:grid-cols-2 gap-10 items-center o-rev">
          <div>
            <p className="inline-block bg-[#F5B83D] text-[#111813] text-[12px] font-extrabold px-3 py-1 rounded-full">Launch offer: price stays the same for life</p>
            <div className="mt-4 flex items-baseline gap-2 flex-wrap">
              <span className="text-6xl sm:text-7xl font-extrabold tracking-tight" style={{ fontFamily: DISPLAY }}>Rs. {fmt(PRICE)}</span>
              <span className="text-lg text-white/75">a month</span>
              <span className="text-lg text-white/50 line-through">Rs. {fmt(STANDARD_PRICE)}</span>
            </div>
            <p className="mt-4 text-[16px] text-white/85 max-w-md leading-relaxed">First {TRIAL_DAYS} days are free. No card, no auto-charge. Join during launch and this price never goes up.</p>
            <button type="button" onClick={() => jumpTo('signup')} className="mt-7 px-6 py-3.5 rounded-2xl bg-[#F5B83D] hover:bg-[#E5A82D] text-[#111813] font-extrabold text-[15px] transition active:scale-[0.98] cursor-pointer">Start my {TRIAL_DAYS}-day free trial</button>
          </div>
          <ul className="space-y-3.5 text-[16px]">
            {['Every feature included', '0% commission on your sales', 'Your own shop link', 'Order alerts on your phone', 'Pay by simple bank transfer', 'Stop any time'].map((t) => (
              <li key={t} className="flex items-center gap-3"><span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center shrink-0"><Check className="w-3.5 h-3.5" strokeWidth={3} /></span>{t}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 o-rev">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight" style={{ fontFamily: DISPLAY }}>Questions sellers ask</h2>
        <div className="mt-7">
          {FAQ.map(([q, a]) => (
            <details key={q} className="border-t border-[#D9DFD9] last:border-b">
              <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer font-bold text-[16px]">{q}<Plus className="o-plus w-5 h-5 text-[#006241] shrink-0" /></summary>
              <p className="pb-5 -mt-1 text-[15px] text-[#4B564E] leading-relaxed pr-8">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="max-w-5xl mx-auto bg-[#006241] text-white rounded-[2rem] px-6 py-14 text-center">
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight max-w-2xl mx-auto" style={{ fontFamily: DISPLAY }}>Your shop can be live in 1 minute.</h2>
          <p className="mt-3 text-white/80">{TRIAL_DAYS} days free. No card. Start from your phone.</p>
          <button type="button" onClick={() => jumpTo('signup')} className="mt-7 px-7 py-3.5 rounded-2xl bg-[#F5B83D] hover:bg-[#E5A82D] text-[#111813] font-extrabold text-[15px] transition active:scale-[0.98] cursor-pointer">Start free</button>
        </div>
      </section>

      <footer className="border-t border-[#E3E8E3] bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-28 lg:pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-stone-500">
          <OrdyLogo size={28} />
          <a href={WA_HELP} target="_blank" rel="noopener noreferrer" className="font-bold text-[#006241] hover:underline">Questions? WhatsApp us</a>
          <span>© {new Date().getFullYear()} Ordy</span>
        </div>
      </footer>

      {/* Sticky mobile CTA */}
      <div className={`lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-[#E3E8E3] px-4 pt-3 transition-transform duration-300 ${showBar ? 'translate-y-0' : 'translate-y-full'}`}
        style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }} aria-hidden={!showBar}>
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          <div className="leading-tight"><div className="font-extrabold text-[14px]">{TRIAL_DAYS} days free</div><div className="text-[12px] text-stone-500">No card needed</div></div>
          <button type="button" tabIndex={showBar ? 0 : -1} onClick={() => jumpTo('signup')} className="px-5 py-3 rounded-2xl bg-[#006241] text-white font-extrabold text-[14px] active:scale-[0.98] cursor-pointer">Start free trial</button>
        </div>
      </div>
    </div>
  );
}