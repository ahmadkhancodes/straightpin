import { api } from "./api";
import { authentication } from "./authentication";
import { billing } from "./billing";
import { gettingStarted } from "./getting-started";
import type { DocPage } from "./types";
import { webhooks } from "./webhooks";

export type { DocPage, DocSection } from "./types";

export interface DocGroup {
  title: string;
  docs: DocPage[];
}

export const docs: DocPage[] = [gettingStarted, authentication, billing, webhooks, api];

export const docGroups: DocGroup[] = [
  { title: "Start here", docs: [gettingStarted, authentication] },
  { title: "Build", docs: [api, webhooks] },
  { title: "Account", docs: [billing] },
];

export const getDoc = (slug: string): DocPage | undefined => docs.find((d) => d.slug === slug);

export const sectionId = (heading: string): string =>
  heading.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
