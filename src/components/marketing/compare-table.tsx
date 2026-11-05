import type { ReactNode } from "react";
import { Check, X } from "@phosphor-icons/react/dist/ssr";
import { cn } from "@/components/ui/cn";

export type CompareValue = boolean | string;
export interface CompareRow {
  label: string;
  values: CompareValue[];
}

function Cell({ value }: { value: CompareValue }) {
  if (value === true) return <span className="inline-flex items-center gap-2 text-success"><Check size={20} weight="regular" aria-hidden /><span className="sr-only">Yes</span></span>;
  if (value === false) return <span className="inline-flex items-center gap-2 text-text-muted"><X size={20} weight="regular" aria-hidden /><span className="sr-only">No</span></span>;
  const placeholder = value.includes("{{");
  return <span className={cn("body-5", placeholder ? "text-text-muted" : "text-text")}>{value}</span>;
}

/** Rows x columns. Scrolls horizontally inside its own container; first column stays pinned. */
export function CompareTable({
  caption, rowHeader = "Feature", columns, rows, highlightColumn,
}: { caption: ReactNode; rowHeader?: string; columns: string[]; rows: CompareRow[]; highlightColumn?: number }) {
  return (
    <div role="region" aria-label="Comparison table, scrolls sideways on small screens" tabIndex={0} className="overflow-x-auto rounded-lg border border-border focus-visible:focus-ring">
      <table className="w-full min-w-[32rem] border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border-strong">
            <th scope="col" className="sticky left-0 z-10 w-1/3 bg-surface-raised px-4 py-3 caption-3 text-text-subtle">{rowHeader}</th>
            {columns.map((c, i) => (
              <th key={c} scope="col" className={cn("px-4 py-3 title-4 text-text", i === highlightColumn ? "bg-surface-sunken" : "bg-surface-raised")}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-border last:border-b-0">
              <th scope="row" className="sticky left-0 z-10 bg-surface px-4 py-3 body-5 text-text">{r.label}</th>
              {r.values.map((v, i) => (
                <td key={i} className={cn("px-4 py-3 align-middle", i === highlightColumn ? "bg-surface-raised" : "bg-surface")}>
                  <Cell value={v} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
