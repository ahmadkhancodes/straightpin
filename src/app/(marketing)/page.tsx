import type { Metadata } from "next";
import { Section } from "@/components/ui/layout";
import { Badge } from "@/components/ui/states";
import {
  Faq, Features, FinalCta, Hero, HowItWorks, PricingTable, Problem, Proof, TaglineReveal,
  type FaqItem, type Feature, type ProblemItem, type Step,
} from "@/components/marketing";
import { SubmissionInbox } from "@/components/marketing/demo/submission-inbox";
import { freePlan, product } from "@/config/product";

export const metadata: Metadata = {
  title: { absolute: `${product.fullName}: ${product.tagline}` },
  description: product.description,
  alternates: { canonical: "/" },
  openGraph: { title: `${product.fullName}: ${product.tagline}`, description: product.description, url: "/" },
};

const problems: ProblemItem[] = [
  { pain: "The client says the contact form is broken and I can't prove it isn't.", detail: "An email that never showed up leaves nothing to inspect. A delivery receipt per submission shows what was sent, when, and where." },
  { pain: "Spam used up my free quota.", detail: "Spam is blocked before it is counted. It never counts toward your quota on any plan." },
  { pain: "We hit the limit and lost real enquiries.", detail: "Over-limit submissions are held, not dropped. They wait in your inbox until you release them." },
];

const code = `<form action="https://${product.host}/f/{{form-id}}" method="POST">
  <input type="email" name="email" required />
  <textarea name="message"></textarea>
  <button type="submit">Send</button>
</form>`;

function CodeBlock() {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border bg-surface-raised p-4 caption-2 text-text" tabIndex={0}>
      <code>{code}</code>
    </pre>
  );
}

function ReceiptFragment() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="title-4 text-text">Daniel Okafor</p>
        <Badge tone="success">Delivered</Badge>
      </div>
      <p className="body-6 text-text-subtle">Do you ship to Lagos? We need 40 units by January.</p>
      <p className="caption-4 border-t border-border pt-3 text-text-subtle">Received 14:07:09, delivered 14:07:12 to hello@okaforbuilds.ng</p>
    </div>
  );
}

function HeldFragment() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="title-4 text-text">Hannah Lindqvist</p>
        <Badge tone="warning">Held</Badge>
      </div>
      <p className="body-6 text-text-subtle">The booking form shows an error after step 2.</p>
      <p className="caption-4 border-t border-border pt-3 text-text-subtle">Over limit, kept for release</p>
    </div>
  );
}

const steps: Step[] = [
  { title: "Point your form at your endpoint", body: "Set the form action to your Postslot URL. It accepts a normal HTML form POST, so it works on static and AI-built sites.", visual: <CodeBlock /> },
  { title: "Every submission is emailed", body: "Each one is sent to your verified recipient the moment it arrives, with the fields laid out as the visitor filled them in.", visual: <SubmissionInbox /> },
  { title: "Open the receipt when someone asks", body: "Each submission has a delivery receipt: received, delivered or held, with the time. Answer the client in one look.", visual: <ReceiptFragment /> },
];

const features: Feature[] = [
  { title: "A delivery receipt for every submission", body: "See whether it was delivered, held or blocked as spam, and when.", span: 4, visual: <div className="p-4"><ReceiptFragment /></div> },
  { title: "Spam never counts", body: "Blocked spam stays out of your quota on every plan, Free included.", span: 2 },
  { title: "Held, not dropped", body: "Go over your limit and new submissions wait for you instead of vanishing.", span: 2, visual: <div className="p-4"><HeldFragment /></div> },
  { title: "Unlimited forms and domains", body: `The ${freePlan.name} plan already covers every form on every domain, with ${freePlan.limits.submissions} submissions a month.`, span: 4 },
  { title: "Your own sending domain", body: "On Pro, notification emails come from your domain, not ours.", span: 3 },
  { title: "Autoresponder and file uploads", body: "Reply to the visitor automatically and accept files on the same form. Webhooks and integrations start on Starter.", span: 3 },
];

const faq: FaqItem[] = [
  { q: `What is ${product.name}?`, a: "A form endpoint for static, Jamstack and AI-built sites. It receives HTML form POSTs, emails them to you and records a delivery receipt for each submission." },
  { q: "How do I connect a form?", a: "Set your form's action to your Postslot endpoint and keep method POST. No JavaScript is needed." },
  { q: "What is a delivery receipt?", a: "A record on each submission showing when it was received and whether it was delivered, held or blocked as spam." },
  { q: "Does spam count toward my quota?", a: "No. Spam never counts toward your submission quota on any plan." },
  { q: "What happens if I go over my limit?", a: "Over-limit submissions are held, not dropped. You can release them once you have more room." },
  { q: "Is there a free plan?", a: `Yes. Free includes ${freePlan.limits.submissions} submissions a month, unlimited forms and domains, 1 verified recipient and a 90 day history. No credit card needed.` },
  { q: "Can I send from my own domain?", a: "Yes, a custom sending domain is included on Pro." },
  { q: "Can I cancel anytime?", a: "Yes. Cancel a paid plan from your account whenever you like." },
];

export default function HomePage() {
  return (
    <>
      <Hero
        title={<>Every form submission arrives.<br />Here is the receipt.</>}
        subtitle={product.description}
        primaryCta={{ href: "/sign-in", label: "Start free" }}
        secondaryCta={{ href: "/pricing", label: "See pricing" }}
        proof={`${freePlan.limits.submissions} submissions a month on Free. Spam never counts.`}
        visual={<SubmissionInbox />}
      />
      <Problem
        title="When a form fails, you hear about it last"
        intro="A contact form is the one place a lead hands you their details. When it goes quiet you want facts, not guesses."
        items={problems}
      />
      <HowItWorks title="From form to inbox in three steps" steps={steps} />
      <TaglineReveal text="Every submission gets a receipt. Spam never counts. Nothing over the limit is dropped." />
      <Features title="Built around proof of delivery" items={features} />
      <Proof />
      <Section labelledBy="pricing-title">
        <PricingTable title="Plans for one site or fifty" />
      </Section>
      <Faq items={faq} />
      <FinalCta
        title="Put a receipt behind your next form"
        body="Create an endpoint, paste it into your form and send a test submission."
        cta={{ href: "/sign-in", label: "Start free" }}
        note="No credit card needed."
      />
    </>
  );
}
