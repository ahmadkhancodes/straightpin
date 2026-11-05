import { product as p } from "@/config/product";
import type { DocPage } from "./types";

export const webhooks: DocPage = {
  slug: "webhooks",
  title: "Webhooks",
  description: `Receive signed events from ${p.name} at your own endpoint and verify them.`,
  sections: [
    {
      heading: "Overview",
      body: [
        "Add an endpoint URL in Settings, then Webhooks. We send an HTTP POST with a JSON body each time a subscribed event happens. Each endpoint has its own signing secret, shown once when you create it.",
      ],
    },
    {
      heading: "Headers",
      body: [
        "Every delivery carries three headers. x-webhook-id is a unique ID for the event, so you can deduplicate. x-webhook-event is the event name. x-webhook-signature proves the request came from us.",
        "The signature has the form t=<unix>,v1=<hex>, where t is the Unix time we signed and v1 is the hex encoded HMAC SHA256 of the string t, a dot, then the raw request body, using the endpoint secret as the key.",
      ],
    },
    {
      heading: "Verify a signature in Node",
      body: [
        "Use the raw body, not a re-serialized one. Compare in constant time and reject old timestamps to stop replays.",
      ],
      code: {
        lang: "js",
        code: `import crypto from "node:crypto";

export function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSeconds) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(t + "." + rawBody)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}`,
      },
    },
    {
      heading: "Responding",
      body: [
        "Return any 2xx status within 10 seconds to acknowledge. Do slow work after you respond. Any other status, or a timeout, counts as a failure.",
      ],
    },
    {
      heading: "Retries",
      body: [
        "Failed deliveries are retried with backoff at 30 seconds, 2 minutes, 10 minutes, 30 minutes, 1 hour, 3 hours, 6 hours and 12 hours. That is up to 8 attempts. After the last attempt the delivery is marked failed, and you can replay it from the dashboard.",
      ],
    },
  ],
};
