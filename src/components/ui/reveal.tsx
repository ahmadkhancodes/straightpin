"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** Rise 32px + fade, once, via IntersectionObserver (playbook §7). Reduced motion handled in CSS. */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e?.isIntersecting) { setVisible(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} data-visible={visible} className={`kit-reveal ${className ?? ""}`}>{children}</div>;
}
