import { product as p } from "@/config/product";
import type { DocPage } from "./types";

export const account: DocPage = {
  slug: "account",
  title: "Your account",
  description: "Sign in, security, your data and deleting your account.",
  sections: [
    {
      heading: "Signing in",
      body: ["We email you a sign in link. A passkey (your phone or laptop unlock) can replace it. If you add a second step, you are asked for it after the link."],
    },
    {
      heading: "Your data",
      body: [
        "We keep your email, saved jobs, the fields you picked and your billing status. Payments are handled by Stripe, so we never see your card number. See the privacy policy for the full list.",
        "You can download your data or delete your account from Settings.",
      ],
    },
    {
      heading: "Contact",
      body: [`Email ${p.supportEmail}. A person reads it.`],
    },
  ],
};
