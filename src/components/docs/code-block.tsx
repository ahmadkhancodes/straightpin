"use client";

import { useState } from "react";

export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-md border border-border bg-surface-sunken">
      <div className="flex items-center justify-between border-b border-border px-4 py-1">
        <span className="caption-4 font-mono text-text-muted">{lang}</span>
        <button
          type="button"
          onClick={copy}
          className="caption-1 inline-flex min-h-11 items-center rounded-md px-3 text-text-subtle hover:text-text focus-visible:focus-ring"
        >
          {copied ? "Copied" : "Copy"}
          <span role="status" aria-live="polite" className="sr-only">{copied ? "Copied to clipboard" : ""}</span>
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono body-6 text-text" tabIndex={0}>
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  );
}
