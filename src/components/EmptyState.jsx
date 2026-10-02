import React from 'react';

/**
 * Shared empty state used across Products, Customers, etc.
 * Keeps visual language consistent when a list has nothing to show.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
}) {
  return (
    <div className="bg-white border border-[#E7EBE7] rounded-[24px] p-10 sm:p-14 text-center space-y-4">
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[#F4F6F4] flex items-center justify-center mx-auto">
          <Icon className="w-6 h-6 text-stone-400" />
        </div>
      )}
      <div className="space-y-1.5 max-w-xs mx-auto">
        <p className="font-black text-sm text-[#111813]">{title}</p>
        {description && (
          <p className="text-xs text-[#5A655D] leading-relaxed">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-4 py-2.5 bg-[#006241] hover:bg-[#004F34] text-white rounded-xl text-xs font-bold transition active:scale-95 inline-flex items-center gap-1.5 cursor-pointer"
        >
          {ActionIcon && <ActionIcon className="w-3.5 h-3.5" />}
          {actionLabel}
        </button>
      )}
    </div>
  );
}