"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

/**
 * Accessible confirm dialog on the native <dialog> (focus trap, Escape, inert background for free).
 * Optional typed confirmation. Replaces window.confirm().
 */
export function ConfirmDialog({
  open, title, children, confirmLabel, cancelLabel = "Cancel", danger = true, typeToConfirm, busy, error, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  typeToConfirm?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [typed, setTyped] = useState("");
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const ready = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase();
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-t`}
      onClose={() => { setTyped(""); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      className="m-auto w-full max-w-md rounded-lg border border-border bg-surface p-0 text-text backdrop:bg-surface-inverse/60"
    >
      <form
        method="dialog"
        className="flex flex-col gap-4 p-6"
        onSubmit={(e) => { e.preventDefault(); if (ready && !busy) onConfirm(); }}
      >
        <h2 id={`${id}-t`} className="heading-6 text-text">{title}</h2>
        {children ? <div className="body-6 text-text-subtle">{children}</div> : null}
        {typeToConfirm ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-c`} className="title-4 text-text">Type <span className="font-mono">{typeToConfirm}</span> to confirm</label>
            <Input id={`${id}-c`} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        ) : null}
        {error ? <p role="alert" className="caption-2 text-danger">{error}</p> : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => ref.current?.close()}>{cancelLabel}</Button>
          <Button type="submit" variant={danger ? "danger" : "primary"} disabled={!ready} loading={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </dialog>
  );
}
