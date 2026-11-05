"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { product } from "@/config/product";
import { ThemeToggle } from "@/components/theme";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

const STAGGER_MS = 60;

/** Floating bar, off the top edge. Mobile: full-height panel, staggered links (60ms, 24px rise, <= 400ms total). */
export function SiteHeader() {
  const pathname = usePathname();
  // The menu counts as open only on the page it was opened on, so navigating closes it without an effect.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpenFor(null);
    toggleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const items = [toggleRef.current, ...Array.from(panelRef.current?.querySelectorAll<HTMLElement>("a, button") ?? [])].filter(
        (x): x is HTMLElement => !!x,
      );
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!items.includes(active as HTMLElement)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const linkClass = (href: string) =>
    cn(
      "inline-flex min-h-11 items-center rounded-md px-3 button-sm transition-colors duration-300 ease-out-kit hover:bg-surface-raised hover:text-text focus-visible:focus-ring",
      isCurrent(href) ? "text-text" : "text-text-subtle",
    );

  const panelItems = [
    ...product.nav.map((n) => ({ ...n, kind: "link" as const })),
    { href: "/sign-in", label: "Sign in", kind: "link" as const },
    { href: "/sign-in", label: "Start free", kind: "cta" as const },
  ];

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-4 sm:px-6">
      <div className="relative z-50 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 rounded-lg border border-border bg-surface/80 py-1 pl-4 pr-1 backdrop-blur-md">
        <Link href="/" className="inline-flex min-h-11 items-center rounded-md title-2 text-text focus-visible:focus-ring" aria-label={`${product.name} home`}>
          {product.name}
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {product.nav.map((n) => (
            <Link key={n.href} href={n.href} aria-current={isCurrent(n.href) ? "page" : undefined} className={linkClass(n.href)}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Link href="/sign-in" className={cn(buttonClass("tertiary", "md"), "hidden md:inline-flex")}>Sign in</Link>
          <Link href="/sign-in" className={cn(buttonClass("primary", "md"), "hidden md:inline-flex")}>Start free</Link>
          <ThemeToggle />
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => (open ? close() : setOpenFor(pathname))}
            className="inline-flex size-11 items-center justify-center rounded-md text-text transition-colors duration-300 ease-out-kit hover:bg-surface-raised focus-visible:focus-ring md:hidden"
          >
            <span aria-hidden className="relative block size-6">
              <span className={cn("absolute left-1 right-1 top-2 h-0.5 rounded-sm bg-current transition-transform duration-300 ease-out-kit", open && "translate-y-1 rotate-45")} />
              <span className={cn("absolute bottom-2 left-1 right-1 h-0.5 rounded-sm bg-current transition-transform duration-300 ease-out-kit", open && "-translate-y-1 -rotate-45")} />
            </span>
          </button>
        </div>
      </div>

      <div
        ref={panelRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={cn(
          "fixed inset-0 z-40 flex flex-col bg-surface px-4 pt-24 transition-[opacity,visibility] duration-200 ease-out-kit md:hidden",
          open ? "visible opacity-100" : "invisible opacity-0",
        )}
      >
        <nav aria-label="Mobile" className="flex flex-col">
          {panelItems.map((item, i) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={() => setOpenFor(null)}
              style={{ transitionDelay: open ? `${i * STAGGER_MS}ms` : "0ms" }}
              className={cn(
                "transition-[opacity,transform] duration-200 ease-out-kit focus-visible:focus-ring",
                open ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
                item.kind === "cta"
                  ? cn(buttonClass("primary", "lg"), "mt-8")
                  : "flex min-h-12 items-center border-b border-border heading-5 text-text",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
