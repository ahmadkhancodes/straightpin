"use client";
import { useState } from "react";
import { authError } from "@/components/app/api";
import { slugify } from "@/components/app/redirect";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";

const suffix = () => Math.random().toString(36).slice(2, 6);

export function OnboardingForm({ next }: { next: string }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugify(name);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (clean.length < 2) {
      setError("Give the organization a name of at least 2 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await authClient.organization.create({ name: clean, slug: `${slugify(clean)}-${suffix()}` });
    if (err || !data) {
      setBusy(false);
      setError(authError(err, "We could not create the organization. Try again."));
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    window.location.assign(next);
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field label="Organization name" htmlFor="org-name" error={error} hint={name.trim() ? `Your workspace address will start with ${slug}.` : "A company, a studio or your own name."}>
        <Input id="org-name" name="name" autoComplete="organization" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? "org-name-error" : undefined} />
      </Field>
      <Button type="submit" loading={busy}>Create organization</Button>
    </form>
  );
}
