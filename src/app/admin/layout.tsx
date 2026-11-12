import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { product } from "@/config/product";
import { isFounderAdmin, requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const s = await requireUser({ redirectTo: "/admin" });
  if (!isFounderAdmin(s.user.email)) notFound();
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between border-b border-border px-4 py-2 sm:px-6 lg:px-10">
        <div className="flex items-center gap-4">
          <span className="heading-6 text-text">{product.name} admin</span>
          <Link href="/app" className="inline-flex min-h-11 items-center gap-2 body-6 text-text-subtle transition-colors duration-300 hover:text-text focus-visible:focus-ring">
            <ArrowLeft size={16} weight="regular" aria-hidden />
            Back to app
          </Link>
        </div>
        <nav aria-label="Admin" className="hidden items-center gap-4 md:flex">
          {[["/admin", "Overview"], ["/admin/crawl", "Crawl health"], ["/admin/review", "Review queue"], ["/admin/users", "Users"]].map(([href, label]) => (
            <Link key={href} href={href!} className="inline-flex min-h-11 items-center body-6 text-text-subtle transition-colors duration-300 hover:text-text focus-visible:focus-ring">{label}</Link>
          ))}
        </nav>
      </header>
      <nav aria-label="Admin sections" className="flex gap-4 overflow-x-auto border-b border-border px-4 md:hidden">
        {[["/admin", "Overview"], ["/admin/crawl", "Crawl"], ["/admin/review", "Review"], ["/admin/users", "Users"]].map(([href, label]) => (
          <Link key={href} href={href!} className="inline-flex min-h-11 items-center whitespace-nowrap body-6 text-text-subtle hover:text-text focus-visible:focus-ring">{label}</Link>
        ))}
      </nav>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 lg:px-10 lg:py-12">{children}</main>
    </div>
  );
}
