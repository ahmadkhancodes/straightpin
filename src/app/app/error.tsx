"use client";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="py-8">
      <ErrorState
        title="This page could not load"
        body={
          <>
            We could not load your workspace data. Your changes are safe. Try again, and if it keeps failing, email support with this reference{error.digest ? <>: <code>{error.digest}</code></> : "."}
          </>
        }
        action={<Button onClick={reset}>Try again</Button>}
      />
    </div>
  );
}
