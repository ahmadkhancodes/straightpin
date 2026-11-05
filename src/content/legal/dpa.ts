import { product as p } from "@/config/product";
import type { LegalDoc } from "./types";

export const dpa: LegalDoc = {
  slug: "dpa",
  title: "Data processing addendum",
  description: `The terms under which ${p.name} processes personal data on your behalf.`,
  sections: [
    {
      id: "scope",
      title: "Scope and roles",
      body: [
        `This addendum applies when ${p.legal.entity} processes personal data in form submissions on your behalf. You are the controller and we are the processor. It forms part of the terms of service.`,
      ],
    },
    {
      id: "details",
      title: "Details of processing",
      body: [
        {
          list: [
            "Subject matter: receiving, storing, filtering and delivering form submissions.",
            "Duration: while your account is open, plus the deletion period in the privacy policy.",
            "Data subjects: people who submit your forms.",
            "Data types: whatever fields and files your forms collect, plus IP address and user agent for spam checks.",
          ],
        },
      ],
    },
    {
      id: "instructions",
      title: "Our obligations",
      body: [
        {
          list: [
            "We process personal data only on your documented instructions, which are these terms and your use of the service.",
            "Everyone with access is bound by confidentiality.",
            "We apply the security measures described on the security page.",
            "We help you answer data subject requests and meet your security and breach duties, taking into account the nature of processing.",
            "We notify you without undue delay, and within 72 hours where we can, after becoming aware of a personal data breach.",
            "On termination we delete or return the data as described in the privacy policy, unless the law requires us to keep it.",
            "We give you the information you reasonably need to show compliance and allow audits through a written questionnaire once a year.",
          ],
        },
      ],
    },
    {
      id: "subprocessors",
      title: "Subprocessors",
      body: ["You authorize the subprocessors on our subprocessors page. We will give you at least 14 days notice before adding or replacing one, and you may object on reasonable grounds."],
    },
    {
      id: "transfers",
      title: "International transfers",
      body: ["Where personal data moves from the EEA, UK or Switzerland to a country without an adequacy decision, the Standard Contractual Clauses (module two, controller to processor) and the UK addendum apply and are incorporated here."],
    },
    {
      id: "contact",
      title: "Contact and signed copy",
      body: [`To request a countersigned copy, email ${p.legalEmail}. Our address is ${p.legal.address}.`],
    },
  ],
};
