export type LegalBlock = string | { list: string[] } | { table: { head: string[]; rows: string[][] } };

export interface LegalSection {
  id: string;
  title: string;
  body: LegalBlock[];
}

export interface LegalDoc {
  slug: string;
  title: string;
  description: string;
  sections: LegalSection[];
}
