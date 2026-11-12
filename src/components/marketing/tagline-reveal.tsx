"use client";
import { useEffect, useMemo, useRef } from "react";
import { Section } from "@/components/ui/layout";

/**
 * Tagline reveal (library B11). A large statement whose words switch on one by one as each word scrolls past
 * 60% of the viewport: one IntersectionObserver entry per word, each word switched on once. Words not read yet
 * sit at 30% of the ink colour (`.kit-word` in globals.css). Reduced motion or no IntersectionObserver: every
 * word shows in full ink at once. Screen readers get the sentence once, from the sr-only copy.
 */
export function TaglineReveal({ text, label }: { text: string; label?: string }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLElement>(".kit-word"));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined") {
      for (const s of spans) s.dataset.on = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.on = "true";
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -40% 0px", threshold: 0 },
    );
    for (const s of spans) io.observe(s);
    return () => io.disconnect();
  }, [words.length]);

  return (
    <Section labelledBy="tagline-text">
      {label ? <p className="caption-3 mb-6 text-text-subtle">{label}</p> : null}
      <p id="tagline-text" className="heading-4 md:heading-1 max-w-5xl text-text" data-testid="tagline">
        <span className="sr-only">{text}</span>
        <span ref={ref} aria-hidden="true">
          {words.map((w, i) => (
            <span key={i} className="kit-word" data-on="false">
              {w}{i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </span>
      </p>
    </Section>
  );
}
