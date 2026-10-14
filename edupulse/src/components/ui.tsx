"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/types";

export function SubmitButton({ children, pending: label = "Please wait…", className = "" }: { children: React.ReactNode; pending?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`btn ${className}`}>
      {pending ? label : children}
    </button>
  );
}

export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const msg = state.fieldErrors?.[name];
  return msg ? <p className="field-error" role="alert">{msg}</p> : null;
}

export function FormMessage({ state }: { state: ActionState }) {
  if (state.error) return <p className="field-error mt-3" role="alert">{state.error}</p>;
  if (state.ok && state.message) return <p className="mt-3 text-sm font-semibold text-brand" role="status">{state.message}</p>;
  return null;
}
