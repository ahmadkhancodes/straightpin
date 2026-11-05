import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";

export const inputClass =
  "block w-full min-h-11 rounded-md border border-border-strong bg-surface px-3 py-2 body-6 text-text placeholder:text-text-muted transition-[border-color] duration-300 focus-visible:focus-ring aria-[invalid=true]:border-danger disabled:opacity-50";

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...rest} />;
}

export function Textarea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "min-h-24", className)} {...rest} />;
}

export function Select({ className, ...rest }: ComponentProps<"select">) {
  return <select className={cn(inputClass, "pr-8", className)} {...rest} />;
}

/** Label + control + hint/error. Errors are inline and specific (never alert()). */
export function Field({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="title-4 text-text">{label}</label>
      {children}
      {error ? <p id={`${htmlFor}-error`} role="alert" className="caption-2 text-danger">{error}</p> : hint ? <p className="caption-2 text-text-subtle">{hint}</p> : null}
    </div>
  );
}
