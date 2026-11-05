import { product as p } from "@/config/product";
import type { LegalDoc } from "./types";

export const terms: LegalDoc = {
  slug: "terms",
  title: "Terms of service",
  description: `The agreement between you and ${p.legal.entity} for using ${p.name}.`,
  sections: [
    {
      id: "agreement",
      title: "Agreement",
      body: [
        `These terms are a contract between you and ${p.legal.entity} (${p.legal.address}). By creating an account or using ${p.name} you accept them. If you use the service for a company, you confirm you can bind that company.`,
      ],
    },
    {
      id: "service",
      title: "The service",
      body: [
        `${p.name} provides ${p.description.charAt(0).toLowerCase()}${p.description.slice(1)}`,
        "We may improve or change features. If we remove a feature you pay for, we will give you notice and a fair way out.",
      ],
    },
    {
      id: "accounts",
      title: "Accounts",
      body: [
        "Keep your sign in details and API keys safe. You are responsible for activity under your account. Tell us promptly at the support address if you suspect unauthorized access.",
      ],
    },
    {
      id: "plans-billing",
      title: "Plans and billing",
      body: [
        {
          list: p.plans.map((pl) => {
            const prices = pl.prices.length
              ? pl.prices.map((x) => `$${(x.usd / 100).toFixed(2)} per ${x.interval}`).join(" or ")
              : "free";
            return `${pl.name}: ${prices}.`;
          }),
        },
        "Paid plans are billed in advance through Stripe and renew automatically each period until you cancel. Prices exclude taxes, which we add where required. If a payment fails we keep your plan for a grace period and then move the account to the Free plan.",
      ],
    },
    {
      id: "cancel-refunds",
      title: "Cancellation and refunds",
      body: [
        "You can cancel anytime from the customer portal in Settings, then Billing. Your plan stays active until the end of the period you paid for.",
        "Refunds: {{refund policy}}",
      ],
    },
    {
      id: "acceptable-use",
      title: "Acceptable use",
      body: ["You must follow our acceptable use policy. We may suspend an account that breaks it."],
    },
    {
      id: "your-data",
      title: "Your data",
      body: [
        "You own your content and submissions. You give us a limited license to host, process and deliver it to run the service. You are responsible for having a lawful basis to collect the data your forms gather and for telling your visitors how it is used.",
      ],
    },
    {
      id: "ip",
      title: "Our intellectual property",
      body: [`${p.legal.entity} owns the service, its code and its brand. You get a limited right to use it under these terms.`],
    },
    {
      id: "availability",
      title: "Availability and support",
      body: [`We work to keep the service available but do not promise uninterrupted operation. Support is at ${p.supportEmail}.`],
    },
    {
      id: "warranty",
      title: "Disclaimer",
      body: ["The service is provided as is, to the extent the law allows, without warranties of fitness for a particular purpose."],
    },
    {
      id: "liability",
      title: "Limit of liability",
      body: [
        `To the extent the law allows, our total liability for any claim is limited to {{cap}}. We are not liable for indirect or consequential loss, such as lost profit. Nothing here limits liability that cannot be limited by law.`,
      ],
    },
    {
      id: "termination",
      title: "Termination",
      body: ["You can close your account at any time. We may suspend or end access for serious or repeated breach, with notice where we can give it. On termination you can export your data for 30 days unless the law or a security risk prevents it."],
    },
    {
      id: "governing-law",
      title: "Governing law",
      body: [`These terms are governed by the laws of ${p.legal.jurisdiction}. Courts there have jurisdiction, except where mandatory consumer law says otherwise.`],
    },
    {
      id: "changes",
      title: "Changes",
      body: ["We will email account owners at least 14 days before a material change takes effect. Continuing to use the service after that means you accept the change."],
    },
    {
      id: "contact",
      title: "Contact",
      body: [`Legal questions: ${p.legalEmail}.`],
    },
  ],
};
