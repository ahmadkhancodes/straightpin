import { account } from "./account";
import { billing } from "./billing";
import { gettingStarted } from "./getting-started";
import type { DocPage } from "./types";

export type { DocPage, DocSection } from "./types";

export interface DocGroup {
  title: string;
  docs: DocPage[];
}

export const docs: DocPage[] = [gettingStarted, account, billing];

export const docGroups: DocGroup[] = [
  { title: "Start here", docs: [gettingStarted] },
  { title: "Account and billing", docs: [account, billing] },
];

export const getDoc = (slug: string): DocPage | undefined => docs.find((d) => d.slug === slug);

export const sectionId = (heading: string): string =>
  heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
