import { acceptableUse } from "./acceptable-use";
import { cookies } from "./cookies";
import { dpa } from "./dpa";
import { privacy } from "./privacy";
import { security } from "./security";
import { subprocessors } from "./subprocessors";
import { terms } from "./terms";
import type { LegalDoc } from "./types";

export type { LegalBlock, LegalDoc, LegalSection } from "./types";

export const legalDocs: LegalDoc[] = [privacy, terms, dpa, security, subprocessors, cookies, acceptableUse];

export const getLegalDoc = (slug: string): LegalDoc | undefined => legalDocs.find((d) => d.slug === slug);
