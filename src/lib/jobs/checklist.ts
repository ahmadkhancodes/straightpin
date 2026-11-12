export interface ChecklistInput { hasProfile: boolean; saved: number; digestOn: boolean; alertRules: number; opensToday: number }
export interface ChecklistStep { id: string; label: string; href: string; done: boolean }

/** The four things that get a job seeker to a first useful result. Pure so it can be tested. */
export function firstRunSteps(i: ChecklistInput): ChecklistStep[] {
  return [
    { id: "quiz", label: "Tell us your field, place and pay floor", href: "/quiz", done: i.hasProfile },
    { id: "save", label: "Save a job you might apply to", href: "/matches", done: i.saved > 0 },
    { id: "email", label: "Choose how we tell you about new jobs", href: "/alerts", done: i.hasProfile && (i.digestOn || i.alertRules > 0) },
    { id: "apply", label: "Apply at a company's own page", href: "/matches", done: i.opensToday > 0 },
  ];
}
