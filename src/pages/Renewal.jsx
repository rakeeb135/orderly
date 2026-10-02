import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShieldAlert, PhoneCall, Copy, CheckCircle2, ArrowLeft, Sparkles,
} from 'lucide-react';
import { notify } from '../components/Toast';

const DEFAULT_FEE = 1990;

export default function Renewal({ seller, variant = 'full' }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const isEmbedded = variant === 'embedded';
  const monthlyFee = Number(seller?.monthly_fee) || DEFAULT_FEE;
  const expiryDate = seller?.subscription_expires_at
    ? new Date(seller.subscription_expires_at)
    : null;

  const expiryDisplay = expiryDate
    ? expiryDate.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'today';

  const renewalMsg = `Hi Rakeeb! I just transferred Rs. ${monthlyFee.toLocaleString('en-LK')} for my Ordy subscription renewal.\n\nShop: ${seller?.shop_name || ''}\nHandle: ${seller?.handle || ''}\n\nHere's my payment slip:`;
  const waLink = `https://wa.me/94769944414?text=${encodeURIComponent(renewalMsg)}`;

  const bankDetailsText = `Bank: Commercial Bank of Ceylon
Account Name: M.T.M Rakeeb
Account Number: 8012055155
Branch: Kandy
Amount: Rs. ${monthlyFee.toLocaleString('en-LK')}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bankDetailsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt('Copy bank details manually:', bankDetailsText);
    }
  };

  const content = (
    <div className="max-w-md w-full bg-white border border-[#E7EBE7] rounded-[32px] p-6 shadow-sm space-y-5">
      {isEmbedded && (
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-xs font-bold text-[#71717A] hover:text-[#18181B] transition"
        >
          <ArrowLeft className="w-4 h-4" /> Back to dashboard
        </button>
      )}

      <div className="text-center space-y-3">
        <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto text-amber-700">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-xl font-black">
            {isEmbedded ? 'Renew your subscription' : 'Store access paused'}
          </h1>
          <p className="text-xs text-[#5A655D] mt-1.5 leading-relaxed">
            {isEmbedded
              ? `Your next billing date is ${expiryDisplay}. Renew to keep your store live and orders flowing.`
              : `Your subscription for ${seller?.shop_name} ended on ${expiryDisplay}. Renew to bring it back online.`}
          </p>
        </div>
      </div>

      {/* Amount */}
      <div className="bg-[#006241] text-white rounded-2xl p-4 text-center">
        <div className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80">
          Monthly subscription
        </div>
        <div className="text-3xl font-black mt-1 font-mono">
          Rs. {monthlyFee.toLocaleString('en-LK')}
        </div>
        <div className="text-[11px] opacity-75 mt-0.5">per 30 days</div>
      </div>

      {/* Bank details */}
      <div className="bg-[#F4F6F4] border border-[#E7EBE7] rounded-2xl p-4 space-y-2.5 text-xs">
        <div className="font-black text-[10px] uppercase tracking-wider text-[#5A655D] border-b border-[#E7EBE7] pb-2">
          Transfer to
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between gap-3">
            <span className="text-[#5A655D]">Bank</span>
            <span className="font-bold text-right">Commercial Bank of Ceylon</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#5A655D]">Account Name</span>
            <span className="font-bold text-right">M.T.M Rakeeb</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#5A655D]">Account Number</span>
            <span className="font-bold font-mono text-right">8012055155</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-[#5A655D]">Branch</span>
            <span className="font-bold text-right">Kandy</span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2 text-[11px] text-[#5A655D]">
        <div className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#E8F0E9] text-[#006241] font-black flex items-center justify-center shrink-0 text-[10px]">1</span>
          <span className="pt-0.5">Transfer Rs. {monthlyFee.toLocaleString('en-LK')} to the account above.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#E8F0E9] text-[#006241] font-black flex items-center justify-center shrink-0 text-[10px]">2</span>
          <span className="pt-0.5">Send your payment slip on WhatsApp.</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="w-5 h-5 rounded-full bg-[#E8F0E9] text-[#006241] font-black flex items-center justify-center shrink-0 text-[10px]">3</span>
          <span className="pt-0.5">Your access is restored within a few minutes.</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 bg-[#25D366] hover:bg-[#1EBE5D] text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 shadow-xs transition active:scale-95"
        >
          <PhoneCall className="w-4 h-4" /> Send Payment Slip on WhatsApp
        </a>

        <button
          type="button"
          onClick={handleCopy}
          className="w-full py-2.5 bg-white hover:bg-stone-50 border border-[#E7EBE7] text-[#18181B] font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition active:scale-95"
        >
          {copied ? (
            <><CheckCircle2 className="w-4 h-4 text-[#006241]" /> Copied!</>
          ) : (
            <><Copy className="w-4 h-4" /> Copy Bank Details</>
          )}
        </button>
      </div>

      <p className="text-[10px] text-center text-[#5A655D] pt-1 leading-relaxed">
        Questions? Message us on WhatsApp at <span className="font-mono font-bold">+94 76 994 4414</span>
      </p>
    </div>
  );

  if (isEmbedded) {
    return (
      <div className="flex justify-center py-4">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F4] flex items-center justify-center p-4 font-sans text-[#111813]">
      {content}
    </div>
  );
}