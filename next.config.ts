import type { NextConfig } from "next";
import { securityHeaders } from "./src/lib/security/headers";

// Cache Components is off on purpose (docs/DECISIONS.md D-K3): the kit uses classic dynamic rendering
// so auth/session reads (cookies()) need no Suspense boundaries. A product can switch it on later.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  serverExternalPackages: ["mongodb"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/favicon.ico", destination: "/icon", permanent: true }];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders() }];
  },
};

export default nextConfig;
