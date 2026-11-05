"use client";
import { hardNavigate } from "./api";
import { CaretUpDown, Check, Plus } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/components/ui/cn";
import { Skeleton } from "@/components/ui/states";

export function OrgSwitcher({ activeId, activeName }: { activeId: string; activeName: string }) {
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  async function pick(orgId: string) {
    if (orgId === activeId) return setOpen(false);
    setSwitching(orgId);
    setError(null);
    const { error: err } = await authClient.organization.setActive({ organizationId: orgId });
    if (err) {
      setSwitching(null);
      setError("Could not switch organization. Try again.");
      return;
    }
    hardNavigate("/app");
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors duration-300 hover:bg-surface-raised focus-visible:focus-ring"
      >
        <span className="flex min-w-0 flex-col">
          <span className="caption-4 text-text-muted">Organization</span>
          <span className="title-4 truncate text-text">{activeName}</span>
        </span>
        <CaretUpDown size={16} weight="regular" aria-hidden className="shrink-0 text-text-subtle" />
      </button>
      {open ? (
        <div id={id} role="listbox" aria-label="Organizations" className="absolute left-0 top-full z-30 mt-1 flex w-full flex-col gap-1 rounded-md border border-border bg-surface p-1">
          {isPending ? <Skeleton className="h-8 w-full" /> : null}
          {(orgs ?? []).map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={o.id === activeId}
              disabled={!!switching}
              onClick={() => pick(o.id)}
              className={cn("flex min-h-11 w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-left body-5 text-text transition-colors duration-300 hover:bg-surface-raised focus-visible:focus-ring", switching === o.id && "opacity-50")}
            >
              <span className="truncate">{o.name}</span>
              {o.id === activeId ? <Check size={16} weight="regular" aria-hidden /> : null}
            </button>
          ))}
          <div className="h-px bg-border" aria-hidden />
          <Link href="/onboarding?new=1" className="flex min-h-11 items-center gap-2 rounded-sm px-2 py-2 body-5 text-text transition-colors duration-300 hover:bg-surface-raised focus-visible:focus-ring">
            <Plus size={16} weight="regular" aria-hidden />
            Create organization
          </Link>
          {error ? <p role="alert" className="px-2 pb-2 caption-2 text-danger">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
