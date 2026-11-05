import { cookies } from "./cookies";
import { privacy } from "./privacy";
import { refunds } from "./refunds";
import { security } from "./security";
import { subprocessors } from "./subprocessors";
import { terms } from "./terms";
import type { LegalDoc } from "./types";

export type { LegalBlock, LegalDoc, LegalSection } from "./types";

export const legalDocs: LegalDoc[] = [privacy, terms, refunds, security, subprocessors, cookies];

export const getLegalDoc = (slug: string): LegalDoc | undefined => legalDocs.find((d) => d.slug === slug);
