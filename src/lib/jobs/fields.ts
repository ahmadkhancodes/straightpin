/** The 8 fields (docs/brief.md) and the deterministic title taxonomy used at ingest and by the quiz. Pure TS. */
export type FieldId = "support" | "data-entry" | "admin" | "project" | "sales" | "operations" | "finance" | "marketing";

export const FIELDS: { id: FieldId; label: string }[] = [
  { id: "support", label: "Customer support" },
  { id: "data-entry", label: "Data entry" },
  { id: "admin", label: "Admin and executive assistant" },
  { id: "project", label: "Project coordination" },
  { id: "sales", label: "Sales and customer success" },
  { id: "operations", label: "Operations" },
  { id: "finance", label: "Finance and accounting support" },
  { id: "marketing", label: "Marketing coordination" },
];

export const isFieldId = (v: unknown): v is FieldId => FIELDS.some((f) => f.id === v);
export const fieldLabel = (id: FieldId): string => FIELDS.find((f) => f.id === id)?.label ?? id;

/** First match wins, so the more specific fields come first. Words are matched on a normalised title. */
const RULES: [FieldId, RegExp][] = [
  ["data-entry", /\b(data entry|data clerk|records? (entry|clerk|assistant)|data processing)\b/],
  ["admin", /\b(administrative|executive assistant|office (manager|assistant|coordinator)|receptionist|personal assistant|admin assistant)\b/],
  ["finance", /\b(accounts? (payable|receivable)|accounting (clerk|assistant|associate|specialist)|bookkeep\w*|payroll|billing (specialist|clerk|coordinator)|finance (assistant|associate|coordinator))\b/],
  ["support", /\b(customer (support|service|care|experience)|support (specialist|representative|agent|associate)|member (care|support|services)|help ?desk|client services? (representative|associate))\b/],
  ["sales", /\b(customer success|account (executive|manager)|sales (development|representative|associate|coordinator)|business development|sdr|bdr)\b/],
  ["project", /\b(project (coordinator|assistant|administrator)|program (coordinator|assistant)|delivery coordinator)\b/],
  ["marketing", /\b(marketing (coordinator|assistant|associate|specialist)|social media (coordinator|specialist)|content coordinator|communications coordinator)\b/],
  ["operations", /\b(operations? (associate|coordinator|assistant|analyst|specialist)|logistics coordinator|dispatcher|fulfillment|supply chain (coordinator|associate))\b/],
];

/** Null when the title is outside the 8 fields (those jobs are not stored: D-010). */
export function fieldOfTitle(titleNorm: string): FieldId | null {
  const t = ` ${titleNorm.toLowerCase()} `;
  for (const [id, re] of RULES) if (re.test(t)) return id;
  return null;
}

export type Level = "entry" | "mid" | "senior";
export type Schedule = "full" | "part";

export function levelOfTitle(titleNorm: string): Level {
  const t = titleNorm.toLowerCase();
  if (/\b(senior|sr|lead|principal|head|director|manager|supervisor|staff)\b/.test(t)) return "senior";
  if (/\b(junior|jr|entry|associate|assistant|clerk|trainee|intern|apprentice|coordinator|representative|receptionist)\b/.test(t)) return "entry";
  return "mid";
}

export function scheduleOf(title: string, excerpt: string): Schedule {
  return /\bpart[\s-]?time\b/i.test(`${title} ${excerpt.slice(0, 300)}`) ? "part" : "full";
}

const HOURS = { hour: 1, day: 1 / 8, week: 1 / 40, month: 1 / 173.33, year: 1 / 2080 } as const;
/** Pay as an hourly figure, so one pay floor question works for hourly and salaried jobs. */
export function hourlyEquivalent(amount: number | null, period: keyof typeof HOURS | null): number | null {
  if (amount === null || period === null) return null;
  return Math.round(amount * HOURS[period] * 100) / 100;
}
