import Link from "next/link";
import { product } from "@/config/product";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#pick-field", label: "Jobs" },
      { href: "/pricing", label: "Pricing" },
      { href: "/how-we-check", label: "How we check" },
      { href: "/compare/directroles", label: "Compare" },
      { href: "/docs", label: "Help" },
      { href: "/account", label: "Account" },
      { href: "/bot", label: "Our crawler" },
      { href: "/about/data", label: "What we store" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/legal/privacy", label: "Privacy" },
      { href: "/legal/terms", label: "Terms" },
      { href: "/legal/refunds", label: "Refund policy" },
      { href: "/legal/cookies", label: "Cookies" },
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
            <Link href="/" className="heading-5 inline-flex min-h-11 w-fit items-center rounded-sm text-text focus-visible:focus-ring">{product.name}</Link>
            <p className="body-6 text-text-subtle">{product.tagline}</p>
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
              <a href={product.companyUrl} className={linkClass}>A BufferSol product</a>
              <a href={`mailto:${product.supportEmail}`} className={linkClass}>Contact</a>
            </nav>
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6">
          <p className="body-6 max-w-2xl text-text-subtle">
            Companies shown are samples and not affiliated with Straightpin. We are not a recruiter and never take a cut of your pay.
          </p>
          <p className="caption-2 text-text-subtle">A BufferSol product. &copy; {new Date().getFullYear()} {product.company}</p>
        </div>
      </div>
    </footer>
  );
}
