import { product as p } from "@/config/product";
import type { LegalDoc } from "./types";

export const subprocessors: LegalDoc = {
  slug: "subprocessors",
  title: "Subprocessors",
  description: `The third parties ${p.name} uses to process personal data.`,
  sections: [
    {
      id: "list",
      title: "Current subprocessors",
      body: [
        `${p.legal.entity} uses these providers to run ${p.name}. Each is bound by a data processing agreement.`,
        {
          table: {
            head: ["Provider", "Purpose", "Location"],
            rows: p.subProcessors.map((s) => [s.name, s.purpose, s.location]),
          },
        },
      ],
    },
    {
      id: "changes",
      title: "Changes to this list",
      body: [`We will email account owners at least 14 days before we add or replace a subprocessor. To object, write to ${p.legalEmail} within that period.`],
    },
  ],
};
