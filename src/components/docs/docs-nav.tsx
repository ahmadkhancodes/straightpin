"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";

export interface NavGroup {
  title: string;
  items: { slug: string; title: string }[];
}

export function DocsNav({ groups, current }: { groups: NavGroup[]; current: string }) {
  const router = useRouter();
  return (
    <>
      <div className="lg:hidden">
        <label htmlFor="docs-select" className="title-4 mb-2 block text-text">Documentation</label>
        <select
          id="docs-select"
          value={current}
          onChange={(e) => router.push(`/docs/${e.target.value}`)}
          className="body-5 min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-text focus-visible:focus-ring"
        >
          {groups.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((i) => (
                <option key={i.slug} value={i.slug}>{i.title}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <nav aria-label="Documentation" className="hidden flex-col gap-6 lg:flex">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-1">
            <p className="caption-3 text-text-muted">{g.title}</p>
            <ul className="flex flex-col">
              {g.items.map((i) => (
                <li key={i.slug}>
                  <Link
                    href={`/docs/${i.slug}`}
                    aria-current={i.slug === current ? "page" : undefined}
                    className={cn(
                      "body-5 flex min-h-11 items-center rounded-md px-3 focus-visible:focus-ring",
                      i.slug === current ? "bg-surface-raised text-text" : "text-text-subtle hover:bg-surface-raised hover:text-text",
                    )}
                  >
                    {i.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
