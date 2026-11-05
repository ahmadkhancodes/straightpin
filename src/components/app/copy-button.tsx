"use client";
import { Check, Copy } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ value, label = "Copy", size = "sm" }: { value: string; label?: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 2000);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setFailed(false);
          setDone(true);
        } catch {
          setFailed(true);
        }
      }}
    >
      {done ? <Check size={16} weight="regular" aria-hidden /> : <Copy size={16} weight="regular" aria-hidden />}
      <span aria-live="polite">{failed ? "Select and copy" : done ? "Copied" : label}</span>
    </Button>
  );
}

/** A value shown once (API key, webhook secret) with a copy button and a plain warning. */
export function SecretReveal({ title, value, onDismiss }: { title: string; value: string; onDismiss: () => void }) {
  return (
    <div role="status" className="flex flex-col gap-3 rounded-lg border border-success bg-success-surface p-4">
      <p className="title-4 text-text">{title}</p>
      <p className="body-6 text-text-subtle">Copy it now. For your security we cannot show it again.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-surface px-3 py-2 caption-2 text-text">{value}</code>
        <CopyButton value={value} />
      </div>
      <div>
        <Button type="button" variant="tertiary" size="sm" onClick={onDismiss}>I have saved it</Button>
      </div>
    </div>
  );
}
