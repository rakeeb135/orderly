import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Loader2, AlertCircle, CheckCircle2, Check, Store, Share2, Truck, Package,
  Printer, ShieldCheck, MessageCircle, Smartphone, Plus, Eye, EyeOff,
  AlertTriangle, MapPin, Lock,
} from 'lucide-react';
import { supabase } from '../supabase';
import { createSeller } from '../services/dbService';
import { normalizeSLPhone, isValidSLPhone } from '../utils/phone';
import OrdyLogo from '../components/OrdyLogo';

/* ------------------------------------------------------------------ */
/*  Business constants                                                 */
/* ------------------------------------------------------------------ */
const PRICE = 1990;           // current launch price
const STANDARD_PRICE = 2490;  // price after the launch period ends
const TRIAL_DAYS = 14;
const fmt = (n) => n.toLocaleString('en-LK');
const WA_HELP = `https://wa.me/94769944414?text=${encodeURIComponent(
  'Hi! I have a question about Ordy.'
)}`;
const DISPLAY =
  "'Bricolage Grotesque', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

/* ------------------------------------------------------------------ */
/*  Content                                                            */
/* ------------------------------------------------------------------ */
const SELLERS = [
  ['👗', 'Clothing'], ['💄', 'Cosmetics'], ['🎂', 'Cakes & food'], ['🧶', 'Handmade'],
  ['💍', 'Jewellery'], ['📱', 'Phone accessories'], ['📦', 'Dropshipping'], ['🌿', 'Plants'],
  ['👟', 'Shoes'], ['📚', 'Books'], ['🧸', 'Toys'], ['🎁', 'Gift boxes'],
];

const STEPS = [
  ['Make your shop', 'Shop name, WhatsApp number, done. It takes about a minute.'],
  ['Add products, share your link', 'Drop it in your bio, story or chats. Buyers order by themselves.'],
  ['Get orders ready to ship', 'Name, address, phone and items arrive already filled in.'],
];

const FAQ = [
  [
    'Do I need a real email?',
    "Any working email you can access — Gmail, Yahoo, anything. We don't send a confirmation email, so your shop opens the moment you tap the button. Just remember the email you used, it's how you log in.",
  ],
  [
    'Do I need a card to start?',
    `No card, ever. Your ${TRIAL_DAYS} days are free and nothing charges you automatically. If you decide not to continue, your trial simply ends — no surprise bills.`,
  ],
  [
    `What happens when the ${TRIAL_DAYS} days end?`,
    `You choose. Renew for Rs. ${fmt(PRICE)}/month via a simple bank transfer, or let it pause. No card was ever on file, so there's nothing to cancel or dispute. And because you joined during launch, Rs. ${fmt(PRICE)} is your price for life — it won't go up later.`,
  ],
  [
    'Do you take a cut of my sales?',
    'No. 0% commission, ever. You pay one monthly fee and buyers pay you directly — COD or bank transfer. What you earn is yours.',
  ],
  [
    'Is my customer data safe?',
    'Yes. Only you can see your customers, orders, and prices. The buyer trust network is anonymous — you see warnings from other sellers, but never who reported or any private details.',
  ],
  [
    "I'm not techy. Will I manage?",
    'If you can use WhatsApp, you can use Ordy. Setup takes about a minute. If you get stuck, message us on WhatsApp and a real person will help.',
  ],
];

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */
const STYLES = `
@keyframes ordy-in{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
@keyframes ordy-bubble{from{opacity:0;transform:translateY(6px) scale(.94)}to{opacity:1;transform:none}}
@keyframes ordy-pulse{0%,100%{opacity:1}50%{opacity:.55}}
.ordy-reveal{opacity:0;transform:translateY(14px);transition:opacity .6s cubic-bezier(.2,.8,.2,1),transform .6s cubic-bezier(.2,.8,.2,1)}
.ordy-reveal.ordy-show{opacity:1;transform:none}
.ordy-bubble{opacity:0;animation:ordy-bubble .4s cubic-bezier(.2,.8,.2,1) forwards}
.ordy-pulse{animation:ordy-pulse 2s ease-in-out infinite}
details>summary{list-style:none}
details>summary::-webkit-details-marker{display:none}
details .ordy-plus{transition:transform .2s}
details[open] .ordy-plus{transform:rotate(45deg)}
@media (prefers-reduced-motion:reduce){
  .ordy-reveal,.ordy-bubble,.ordy-in{opacity:1 !important;animation:none !important;transform:none !important}
  .ordy-pulse{animation:none}
  details .ordy-plus{transition:none}
}
`;

const inputCls =
  'w-full px-3.5 py-3 bg-[#F4F6F4] border border-[#E7EBE7] focus:border-[#006241] focus:bg-white rounded-xl text-[15px] outline-none transition select-text focus-visible:ring-2 focus-visible:ring-[#006241]/20';

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */
function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="block text-[13px] font-semibold mb-1.5">{label}</span>
      {children}
      {hint && (
        <span className="block text-[11.5px] text-[#5A655D] mt-1.5 leading-snug">{hint}</span>
      )}
    </label>
  );
}

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.ordy-reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('ordy-show'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('ordy-show');
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function PhoneFrame({ children, className = '' }) {
  return (
    <div
      className={`bg-white border border-[#E7EBE7] rounded-[24px] shadow-[0_24px_60px_-28px_rgba(0,98,65,0.28)] overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  DM chaos → clean order                                             */
/* ------------------------------------------------------------------ */
const CHAT = [
  ['b', 'Hi! Is the maroon peplum top available in M?'],
  ['s', 'Yes! Rs. 2,850 plus delivery.'],
  ['b', 'Send to 42 Temple Road, Peradeniya. Nadeesha, 077 123 4567.'],
  ['b', 'Actually — can I get it in navy instead?'],
  ['b', "Also, if I don't pick up, try 077 987 6543."],
];

function DmToOrder() {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setPlaying(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setPlaying(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="grid sm:grid-cols-2 gap-4 sm:gap-5 items-stretch">
      {/* WhatsApp chaos */}
      <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <MessageCircle className="w-4 h-4 text-[#5A655D]" />
          <span className="text-[11px] font-bold text-[#5A655D] uppercase tracking-wider">
            Today, in your DMs
          </span>
        </div>
        <div className="space-y-1.5">
          {CHAT.map(([who, text], i) => (
            <div
              key={i}
              className={`max-w-[90%] px-3 py-2 text-[13px] leading-snug ${
                who === 'b'
                  ? 'bg-[#F4F6F4] rounded-2xl rounded-bl-md'
                  : 'bg-[#DCF8C6] rounded-2xl rounded-br-md ml-auto'
              } ${playing ? 'ordy-bubble' : ''}`}
              style={playing ? { animationDelay: `${i * 0.22}s` } : undefined}
            >
              {text}
            </div>
          ))}
          <div
            className={`text-[11.5px] text-[#5A655D] pt-2 italic ${
              playing ? 'ordy-bubble' : ''
            }`}
            style={playing ? { animationDelay: `${CHAT.length * 0.22}s` } : undefined}
          >
            …plus 6 more messages to sort out the size, address and backup number.
          </div>
        </div>
      </div>

      {/* Ordy order */}
      <div
        className={`bg-[#006241] text-white rounded-[24px] p-4 sm:p-5 flex flex-col ${
          playing ? 'ordy-bubble' : ''
        }`}
        style={playing ? { animationDelay: `${CHAT.length * 0.22 + 0.3}s` } : undefined}
      >
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-white/80" />
          <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
            With Ordy, the same sale
          </span>
        </div>

        <div className="bg-white text-[#111813] rounded-2xl p-4 space-y-3 flex-1">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[15px] font-mono">#1042</span>
            <span className="text-[10.5px] font-bold bg-emerald-50 text-[#006241] px-2 py-0.5 rounded-full border border-emerald-200">
              Ready to Pack
            </span>
          </div>

          <div className="text-[13px] leading-snug">
            <div className="font-bold">Nadeesha Perera</div>
            <div className="text-[#5A655D] font-mono text-[12px] mt-0.5">077 123 4567</div>
          </div>

          <div className="text-[12px] text-[#5A655D] flex items-start gap-1.5">
            <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-stone-400" />
            <span>No. 42, Temple Road, Peradeniya (Kandy)</span>
          </div>

          <div className="border-t border-[#E7EBE7] pt-3 space-y-1.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span>Peplum top (M) × 1</span>
              <span className="font-mono font-bold">Rs. 2,850</span>
            </div>
            <div className="flex items-center justify-between text-[12px] text-[#5A655D]">
              <span>Delivery</span>
              <span className="font-mono">Rs. 350</span>
            </div>
          </div>

          <div className="border-t border-[#E7EBE7] pt-3 flex items-center justify-between text-[13px]">
            <span className="font-bold">Cash on Delivery</span>
            <span className="font-black text-[#006241] font-mono">Rs. 3,200</span>
          </div>

          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#006241] pt-1">
            <MessageCircle className="w-3.5 h-3.5" /> Confirm on WhatsApp
          </div>
        </div>

        <div className="text-[12px] text-white/80 mt-3 leading-snug">
          One link. The buyer filled everything in.
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature mockups                                                    */
/* ------------------------------------------------------------------ */
function OrderReceivedMock() {
  return (
    <PhoneFrame>
      <div className="px-4 pt-4 pb-3 border-b border-[#E7EBE7] bg-[#F4F6F4]/50 flex items-center justify-between">
        <span className="text-[11px] font-black text-[#5A655D] uppercase tracking-wider">
          New order
        </span>
        <span className="ordy-pulse text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
          Action needed
        </span>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-mono font-black text-[15px] text-[#111813]">#1042</div>
            <div className="text-[11.5px] text-stone-400 mt-0.5">2 minutes ago</div>
          </div>
          <div className="text-right">
            <div className="font-black text-[15px] text-[#006241] font-mono">Rs. 3,200</div>
            <div className="text-[10.5px] font-bold text-amber-700 mt-0.5">COD</div>
          </div>
        </div>
        <div className="border-t border-[#E7EBE7] pt-3 text-[12.5px] space-y-1">
          <div className="font-bold text-[#111813]">Nadeesha Perera</div>
          <div className="text-[#5A655D] font-mono text-[11.5px]">077 123 4567</div>
          <div className="text-[#5A655D] leading-snug">Peplum top (M) × 1</div>
        </div>
        <button
          type="button"
          className="w-full py-2.5 bg-[#006241] text-white rounded-xl text-[12.5px] font-bold"
        >
          Send WhatsApp confirmation
        </button>
      </div>
    </PhoneFrame>
  );
}

function TrustWarningMock() {
  return (
    <PhoneFrame>
      <div className="px-4 pt-4 pb-3 border-b border-[#E7EBE7] bg-rose-50/60 flex items-center justify-between">
        <span className="text-[11px] font-black text-rose-800 uppercase tracking-wider">
          Buyer check
        </span>
        <AlertTriangle className="w-4 h-4 text-rose-600" />
      </div>
      <div className="p-4 space-y-3">
        <div className="border-2 border-rose-200 bg-rose-50 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-black text-rose-900 leading-tight">
                3 reports from 2 sellers
              </div>
              <div className="text-[11.5px] text-rose-700 mt-0.5">
                Buyer has been flagged before
              </div>
            </div>
          </div>
          <div className="pt-2 border-t border-rose-200 text-[11.5px] space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-rose-700">Most common</span>
              <span className="font-bold text-rose-900">Refused delivery</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-rose-700">Last report</span>
              <span className="font-bold text-rose-900">3 weeks ago</span>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-[#5A655D] leading-relaxed">
          Contributions from other Ordy sellers. Never shows who reported.
        </p>
      </div>
    </PhoneFrame>
  );
}

function PrintLabelMock() {
  return (
    <PhoneFrame>
      <div className="px-4 pt-4 pb-3 border-b border-[#E7EBE7] bg-[#F4F6F4]/50 flex items-center justify-between">
        <span className="text-[11px] font-black text-[#5A655D] uppercase tracking-wider">
          Print layout
        </span>
        <Printer className="w-4 h-4 text-[#006241]" />
      </div>
      <div className="p-4">
        <div className="border-2 border-[#111813] rounded-lg p-3 bg-white">
          <div className="flex items-start justify-between gap-3 pb-2 border-b-2 border-[#111813]">
            <div className="min-w-0">
              <div className="font-black text-[12px] uppercase tracking-wide truncate">
                Colombo Apparel
              </div>
              <div className="text-[9px] font-mono text-stone-500 truncate">/colombo-apparel</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-mono font-black text-[14px]">#1042</div>
              <div className="text-[9px] font-mono">02 Oct</div>
            </div>
          </div>
          <div className="py-2 space-y-1 text-[11px] leading-snug">
            <div>
              <span className="font-bold">To:</span> Nadeesha Perera
            </div>
            <div className="font-mono">077 123 4567</div>
            <div className="text-stone-600">No. 42, Temple Road, Peradeniya</div>
            <div className="font-black uppercase text-[10.5px] pt-0.5">District: Kandy</div>
          </div>
          <div className="pt-2 border-t-2 border-[#111813] text-center">
            <div className="text-[9px] font-black uppercase tracking-wider">
              Cash on Delivery
            </div>
            <div className="font-mono font-black text-[15px] mt-0.5">Rs. 3,200</div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          <button
            type="button"
            className="py-1.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-lg text-[10px] font-bold"
          >
            A4 · 4-up
          </button>
          <button
            type="button"
            className="py-1.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-lg text-[10px] font-bold"
          >
            A6 · Thermal
          </button>
          <button
            type="button"
            className="py-1.5 bg-[#F4F6F4] border border-[#E7EBE7] rounded-lg text-[10px] font-bold"
          >
            Courier
          </button>
        </div>
      </div>
    </PhoneFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function Auth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState(params.get('mode') === 'login' ? 'login' : 'signup');
  const isSignup = mode === 'signup';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [shopName, setShopName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleTouched, setHandleTouched] = useState(false);
  const [handleLocked, setHandleLocked] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showBar, setShowBar] = useState(false);
  const formRef = useRef(null);

  useReveal();

  /* Already signed in → straight to the app */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data?.session) navigate('/', { replace: true });
    });
  }, [navigate]);

  /* Title + display font */
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Ordy — Run your shop from one screen';

    if (!document.getElementById('ordy-font-preconnect')) {
      const pre1 = document.createElement('link');
      pre1.id = 'ordy-font-preconnect';
      pre1.rel = 'preconnect';
      pre1.href = 'https://fonts.googleapis.com';
      document.head.appendChild(pre1);

      const pre2 = document.createElement('link');
      pre2.rel = 'preconnect';
      pre2.href = 'https://fonts.gstatic.com';
      pre2.crossOrigin = 'anonymous';
      document.head.appendChild(pre2);
    }

    if (!document.getElementById('ordy-display-font')) {
      const l = document.createElement('link');
      l.id = 'ordy-display-font';
      l.rel = 'stylesheet';
      l.href =
        'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&display=swap';
      document.head.appendChild(l);
    }

    return () => {
      document.title = prevTitle;
      // Font links intentionally left in place — they cache and speed up
      // subsequent page loads.
    };
  }, []);

  /* Sticky mobile CTA */
  useEffect(() => {
    const el = formRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => {
      setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* jumpTo and switchMode unified: both clear password + errors */
  const jumpTo = useCallback((nextMode) => {
    setMode(nextMode);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
    setShowPw(false);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const switchMode = (nextMode) => {
    setMode(nextMode);
    setErrorMsg('');
    setSuccessMsg('');
    setPassword('');
    setShowPw(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        if (error.message?.toLowerCase().includes('invalid login')) {
          throw new Error('Wrong email or password. Check both and try again.');
        }
        throw new Error(error.message || 'Login failed.');
      }
      navigate('/');
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
        throw new Error('Enter a valid 10-digit Sri Lankan mobile number, like 0771234567.');
      }
      if (!cleanHandle) {
        setHandleLocked(false);
        throw new Error('Pick a store link using letters or numbers, like colombo-apparel.');
      }

      // Best-effort handle availability pre-check so we don't create an
      // orphan auth user when the handle is already taken.
      let handleTaken = false;
      try {
        const { data: existingSeller } = await supabase.rpc('get_public_seller', {
          p_handle: cleanHandle,
        });
        handleTaken = Boolean(existingSeller?.id);
      } catch {
        /* RPC unavailable — fall through and let unique constraint catch it */
      }

      if (handleTaken) {
        setHandleLocked(false);
        throw new Error('That store link is already taken. Try another one.');
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      if (authError) {
        if (authError.message?.toLowerCase().includes('already')) {
          throw new Error('This email already has a shop. Use the Log in tab instead.');
        }
        throw new Error(authError.message || 'Could not create your shop. Try again.');
      }
      if (!authData?.user) throw new Error('Could not create your shop. Try again.');

      await createSeller({
        authUserId: authData.user.id,
        shopName,
        handle: cleanHandle,
        email: cleanEmail,
        whatsappNumber: cleanPhone,
        monthlyFee: PRICE,
      });

      if (!authData.session) {
        setSuccessMsg('Check your email to confirm your account, then log in.');
        setPassword('');
        setShowPw(false);
        setMode('login');
        return;
      }
      navigate('/');
    } catch (err) {
      if (err.message?.includes('Shop handle') || err.message?.includes('store link')) {
        setHandleLocked(false);
        try { await supabase.auth.signOut(); } catch { /* best effort */ }
      }
      setErrorMsg(err.message || 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  };

  /* Store link auto-fills from shop name until seller edits it */
  const onShopName = (val) => {
    setShopName(val);
    if (!handleTouched) {
      setHandle(
        val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
      );
    }
  };
  const onHandle = (val) => {
    setHandleTouched(true);
    setHandle(val.toLowerCase().replace(/[^a-z0-9-_]/g, ''));
  };

  const showHandleInput = !handleLocked;

  return (
    <div className="min-h-[100dvh] bg-[#F4F6F4] text-[#111813] font-sans select-text overflow-x-hidden relative">
      <style>{STYLES}</style>

      {/* Ambient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      >
        <div className="absolute -top-40 -right-40 w-[720px] h-[720px] rounded-full bg-[#006241] opacity-[0.05] blur-[130px]" />
        <div className="absolute top-1/3 -left-48 w-[560px] h-[560px] rounded-full bg-[#F5B83D] opacity-[0.05] blur-[120px]" />
        <div className="absolute -bottom-40 right-1/4 w-[640px] h-[640px] rounded-full bg-[#006241] opacity-[0.03] blur-[130px]" />
      </div>

      <div className="relative z-10">
        {/* ---------------- Nav ---------------- */}
        <header className="sticky top-0 z-30 bg-[#F4F6F4]/90 backdrop-blur border-b border-[#E7EBE7]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <OrdyLogo size={32} />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => jumpTo('login')}
                className="text-[13px] font-bold px-3 py-2 rounded-full hover:bg-white transition cursor-pointer"
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => jumpTo('signup')}
                className="text-[13px] font-bold px-4 py-2 rounded-full bg-[#006241] hover:bg-[#004F34] text-white transition cursor-pointer"
              >
                Start free
              </button>
            </div>
          </div>
        </header>

        {/* ---------------- Hero ---------------- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-12 sm:pb-16 grid gap-10 lg:gap-x-14 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="lg:col-start-1 lg:row-start-1">
            <h1
              className="text-[40px] sm:text-6xl lg:text-[64px] font-extrabold tracking-tight leading-[1.02]"
              style={{ fontFamily: DISPLAY }}
            >
              Run your whole shop{' '}
              <span className="text-[#006241]">from one screen.</span>
            </h1>

            <p className="mt-5 text-[16px] sm:text-lg text-[#3F4A42] leading-relaxed max-w-xl">
              From the first DM to the delivered parcel — storefront, order pipeline, buyer trust,
              print-ready labels and payment tracking. All from your phone.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[14px] font-semibold">
              {[`${TRIAL_DAYS} days free`, 'No card needed', '0% commission'].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-[#006241]" strokeWidth={3} /> {t}
                </li>
              ))}
            </ul>
          </div>

          {/* Form */}
          <div ref={formRef} className="lg:col-start-2 lg:row-start-1 lg:row-span-2 scroll-mt-20">
            <div className="bg-white border border-[#E7EBE7] rounded-[28px] p-5 sm:p-6 shadow-[0_18px_50px_-24px_rgba(0,98,65,0.35)] lg:sticky lg:top-20">
              <div
                role="tablist"
                className="grid grid-cols-2 bg-[#F4F6F4] rounded-full p-1 text-[13px] font-bold mb-5"
              >
                {[['signup', 'Start free'], ['login', 'Log in']].map(([m, label]) => (
                  <button
                    key={m}
                    role="tab"
                    type="button"
                    aria-selected={mode === m}
                    onClick={() => switchMode(m)}
                    className={`py-2.5 rounded-full transition cursor-pointer ${
                      mode === m ? 'bg-white shadow-sm text-[#006241]' : 'text-[#5A655D]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h2
                    className="text-xl font-extrabold leading-tight"
                    style={{ fontFamily: DISPLAY }}
                  >
                    {isSignup ? 'Open your shop in a minute' : 'Welcome back'}
                  </h2>
                  <p className="text-[13px] text-[#5A655D] mt-1">
                    {isSignup
                      ? 'No card. No commitment. Just try it.'
                      : 'Log in to see your orders.'}
                  </p>
                </div>
                {isSignup && (
                  <span className="shrink-0 text-[11px] font-extrabold bg-[#F5B83D] text-[#111813] px-2.5 py-1 rounded-full">
                    {TRIAL_DAYS} days free
                  </span>
                )}
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 text-[13px] px-3.5 py-2.5 rounded-2xl flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div
                  role="status"
                  className="mb-4 bg-[#E8F0E9] border border-[#C2D6C5] text-[#006241] text-[13px] px-3.5 py-2.5 rounded-2xl flex items-start gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {isSignup ? (
                <form onSubmit={handleRegister} className="space-y-4">
                  {/* ---- Your shop ---- */}
                  <div className="space-y-3.5">
                    <div className="text-[11px] font-black text-[#5A655D] uppercase tracking-wider">
                      Your shop
                    </div>

                    <Field label="Shop name">
                      <input
                        id="shop-name"
                        type="text"
                        name="shop_name"
                        required
                        autoComplete="organization"
                        value={shopName}
                        onChange={(e) => onShopName(e.target.value)}
                        placeholder="e.g. Colombo Apparel"
                        className={`${inputCls} font-semibold`}
                      />
                    </Field>

                    <Field
                      label="WhatsApp number"
                      hint="Only used for order alerts. Never shared or sold."
                    >
                      <input
                        type="tel"
                        name="phone"
                        required
                        autoComplete="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="0771234567"
                        className={`${inputCls} font-semibold font-mono`}
                      />
                    </Field>

                    <div>
                      <span className="block text-[13px] font-semibold mb-1.5">
                        Your store link
                      </span>
                      {showHandleInput ? (
                        <div className="flex items-center bg-[#F4F6F4] border border-[#E7EBE7] focus-within:border-[#006241] focus-within:bg-white rounded-xl px-3.5 py-3 text-[14px] transition">
                          <span className="text-[#5A655D] select-none">
                            {window.location.host}/
                          </span>
                          <input
                            type="text"
                            name="handle"
                            required
                            autoComplete="off"
                            aria-label="Store link"
                            value={handle}
                            onChange={(e) => onHandle(e.target.value)}
                            onFocus={() => setHandleLocked(false)}
                            onBlur={() => {
                              if (handle.trim()) setHandleLocked(true);
                            }}
                            placeholder="colombo-apparel"
                            className="flex-1 min-w-0 bg-transparent font-bold outline-none select-text"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 bg-[#E8F0E9] rounded-xl px-3.5 py-3 text-[14px]">
                          <span className="truncate">
                            <span className="text-[#5A655D]">{window.location.host}/</span>
                            <span className="font-bold text-[#006241]">{handle}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setHandleLocked(false)}
                            className="text-[12px] font-bold text-[#006241] underline underline-offset-2 shrink-0 cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      )}
                      <span className="block text-[11.5px] text-[#5A655D] mt-1.5 leading-snug">
                        The link you'll share with buyers. We made it from your shop name.
                      </span>
                    </div>
                  </div>

                  {/* ---- Your login ---- */}
                  <div className="space-y-3.5 pt-3 border-t border-[#E7EBE7]">
                    <div className="text-[11px] font-black text-[#5A655D] uppercase tracking-wider">
                      Your login
                    </div>

                    <Field
                      label="Email"
                      hint="Any email works — Gmail, Yahoo, your own. We don't send a confirmation email."
                    >
                      <input
                        type="email"
                        name="email"
                        required
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="myshop@gmail.com"
                        className={inputCls}
                      />
                    </Field>

                    <Field label="Password" hint="At least 6 characters. Pick one you'll remember.">
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          name="password"
                          required
                          minLength={6}
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Your password"
                          className={`${inputCls} pr-14`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw((s) => !s)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A655D] hover:text-[#111813] cursor-pointer p-1"
                          aria-label={showPw ? 'Hide password' : 'Show password'}
                        >
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </Field>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-extrabold rounded-2xl text-[15px] transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      `Start my ${TRIAL_DAYS}-day free trial`
                    )}
                  </button>

                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11.5px] font-semibold text-[#5A655D]">
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-[#006241]" strokeWidth={3} />
                      No card
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-[#006241]" strokeWidth={3} />
                      Nothing auto-charges
                    </span>
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 text-[#006241]" strokeWidth={3} />
                      Cancel any time
                    </span>
                  </div>

                  <p className="text-[12px] text-[#5A655D] text-center leading-snug">
                    After your trial it's Rs. {fmt(PRICE)}/month — only if you decide to continue.
                  </p>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <Field label="Email">
                    <input
                      type="email"
                      name="email"
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="myshop@gmail.com"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Password">
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        name="password"
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Your password"
                        className={`${inputCls} pr-14`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw((s) => !s)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A655D] hover:text-[#111813] cursor-pointer p-1"
                        aria-label={showPw ? 'Hide password' : 'Show password'}
                      >
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </Field>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 bg-[#006241] hover:bg-[#004F34] text-white font-extrabold rounded-2xl text-[15px] transition flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      'Log in to my shop'
                    )}
                  </button>
                  <p className="text-[12px] text-[#5A655D] text-center">
                    New here?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('signup')}
                      className="font-bold text-[#006241] underline underline-offset-2 cursor-pointer"
                    >
                      Start your free trial
                    </button>
                  </p>
                  <p className="text-[11.5px] text-[#5A655D] text-center leading-relaxed">
                    Forgot your password?{' '}
                    <a
                      href={WA_HELP}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#006241] hover:underline"
                    >
                      Message us on WhatsApp
                    </a>{' '}
                    and we'll help you back in.
                  </p>
                </form>
              )}
            </div>
          </div>

          {/* DM → order demo */}
          <div className="lg:col-start-1 lg:row-start-2 ordy-reveal">
            <DmToOrder />
          </div>
        </section>

        {/* ---------------- Trust strip ---------------- */}
        <section className="border-y border-[#E7EBE7] bg-white/60">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
            {[
              [Lock, 'No card needed', 'Start without sharing payment details'],
              [Store, 'No forced charges', 'Nothing bills you without your say-so'],
              [ShieldCheck, '0% commission', 'Your sales stay your sales'],
              [MessageCircle, 'Real human support', 'WhatsApp us any time'],
            ].map(([Icon, title, body]) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#E8F0E9] text-[#006241] flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-extrabold leading-tight">{title}</div>
                  <div className="text-[11.5px] text-[#5A655D] mt-0.5 leading-snug">{body}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Who it's for ---------------- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 ordy-reveal">
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl"
            style={{ fontFamily: DISPLAY }}
          >
            If you sell it on WhatsApp or Instagram, Ordy handles the orders.
          </h2>
          <div className="mt-7 flex flex-wrap gap-2">
            {SELLERS.map(([emoji, label]) => (
              <span
                key={label}
                className="bg-white border border-[#E7EBE7] rounded-full px-3.5 py-2 text-[14px] font-semibold flex items-center gap-2"
              >
                <span aria-hidden="true">{emoji}</span>
                {label}
              </span>
            ))}
            <span className="px-3.5 py-2 text-[14px] font-semibold text-[#5A655D]">
              …and anything else you sell.
            </span>
          </div>
        </section>

        {/* ---------------- How it works ---------------- */}
        <section className="bg-white border-y border-[#E7EBE7]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 ordy-reveal">
            <h2
              className="text-3xl sm:text-4xl font-extrabold tracking-tight"
              style={{ fontFamily: DISPLAY }}
            >
              Live in three steps.
            </h2>
            <ol className="mt-7 grid md:grid-cols-3 gap-5">
              {STEPS.map(([title, body], i) => (
                <li
                  key={title}
                  className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-3xl p-5 sm:p-6"
                >
                  <div className="w-10 h-10 rounded-full bg-[#006241] text-white font-extrabold flex items-center justify-center mb-4 text-[15px]">
                    {i + 1}
                  </div>
                  <h3 className="font-extrabold text-[17px] leading-tight">{title}</h3>
                  <p className="text-[14px] text-[#5A655D] mt-2 leading-relaxed">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------- Feature row 1: Order arrived ---------------- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center ordy-reveal">
            <div className="order-2 md:order-1">
              <div className="text-[12px] font-black text-[#006241] uppercase tracking-widest mb-3">
                Orders in one place
              </div>
              <h2
                className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight"
                style={{ fontFamily: DISPLAY }}
              >
                Every order lands on one screen. Nothing slips through.
              </h2>
              <p className="text-[15px] text-[#5A655D] mt-4 leading-relaxed">
                Every new order arrives with the buyer's name, phone, address and items already
                filled in. You get a live alert the moment it lands, and a clear list of what needs
                action — verify, pack, dispatch, done.
              </p>
              <ul className="mt-5 space-y-2.5 text-[14px]">
                {[
                  'Buyer fills their own address at checkout',
                  'Live notifications on your phone',
                  'Sort by what needs action today',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#006241] mt-0.5 shrink-0" strokeWidth={3} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 md:order-2 max-w-sm mx-auto w-full">
              <OrderReceivedMock />
            </div>
          </div>
        </section>

        {/* ---------------- Feature row 2: Buyer trust ---------------- */}
        <section className="bg-white border-y border-[#E7EBE7]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
            <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center ordy-reveal">
              <div className="max-w-sm mx-auto w-full md:order-1">
                <TrustWarningMock />
              </div>
              <div className="md:order-2">
                <div className="text-[12px] font-black text-[#006241] uppercase tracking-widest mb-3">
                  Your unfair advantage
                </div>
                <h2
                  className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight"
                  style={{ fontFamily: DISPLAY }}
                >
                  Know who's worth shipping to — before you dispatch.
                </h2>
                <p className="text-[15px] text-[#5A655D] mt-4 leading-relaxed">
                  Before you pack a COD parcel, Ordy quietly checks the buyer's number against
                  warnings left by other sellers. No names, no drama — just an anonymous heads-up so
                  you can decide.
                </p>
                <ul className="mt-5 space-y-2.5 text-[14px]">
                  {[
                    'Anonymous — never shows who reported',
                    'Reasons, count and recency at a glance',
                    'Automatic, no extra steps for you',
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-[#006241] mt-0.5 shrink-0" strokeWidth={3} />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Feature row 3: Print ---------------- */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20">
          <div className="grid md:grid-cols-2 gap-10 md:gap-14 items-center ordy-reveal">
            <div className="order-2 md:order-1">
              <div className="text-[12px] font-black text-[#006241] uppercase tracking-widest mb-3">
                Print and dispatch
              </div>
              <h2
                className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight"
                style={{ fontFamily: DISPLAY }}
              >
                Labels ready before the courier arrives.
              </h2>
              <p className="text-[15px] text-[#5A655D] mt-4 leading-relaxed">
                Print shipping labels on plain A4, thermal stickers, or export a courier handover
                sheet as CSV. No laptop required — works straight from your phone.
              </p>
              <ul className="mt-5 space-y-2.5 text-[14px]">
                {[
                  'A4 4-up, A4 8-up, thermal A6',
                  'Courier manifest with rider signature',
                  'CSV export for any courier service',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-[#006241] mt-0.5 shrink-0" strokeWidth={3} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="order-1 md:order-2 max-w-sm mx-auto w-full">
              <PrintLabelMock />
            </div>
          </div>
        </section>

        {/* ---------------- Compact feature grid ---------------- */}
        <section className="bg-white border-y border-[#E7EBE7]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 ordy-reveal">
            <h2
              className="text-2xl sm:text-3xl font-extrabold tracking-tight max-w-xl"
              style={{ fontFamily: DISPLAY }}
            >
              And the small things that make big differences.
            </h2>
            <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                [Store, 'Your own store link', 'One link for WhatsApp, Instagram and Facebook. Buyers browse, add to cart and check out.'],
                [Truck, 'Sri Lanka checkout', 'District picker, COD or bank transfer, delivery fees, free-delivery threshold.'],
                [MessageCircle, 'One-tap updates', 'Confirm, dispatch, follow up — with a ready-made WhatsApp message.'],
                [Smartphone, 'Works like an app', 'Add it to your home screen. Fast on any phone, no download from a store.'],
                [Package, 'Full order history', 'Search by phone, name or order number. Export everything to CSV any time.'],
                [Share2, 'Instant order links', 'Type an item and price, send the link. Buyer fills their own details.'],
              ].map(([Icon, title, body]) => (
                <div
                  key={title}
                  className="border border-[#E7EBE7] rounded-2xl p-5 hover:border-[#006241]/40 transition"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#E8F0E9] text-[#006241] flex items-center justify-center mb-3">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-[14px]">{title}</h3>
                  <p className="text-[13px] text-[#5A655D] mt-1 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------- Pricing ---------------- */}
        <section className="bg-[#006241] text-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid md:grid-cols-2 gap-10 items-center ordy-reveal">
            <div>
              <p className="text-[13px] font-black uppercase tracking-widest text-white/70">
                Launch offer · price locked for life
              </p>
              <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                <span
                  className="text-6xl sm:text-7xl font-extrabold tracking-tight"
                  style={{ fontFamily: DISPLAY }}
                >
                  Rs. {fmt(PRICE)}
                </span>
                <span className="text-lg font-semibold text-white/80">a month</span>
              </div>
              <p className="mt-4 text-[16px] leading-relaxed text-white/90 max-w-md">
                Free for your first {TRIAL_DAYS} days, then Rs. {fmt(PRICE)}/month — yours forever
                if you join during launch. Standard price is Rs. {fmt(STANDARD_PRICE)}. No card, no
                auto-charge, no questions asked.
              </p>
              <button
                type="button"
                onClick={() => jumpTo('signup')}
                className="mt-7 px-6 py-3.5 rounded-2xl bg-[#F5B83D] hover:bg-[#E5A82D] text-[#111813] font-extrabold text-[15px] transition active:scale-[0.98] cursor-pointer"
              >
                Start my {TRIAL_DAYS}-day free trial
              </button>
            </div>
            <ul className="space-y-3.5 text-[16px]">
              {[
                'Every feature included',
                '0% commission on your sales',
                'Price locked in for life',
                'No card needed to start',
                'Renew by simple bank transfer',
                'Stop any time, no contract',
              ].map((t) => (
                <li key={t} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5" strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------------- FAQ ---------------- */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20 ordy-reveal">
          <h2
            className="text-3xl sm:text-4xl font-extrabold tracking-tight"
            style={{ fontFamily: DISPLAY }}
          >
            Questions sellers ask.
          </h2>
          <div className="mt-7">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group border-t border-[#D9DFD9] last:border-b">
                <summary className="flex items-center justify-between gap-4 py-4 cursor-pointer font-bold text-[16px]">
                  {q}
                  <Plus className="ordy-plus w-5 h-5 text-[#006241] shrink-0" />
                </summary>
                <p className="pb-5 -mt-1 text-[15px] text-[#5A655D] leading-relaxed pr-8">{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------------- Final CTA ---------------- */}
        <section className="bg-[#F4F6F4] border-t border-[#E7EBE7]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
            <h2
              className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl mx-auto leading-tight"
              style={{ fontFamily: DISPLAY }}
            >
              Your first order link is{' '}
              <span className="text-[#006241]">one minute away.</span>
            </h2>
            <p className="mt-4 text-[#5A655D] text-[16px] max-w-lg mx-auto">
              {TRIAL_DAYS} days free. No card. Set up from your phone.
            </p>
            <button
              type="button"
              onClick={() => jumpTo('signup')}
              className="mt-7 px-7 py-3.5 rounded-2xl bg-[#006241] hover:bg-[#004F34] text-white font-extrabold text-[15px] transition active:scale-[0.98] cursor-pointer"
            >
              Start my {TRIAL_DAYS}-day free trial
            </button>
          </div>
        </section>

        {/* ---------------- Footer ---------------- */}
        <footer className="border-t border-[#E7EBE7] bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-28 lg:pb-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px] text-[#5A655D]">
            <OrdyLogo size={28} />
            <a
              href={WA_HELP}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-[#006241] hover:underline"
            >
              Questions? WhatsApp us
            </a>
            <span>© {new Date().getFullYear()} Ordy</span>
          </div>
        </footer>

        {/* ---------------- Sticky mobile CTA ---------------- */}
        <div
          className={`lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-[#E7EBE7] px-4 pt-3 transition-transform duration-300 ${
            showBar ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
          aria-hidden={!showBar}
        >
          <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
            <div className="leading-tight">
              <div className="font-extrabold text-[14px]">{TRIAL_DAYS} days free</div>
              <div className="text-[12px] text-[#5A655D]">No card · No commitment</div>
            </div>
            <button
              type="button"
              tabIndex={showBar ? 0 : -1}
              onClick={() => jumpTo('signup')}
              className="px-5 py-3 rounded-2xl bg-[#006241] text-white font-extrabold text-[14px] active:scale-[0.98] cursor-pointer"
            >
              Start free trial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}