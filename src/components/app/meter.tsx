import type { UsageState } from "@/lib/billing/usage";
import { METER_LABELS, fmt } from "./labels";

const bar = { ok: "bg-action", near: "bg-warning", over: "bg-danger" } as const;

/** Usage bar. Width is a transform (scaleX), never an animated width. */
export function Meter({ state }: { state: UsageState }) {
  const label = METER_LABELS[state.meter];
  const ratio = Math.min(1, Math.max(0, state.ratio));
  const name = label.plural.charAt(0).toUpperCase() + label.plural.slice(1);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <p className="title-4 text-text">{name}</p>
        <p className="caption-2 text-text-subtle tabular-nums">
          {fmt(state.used)} of {fmt(state.limit)}{label.period ? ` ${label.period}` : ""}
        </p>
      </div>
      <div
        role="progressbar"
        aria-label={name}
        aria-valuemin={0}
        aria-valuemax={state.limit}
        aria-valuenow={Math.min(state.used, state.limit)}
        className="h-2 w-full overflow-hidden rounded-sm bg-surface-sunken"
      >
        <div
          className={`h-full w-full origin-left transition-transform duration-500 ease-out-kit ${bar[state.level]}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  );
}
