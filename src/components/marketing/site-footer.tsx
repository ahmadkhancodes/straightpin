import Link from "next/link";
import { product } from "@/config/product";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Pricing" },
      { href: "/docs", label: "Docs" },
      { href: "/compare/web3forms", label: "Compare" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/dpa", label: "DPA" },
      { href: "/legal/security", label: "Security" },
      { href: "/legal/subprocessors", label: "Subprocessors" },
    ],
  },
] as const;

const linkClass =
  "inline-flex min-h-11 items-center rounded-sm body-6 text-text-subtle transition-colors duration-300 ease-out-kit hover:text-text focus-visible:focus-ring";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-raised">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 md:py-16 lg:px-8">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="flex max-w-xs flex-col gap-3 md:col-span-5">
            <Link href="/" className="title-2 w-fit rounded-sm text-text focus-visible:focus-ring">{product.name}</Link>
            <p className="body-6 text-text-subtle">{product.tagline}.</p>
          </div>
          <div className="grid grid-cols-2 gap-8 md:col-span-7 md:grid-cols-3">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className="flex flex-col">
                <p className="caption-3 mb-2 text-text">{col.title}</p>
                {col.links.map((l) => (
                  <Link key={l.href} href={l.href} className={linkClass}>{l.label}</Link>
                ))}
              </nav>
            ))}
            <nav aria-label="Company" className="flex flex-col">
              <p className="caption-3 mb-2 text-text">Company</p>
              <a href={product.companyUrl} className={linkClass}>{product.company}</a>
            </nav>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-1 border-t border-border pt-6 md:flex-row md:items-center md:justify-between">
          <p className="caption-2 text-text-subtle">A BufferSol product</p>
          <p className="caption-2 text-text-muted">&copy; {new Date().getFullYear()} {product.company}</p>
        </div>
      </div>
    </footer>
  );
}
