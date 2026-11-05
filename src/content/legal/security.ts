import { product as p } from "@/config/product";
import type { LegalDoc } from "./types";

export const security: LegalDoc = {
  slug: "security",
  title: "Security",
  description: `How ${p.name} protects your account and your data.`,
  sections: [
    {
      id: "account",
      title: "Your account",
      body: [
        {
          list: [
            "Sign in with an emailed link or a passkey. There is no password for us to lose.",
            "Optional second step on your account.",
            "Sessions expire and you can sign out everywhere.",
          ],
        },
      ],
    },
    {
      id: "data",
      title: "Your data",
      body: [
        {
          list: [
            "Encrypted in transit (TLS) and at rest.",
            "Card details are handled by Stripe. We never see or store them.",
            "Every query is scoped to your account.",
            "Access to production data is limited to the people who run the service.",
          ],
        },
      ],
    },
    {
      id: "service",
      title: "The service",
      body: [
        {
          list: [
            "Rate limiting on public endpoints.",
            "Our crawler reads only public pages, respects robots.txt and limits how fast it asks each site.",
            "Signed, replay safe handling of payment events from Stripe.",
          ],
        },
      ],
    },
    {
      id: "report",
      title: "Report a problem",
      body: [`Found a security problem? Email ${p.legalEmail}. Please give us a reasonable time to fix it before you share it.`],
    },
  ],
};
