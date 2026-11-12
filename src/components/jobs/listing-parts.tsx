import { Warning } from "@phosphor-icons/react/dist/ssr";

/** Shared pieces of a listing row (docs/design-brief.md §5: the Help Wanted page). Server safe. */

/** The yellow stamp. Ink on signal yellow, square, small caps. */
export function DirectStamp({ label = "Direct to company" }: { label?: string }) {
  return <span className="kicker inline-block whitespace-nowrap bg-highlight px-1.5 py-0.5 text-on-highlight">{label}</span>;
}

export function OldPostingNote({ days }: { days: number }) {
  return (
    <p className="flex items-center gap-2 text-warning">
      <Warning size={16} weight="bold" aria-hidden />
      <span className="kicker">Old posting</span>
      <span className="caption-5 figures">{days} days</span>
    </p>
  );
}

/** Mono meta line: posted, reposts, source host. The posted part is ink, the rest subtle. */
export function MetaLine({ posted, reposts, host, extra }: { posted: string; reposts: string; host?: string | null; extra?: string }) {
  return (
    <p className="caption-4 figures mt-2 flex flex-wrap gap-x-3 gap-y-1 text-text-subtle">
      <span className="font-semibold text-text">{posted}</span>
      <span>{reposts}</span>
      {extra ? <span>{extra}</span> : null}
      {host ? <span className="min-w-0 truncate font-mono">{host}</span> : null}
    </p>
  );
}
