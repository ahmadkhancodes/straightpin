import { cadence, freePlan, product as p } from "@/config/product";
import type { DocPage } from "./types";

export const gettingStarted: DocPage = {
  slug: "getting-started",
  title: "Getting started",
  description: `Sign in, pick your field and open your first job on ${p.name}.`,
  sections: [
    {
      heading: "Sign in",
      body: [
        "Enter your email and we send you a link. Tap it and you are in: there is no password and nothing else to fill in. If you answered the quiz first, your answers are kept. Signed up from your matches with Create a free account? Your daily email of new matches is already on. You can add a passkey later in Settings, under Security.",
      ],
    },
    {
      heading: "Pick your field",
      body: [
        "Choose the kind of work you want, such as customer support or data entry, then answer five short questions. We count the direct matches as you answer, then list them by how well they fit, newest first when two fit equally. Pay is in your own currency: dollars in the US, Canadian dollars in Canada, pounds in the UK.",
      ],
    },
    {
      heading: "Open a job and apply at the company",
      body: [
        `Every job shows its first posted date, how many times it was reposted and the website it comes from. Free accounts can open ${freePlan.limits.opens} jobs a day (they come back at midnight UTC) and save ${freePlan.limits.saves}. Back to matches keeps your answers. Tap Apply at company and the employer's own page opens. You apply as yourself.`,
      ],
    },
    {
      heading: "How often jobs are checked",
      body: [
        `We read company hiring pages ${cadence.checkPhrase}. Every job shows when we last checked it. Free accounts get ${cadence.digestPhrase}; paid plans get saved alerts ${cadence.alertPhrase}.`,
      ],
    },
  ],
};
