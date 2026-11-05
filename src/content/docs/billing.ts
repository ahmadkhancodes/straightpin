import { intervalText, product as p } from "@/config/product";
import type { DocPage } from "./types";

const money = (usd: number) => `$${(usd / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export const billing: DocPage = {
  slug: "billing",
  title: "Billing and refunds",
  description: `Plans, how to cancel in two taps and how to get a ${p.refundDays} day refund.`,
  sections: [
    {
      heading: "Plans",
      body: p.plans.map((pl) => {
        const prices = pl.prices.length
          ? pl.prices.map((x) => `${money(x.usd)} ${intervalText(x.interval)}`).join(" or ")
          : "free";
        return `${pl.name} (${prices}): ${pl.highlights.join(", ")}.`;
      }),
    },
    {
      heading: "Cancel in two taps",
      body: ["Open Billing, then tap Cancel plan. Your plan stays active until the end of the period you paid for. We email a renewal reminder before every renewal, with the date and the amount."],
    },
    {
      heading: "Refunds",
      body: [`Changed your mind within ${p.refundDays} days of a payment? Email ${p.supportEmail} and you get a full refund. No questions.`],
    },
    {
      heading: "Failed payments",
      body: [
        `If a payment fails, your plan stays active for ${p.graceDays} days while we retry. After that the account falls back to Free. Your saved jobs are kept.`,
      ],
    },
  ],
};
