import React from 'react';

/**
 * Skeleton primitives — animated grey placeholders shown while data loads.
 *
 * Both accept a `className` prop so you can size and round them per use.
 * The pulse animation comes from Tailwind's `animate-pulse` utility.
 *
 * Usage:
 *   <SkeletonLine className="h-4 w-32" />
 *   <SkeletonBlock className="w-10 h-10 rounded-2xl" />
 */

export function SkeletonLine({ className = '' }) {
  return <div className={`bg-stone-200/80 rounded-md animate-pulse ${className}`} />;
}

export function SkeletonBlock({ className = '' }) {
  return <div className={`bg-stone-200/80 rounded-2xl animate-pulse ${className}`} />;
}