import { product as p } from "@/config/product";
import type { LegalDoc } from "./types";

export const privacy: LegalDoc = {
  slug: "privacy",
  title: "Privacy policy",
  description: `How ${p.name} collects, uses and protects personal data, and the rights you have over it.`,
  sections: [
    {
      id: "who-we-are",
      title: "Who we are",
      body: [
        `${p.name} is operated by ${p.legal.entity}, ${p.legal.address}. This policy explains what personal data we handle when you visit ${p.host}, create an account or use the service.`,
        `For account and billing data we are the controller. For form submissions that your visitors send to your endpoints, you are the controller and we are your processor. The data processing addendum covers that second case.`,
      ],
    },
    {
      id: "data-we-collect",
      title: "Data we collect",
      body: [
        "We collect only what we need to run the service.",
        {
          list: [
            "Account data: your email address, name if you give one, and sign in credentials such as passkeys or two factor settings.",
            "Organization data: workspace name, members, roles, API keys (stored hashed) and the settings you configure.",
            "Billing data: your plan and subscription status. Card details go straight to Stripe and never touch our servers.",
            "Form submissions: the fields and files that visitors of your sites send to your endpoints, plus delivery receipts and spam verdicts. You receive this data and we store it for you.",
            "Technical data: IP address, browser type and request logs, kept briefly for security, abuse prevention and debugging.",
          ],
        },
        "We do not sell personal data and we do not use submission content for advertising or to train models.",
      ],
    },
    {
      id: "how-we-use-it",
      title: "How we use it and our legal bases",
      body: [
        "If you are in the European Economic Area or the United Kingdom, we rely on these legal bases under the GDPR and UK GDPR.",
        {
          list: [
            "Contract: to create your account, deliver submissions and bill you.",
            "Legitimate interests: to secure the service, prevent abuse and spam, and keep records that let us fix problems.",
            "Legal obligation: to keep tax and accounting records.",
            "Consent: for optional communications, which you can withdraw at any time.",
          ],
        },
      ],
    },
    {
      id: "sharing",
      title: "Who we share data with",
      body: [
        "We share data only with the subprocessors listed on our subprocessors page, and only to provide the service. We may also disclose data if a valid legal request requires it, and we will tell you first unless the law forbids it.",
      ],
    },
    {
      id: "retention",
      title: "Retention",
      body: [
        {
          list: [
            "Account and organization data is kept while your account is open.",
            "Submissions are kept for the history period of your plan, then deleted.",
            "After you delete your account we remove your data within 30 days, except billing records we must keep by law, which are kept for the period the law requires.",
            "Server logs are kept for up to 30 days.",
            "Backups roll off within 35 days after deletion.",
          ],
        },
      ],
    },
    {
      id: "deletion-export",
      title: "Account deletion and data export",
      body: [
        "You can export or delete your data yourself. In the app, open Settings, then Account. You can also use the API: GET /api/account/export returns a copy of your data, and DELETE /api/account permanently deletes your account and workspace.",
      ],
    },
    {
      id: "your-rights",
      title: "Your rights under GDPR and UK GDPR",
      body: [
        "You can ask us to access, correct, delete, restrict or port your personal data, and you can object to processing based on legitimate interests. Most of these you can do from Settings. For anything else, email us. You also have the right to complain to your data protection authority.",
      ],
    },
    {
      id: "ccpa",
      title: "California rights under CCPA and CPRA",
      body: [
        "If you live in California you can ask what personal information we hold, ask us to delete or correct it, and ask us to stop selling or sharing it. We do not sell or share personal information for cross context advertising. We will not discriminate against you for using these rights.",
      ],
    },
    {
      id: "transfers",
      title: "International transfers",
      body: [
        "Our subprocessors are mainly in the United States. When we transfer personal data from the EEA, UK or Switzerland, we rely on the EU Standard Contractual Clauses and the UK addendum, and on the EU US Data Privacy Framework where a provider is certified.",
      ],
    },
    {
      id: "security",
      title: "Security",
      body: [
        "We encrypt data in transit and at rest and limit access to people who need it. See the security page for details. No system is perfectly secure, and we will notify you of a breach that affects you as the law requires.",
      ],
    },
    {
      id: "children",
      title: "Children",
      body: [`${p.name} is not directed at children under 16 and we do not knowingly collect their data.`],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      body: ["If we make a material change we will email account owners at least 14 days before it takes effect."],
    },
    {
      id: "contact",
      title: "Contact",
      body: [`Questions or requests: ${p.legalEmail}. For general help, write to ${p.supportEmail}.`],
    },
  ],
};
