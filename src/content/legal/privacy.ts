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
        `${p.name} is operated by ${p.legal.entity}, ${p.legal.address}. This policy explains what personal data we handle when you visit ${p.host}, create an account or use the service. We are the controller of that data.`,
      ],
    },
    {
      id: "data",
      title: "What we collect",
      body: [
        {
          list: [
            "Account data: your email address and sign in details such as passkeys or a second step.",
            "Job search data: the fields you pick, the jobs you open and save, and your alert settings.",
            "Billing data: your plan, payment status and invoices. Card details go straight to Stripe and we never see or store them.",
            "Technical data: IP address, browser type and request logs, kept briefly for security, abuse prevention and debugging.",
            "Job listings: we read public job postings from employer careers pages. These are business information about roles, not personal data about you.",
          ],
        },
        "We do not sell personal data. We do not show ads. We do not use your data to train AI models, and we do not send your search to a language model.",
      ],
    },
    {
      id: "use",
      title: "Why we use it",
      body: [
        {
          list: [
            "Contract: to create your account, show your matches, send alerts and take payment.",
            "Legitimate interests: to keep the service secure, prevent abuse and fix problems.",
            "Legal duty: to keep invoices and respond to lawful requests.",
          ],
        },
      ],
    },
    {
      id: "sharing",
      title: "Who we share it with",
      body: ["Only the providers on the subprocessors page, who help us host the service, store data, take payments and send email. We share data with authorities only when the law requires it."],
    },
    {
      id: "retention",
      title: "How long we keep it",
      body: [
        {
          list: [
            "Account and job search data is kept while your account is open.",
            "When you delete your account we delete your data within 30 days, except invoices we must keep for tax law.",
            "Request logs are kept for 30 days.",
          ],
        },
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      body: [
        "You can download or delete your data yourself in Settings. You can also ask us to correct your data, limit how we use it or object to a use. In the UK and EU you can complain to your data protection authority. If you live in California you can ask what we hold, ask us to delete or correct it, and we do not sell or share your data. Canadian residents have similar rights under federal and provincial law.",
        `Write to ${p.legalEmail} and we reply within 30 days.`,
      ],
    },
    {
      id: "transfers",
      title: "International transfers",
      body: [
        "Our providers are mainly in the United States. When we transfer personal data from the EEA, UK or Switzerland, we rely on the EU Standard Contractual Clauses and the UK addendum, and on the EU US Data Privacy Framework where a provider is certified.",
      ],
    },
    {
      id: "security",
      title: "Security",
      body: [
        "We encrypt data in transit and at rest and limit access to people who need it. See the security page for details. No system is perfectly secure, and we will tell you about a breach that affects you as the law requires.",
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
      body: ["If we make a material change we will email you at least 14 days before it takes effect."],
    },
    {
      id: "contact",
      title: "Contact",
      body: [`Questions or requests: ${p.legalEmail}. For general help, write to ${p.supportEmail}.`],
    },
  ],
};
