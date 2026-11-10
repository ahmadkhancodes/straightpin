/**
 * SAMPLE data for the storefront only (M1). Every company, pay figure and count here is invented for layout
 * and is labelled "sample" wherever it is shown. Real data arrives in M2 from the crawl.
 */
export type FieldId = "support" | "data-entry" | "admin" | "project" | "sales" | "operations" | "finance" | "marketing";

export interface SampleField {
  id: FieldId;
  label: string;
  /** Sample number of direct matches. */
  count: number;
  /** Sample number of staffing agency posts removed from that list. */
  agencyRemoved: number;
}

export interface SampleJob {
  id: string;
  field: FieldId;
  title: string;
  company: string;
  place: string;
  pay: string;
  /** Plain text, e.g. "2 days ago". */
  posted: string;
  postedDays: number;
  /** 0 = never reposted. */
  reposts: number;
  host: string;
  /** Path shown after the host on the tear off tab. */
  path: string;
  checked: string;
  tag?: "direct" | "new";
}

export const sampleFields: SampleField[] = [
  { id: "support", label: "Customer support", count: 312, agencyRemoved: 41 },
  { id: "data-entry", label: "Data entry", count: 187, agencyRemoved: 63 },
  { id: "admin", label: "Admin and executive assistant", count: 264, agencyRemoved: 38 },
  { id: "project", label: "Project coordination", count: 141, agencyRemoved: 22 },
  { id: "sales", label: "Sales and customer success", count: 298, agencyRemoved: 47 },
  { id: "operations", label: "Operations", count: 203, agencyRemoved: 29 },
  { id: "finance", label: "Finance and accounting support", count: 119, agencyRemoved: 18 },
  { id: "marketing", label: "Marketing coordination", count: 96, agencyRemoved: 14 },
];

export const sampleJobs: SampleJob[] = [
  { id: "s1", field: "support", title: "Customer Support Specialist", company: "Brightwell Home Health", place: "Remote, US", pay: "$19 to $24 an hour", posted: "2 days ago", postedDays: 2, reposts: 0, host: "jobs.lever.co", path: "/brightwell", checked: "today", tag: "direct" },
  { id: "s2", field: "support", title: "Member Care Representative", company: "Tidewater Credit Union", place: "Remote, US", pay: "$18.50 an hour", posted: "6 days ago", postedDays: 6, reposts: 0, host: "myworkdayjobs.com", path: "/tidewater", checked: "today" },
  { id: "s3", field: "support", title: "Customer Support Associate, Evenings", company: "Pinecrest Pet Supply", place: "Remote, US", pay: "$17 to $20 an hour", posted: "19 days ago", postedDays: 19, reposts: 1, host: "jobs.ashbyhq.com", path: "/pinecrest", checked: "today" },
  { id: "d1", field: "data-entry", title: "Data Entry Clerk", company: "Harlow & Finch Logistics", place: "Remote, Canada", pay: "C$22 to C$26 an hour", posted: "5 hours ago", postedDays: 0, reposts: 0, host: "boards.greenhouse.io", path: "/harlowfinch", checked: "today", tag: "new" },
  { id: "d2", field: "data-entry", title: "Records Entry Assistant", company: "Marlow County Library", place: "Hybrid, Ohio, US", pay: "$16.25 an hour", posted: "4 days ago", postedDays: 4, reposts: 0, host: "jobs.lever.co", path: "/marlowlib", checked: "today" },
  { id: "a1", field: "admin", title: "Administrative Assistant", company: "Oakmere Council Services", place: "Manchester, UK", pay: "£24,500", posted: "41 days ago", postedDays: 41, reposts: 3, host: "oakmere.gov.uk", path: "/careers", checked: "today" },
  { id: "a2", field: "admin", title: "Executive Assistant", company: "Redfern Architects", place: "Remote, US", pay: "$58,000 to $66,000", posted: "3 days ago", postedDays: 3, reposts: 0, host: "jobs.ashbyhq.com", path: "/redfern", checked: "today", tag: "direct" },
  { id: "p1", field: "project", title: "Project Coordinator", company: "Lakeshore Builders", place: "Toronto, Canada", pay: "C$62,000", posted: "8 days ago", postedDays: 8, reposts: 0, host: "apply.workable.com", path: "/lakeshore", checked: "today" },
  { id: "x1", field: "sales", title: "Customer Success Associate", company: "Fernhill Software", place: "Remote, US", pay: "$52,000 to $60,000", posted: "1 day ago", postedDays: 1, reposts: 0, host: "boards.greenhouse.io", path: "/fernhill", checked: "today", tag: "direct" },
  { id: "o1", field: "operations", title: "Operations Associate", company: "Granite Street Foods", place: "Remote, US", pay: "$21 an hour", posted: "12 days ago", postedDays: 12, reposts: 1, host: "jobs.lever.co", path: "/granitestreet", checked: "today" },
  { id: "f1", field: "finance", title: "Accounts Payable Clerk", company: "Wexford Dental Group", place: "Remote, US", pay: "$20 to $23 an hour", posted: "5 days ago", postedDays: 5, reposts: 0, host: "recruitee.com", path: "/wexford", checked: "today" },
  { id: "m1", field: "marketing", title: "Marketing Coordinator", company: "Kestrel Outdoor Co.", place: "London, UK", pay: "£29,000", posted: "7 days ago", postedDays: 7, reposts: 0, host: "kestrel.personio.de", path: "/job", checked: "today" },
];

export const jobsForField = (field: FieldId): SampleJob[] => sampleJobs.filter((j) => j.field === field);
export const fieldById = (id: FieldId): SampleField => sampleFields.find((f) => f.id === id) ?? sampleFields[0]!;
