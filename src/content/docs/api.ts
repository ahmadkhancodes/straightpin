import { product as p } from "@/config/product";
import type { DocPage } from "./types";

export const api: DocPage = {
  slug: "api",
  title: "API reference",
  description: `The ${p.name} REST API: authentication, endpoints, errors and rate limits.`,
  sections: [
    {
      heading: "Base URL and authentication",
      body: [
        `All requests go to ${p.url}/api/v1 over HTTPS and need an x-api-key header. Bodies and responses are JSON.`,
      ],
    },
    {
      heading: "GET /api/v1/me",
      body: ["Returns the organization the API key belongs to. Use it to check that a key works."],
      code: {
        lang: "json",
        code: `{\n  "orgId": "org_123"\n}`,
      },
    },
    {
      heading: "Errors",
      body: [
        "Errors use a matching HTTP status and a JSON body with a stable snake case code. Match on the code, not on the status text.",
      ],
      code: {
        lang: "json",
        code: `{\n  "error": "invalid_api_key"\n}`,
      },
    },
    {
      heading: "Rate limits",
      body: [
        "Each API key can make 600 requests per minute. Beyond that you get a 429 status with the error code rate_limited. Wait for the next minute and retry with exponential backoff.",
      ],
    },
    {
      heading: "Account export and deletion",
      body: [
        "GET /api/account/export returns a JSON copy of your account data. DELETE /api/account permanently deletes your account and organization. Both require a signed in session and are also available in Settings, then Account.",
      ],
    },
  ],
};
