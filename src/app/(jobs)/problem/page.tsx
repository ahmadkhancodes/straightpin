import type { Metadata } from "next";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { Container } from "@/components/ui/layout";
import { ErrorState } from "@/components/ui/states";
import { PROBLEMS } from "@/lib/security/guard";

export const metadata: Metadata = { title: "Something went wrong", robots: { index: false } };

/** Where a plain form post lands when it fails: what happened and what to do next, never raw JSON. */
export default async function ProblemPage({ searchParams }: { searchParams: Promise<{ code?: string; back?: string }> }) {
  const q = await searchParams;
  const p = PROBLEMS[q.code ?? ""] ?? PROBLEMS.server_error!;
  const back = q.back && /^\/[^/\\]/.test(q.back) ? q.back : "/";
  return (
    <Container className="py-12 md:py-16">
      <div className="max-w-xl">
        <ErrorState title={p.title} body={p.body} action={<Link href={back} className={buttonClass("primary")}>Go back</Link>} />
      </div>
    </Container>
  );
}
