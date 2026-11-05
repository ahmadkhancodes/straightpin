"use client";
import "./globals.css";

/** Last-resort boundary: replaces the root layout, so it carries its own html/body and plain tokens. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-surface text-text">
        <main id="main" className="mx-auto flex min-h-dvh max-w-xl flex-col items-start justify-center gap-4 px-4">
          <h1 className="heading-5">Something broke on our side</h1>
          <p className="body-6 text-text-subtle">
            The page failed to render. Reload to try again{error.digest ? <>, and quote reference <code>{error.digest}</code> if you contact support</> : ""}.
          </p>
          <button
            type="button"
            onClick={reset}
            className="button-md min-h-11 rounded-md bg-action px-3 py-2 text-action-text transition-colors duration-300 hover:bg-action-hover focus-visible:focus-ring"
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
