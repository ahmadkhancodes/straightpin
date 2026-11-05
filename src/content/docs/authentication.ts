import { product as p } from "@/config/product";
import type { DocPage } from "./types";

export const authentication: DocPage = {
  slug: "authentication",
  title: "Authentication",
  description: `Sign in to ${p.name} with magic links, passkeys and two factor, and call the API with keys.`,
  sections: [
    {
      heading: "Magic link",
      body: [
        "Enter your email on the sign in page and we send a one time link. The link expires after a short time and works once. Open it on the same device where you asked for it for the smoothest experience.",
      ],
    },
    {
      heading: "Passkeys",
      body: [
        "Add a passkey in Settings, then Security. After that you can sign in with your fingerprint, face or device PIN. Passkeys are bound to this site, so they cannot be phished. We recommend adding at least two.",
      ],
    },
    {
      heading: "Two factor authentication",
      body: [
        "Turn on two factor in Settings, then Security. Scan the QR code with an authenticator app and enter the six digit code to confirm. Save your recovery codes somewhere safe. Each works once if you lose your device.",
      ],
    },
    {
      heading: "API keys",
      body: [
        "Server to server requests use API keys. Create and revoke them in Settings, then API keys. Send the key in the x-api-key header on every request. Never put a key in browser code or a public repository. If a key leaks, revoke it and create a new one.",
      ],
      code: {
        lang: "bash",
        code: `curl ${p.url}/api/v1/me \\\n  -H "x-api-key: YOUR_API_KEY"`,
      },
    },
  ],
};
