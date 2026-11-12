"use client";
import { ArrowRight } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * "Apply at company". A plain form POST answered with a redirect to the employer is blocked by the CSP
 * (`form-action 'self'`), so the button did nothing. We open the tab on click (so popup blockers allow it),
 * ask the API for the employer URL, then send that tab there. Errors are shown, never swallowed.
 */
export function ApplyButton({ jobId, host }: { jobId: string; host: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const res = await fetch(`/api/jobs/${jobId}/open`, { method: "POST", headers: { accept: "application/json" } });
      const body = (await res.json().catch(() => ({}))) as { applyUrl?: string; error?: string };
      if (res.ok && body.applyUrl) {
        if (tab) tab.location.href = body.applyUrl;
        else window.location.assign(body.applyUrl);
        return;
      }
      tab?.close();
      const from = encodeURIComponent(`/job/${jobId}`);
      if (res.status === 402) return void router.push(`/paywall?reason=opens&from=${from}`);
      // 401 = signed out, or signed in with no organization yet; /onboarding sends the first to sign-in and keeps the job.
      if (res.status === 401) return void router.push(`/onboarding?next=${from}`);
      setError(body.error === "account_suspended" ? "This account is suspended. Email support if you think this is a mistake." : body.error === "not_found" ? "The company has taken this job down." : "We could not open the company page. Try again in a moment.");
    } catch {
      tab?.close();
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky bottom-0 z-10 border-t-[1.5px] border-dashed border-rule md:static">
      <button type="button" onClick={go} aria-busy={busy} className="group flex min-h-14 w-full items-center justify-between gap-3 bg-highlight px-6 py-3 text-left text-on-highlight transition-colors duration-300 ease-out-kit hover:bg-signal-hover focus-visible:focus-ring">
        <span className="button-md inline-flex items-center gap-2 whitespace-nowrap transition-transform duration-tear ease-out-kit motion-reduce:transition-none group-hover:translate-x-1"><ArrowRight size={20} weight="bold" aria-hidden />Apply at company</span>
        <span className="hidden min-w-0 truncate font-mono text-xs text-on-highlight sm:block">{host}</span>
      </button>
      {error ? <p role="alert" className="body-6 bg-brand-tint px-6 py-3 text-text">{error}</p> : null}
    </div>
  );
}
