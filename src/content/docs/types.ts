export interface DocSection {
  heading: string;
  /** Paragraphs, separated in the array. */
  body: string[];
  code?: { lang: string; code: string };
}

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  sections: DocSection[];
}
