import { product as p } from "@/config/product";
import type { LegalDoc } from "./types";

export const cookies: LegalDoc = {
  slug: "cookies",
  title: "Cookie policy",
  description: `The cookies ${p.name} sets and why.`,
  sections: [
    {
      id: "summary",
      title: "Summary",
      body: [`${p.name} uses only essential cookies. We set no advertising or cross site tracking cookies, so we do not show a consent banner.`],
    },
    {
      id: "essential",
      title: "Essential cookies",
      body: [
        "These keep you signed in and keep the service secure. The service does not work without them.",
        {
          table: {
            head: ["Purpose", "Lifetime"],
            rows: [
              ["Session cookie that keeps you signed in", "Up to 30 days, or until you sign out"],
              ["Security tokens for sign in and forms", "Short lived, minutes to hours"],
              ["Theme preference, stored locally in your browser", "Until you clear it"],
            ],
          },
        },
      ],
    },
    {
      id: "analytics",
      title: "Analytics",
      body: ["We use Vercel Web Analytics to count page views. It is cookieless and does not track you across sites or build a profile of you."],
    },
    {
      id: "control",
      title: "Your choices",
      body: ["You can block or delete cookies in your browser settings. If you block essential cookies you will not be able to sign in."],
    },
    {
      id: "contact",
      title: "Contact",
      body: [`Questions: ${p.legalEmail}.`],
    },
  ],
};
