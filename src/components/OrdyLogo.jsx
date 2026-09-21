import React from 'react';

/* ------------------------------------------------------------------ */
/*  Ordy brand mark — the geometric cube from favicon, inline SVG    */
/* ------------------------------------------------------------------ */
export function OrdyMark({ size = 40, className = '' }) {
  return (
    <div
      className={`rounded-2xl bg-[#006241] flex items-center justify-center shadow-sm shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 512 512"
        width={size * 0.68}
        height={size * 0.68}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M256 120 L380 185 L256 250 L132 185 Z" fill="#FFFFFF" fillOpacity="0.95" />
        <path d="M132 205 L246 265 L246 385 L132 320 Z" fill="#FFFFFF" fillOpacity="0.75" />
        <path d="M266 265 L380 205 L380 320 L266 385 Z" fill="#FFFFFF" fillOpacity="0.85" />
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Full logo — mark + wordmark                                      */
/* ------------------------------------------------------------------ */
export function OrdyLogo({ size = 40, className = '', wordClassName = '' }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <OrdyMark size={size} />
      <span
        className={`font-black tracking-tight text-[#111813] leading-none ${wordClassName}`}
        style={{ fontSize: size * 0.58 }}
      >
        ordy
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small mark only — for tight spaces like sidebar avatars           */
/* ------------------------------------------------------------------ */
export function OrdyMarkOnly({ size = 32, className = '' }) {
  return <OrdyMark size={size} className={className} />;
}

export default OrdyLogo;