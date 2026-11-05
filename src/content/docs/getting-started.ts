import { freePlan, product as p } from "@/config/product";
import type { DocPage } from "./types";

export const gettingStarted: DocPage = {
  slug: "getting-started",
  title: "Getting started",
  description: `Sign in, pick your field and open your first job on ${p.name}.`,
  sections: [
    {
      heading: "Sign in",
      body: [
        "Enter your email and we send you a link. Tap it and you are in. There is no password to remember. You can add a passkey later in Settings.",
      ],
    },
    {
      heading: "Pick your field",
      body: [
        "Choose the kind of work you want, such as customer support or data entry. We count the direct matches as you answer, then show them newest first.",
      ],
    },
    {
      heading: "Open a job and apply at the company",
      body: [
        `Every job shows its first posted date, how many times it was reposted and the website it comes from. Free accounts can open ${freePlan.limits.opens} jobs a day and save ${freePlan.limits.saves}. Tap Apply at company and the employer's own page opens. You apply as yourself.`,
      ],
    },
  ],
};
