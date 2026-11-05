import { product as p } from "@/config/product";
import type { LegalDoc } from "./types";

export const refunds: LegalDoc = {
  slug: "refunds",
  title: "Refund policy",
  description: `${p.refundDays} day full refund, once per customer, and how to cancel in two taps.`,
  sections: [
    {
      id: "refund",
      title: `${p.refundDays} day refund`,
      body: [
        `If you change your mind within ${p.refundDays} days of a payment, tap Refund my last charge in Account, or email ${p.supportEmail}, and we refund that payment in full. No questions. This covers Weekly, Monthly and Lifetime.`,
        "Each customer can get this refund once. A refund ends the paid plan straight away and moves you to Free.",
        "Refunds go back to the card you paid with. Your bank may take a few days to show it.",
      ],
    },
    {
      id: "cancel",
      title: "Cancel in two taps",
      body: [
        "Open Account and tap Cancel plan, then confirm. Your plan stays active until the end of the period you paid for, then you are moved to Free. We email a reminder with the date and amount before each renewal.",
      ],
    },
    {
      id: "prices",
      title: "Prices",
      body: ["The price you see before you sign up is the price you pay. We do not show crossed out prices or countdowns."],
    },
    {
      id: "law",
      title: "Your legal rights",
      body: ["This policy adds to, and does not replace, any refund or cancellation right you have under the law where you live."],
    },
  ],
};
