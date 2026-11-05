import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme";
import { product } from "@/config/product";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
        <Link href="/" className="heading-6 text-text focus-visible:focus-ring">{product.name}</Link>
        <ThemeToggle />
      </header>
      <main id="main" className="flex flex-1 flex-col justify-center px-4 py-12 sm:px-6 lg:px-10">
        <div className="flex w-full max-w-md flex-col gap-8 lg:ml-24">{children}</div>
      </main>
      <footer className="px-4 py-6 sm:px-6 lg:px-10">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 body-6 text-text-subtle transition-colors duration-300 hover:text-text focus-visible:focus-ring">
          <ArrowLeft size={16} weight="regular" aria-hidden />
          Back to {product.name}
        </Link>
      </footer>
    </div>
  );
}
