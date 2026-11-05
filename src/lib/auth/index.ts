import { betterAuth, type BetterAuthOptions } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { magicLink, organization, twoFactor } from "better-auth/plugins";
import { memoryAdapter } from "better-auth/adapters/memory";
import { passkey } from "@better-auth/passkey";
import { apiKey } from "@better-auth/api-key";
import { product } from "@/config/product";
import { appName, appUrl, dbDriver, env, isProd } from "@/lib/env";
import { sendMail } from "@/lib/mail";
import { inviteEmail, magicLinkEmail } from "@/lib/mail/templates";
import { isDisposableEmail } from "@/lib/security/disposable";
import { ac, roles } from "./roles";

// Better Auth: magic link, passkeys, TOTP, orgs + roles, API keys (hashed, prefix shown).
// Sessions live in httpOnly `__Host-` cookies in production (see cookieConfig), SameSite=Lax, Path=/.

const COOKIE_NAMES = ["session_token", "session_data", "account_data", "dont_remember", "two_factor"] as const;

/** `__Host-` needs Secure + Path=/ + no Domain. Better Auth only auto-prefixes `__Secure-`, so we name them ourselves. */
function cookieConfig(secure: boolean): NonNullable<BetterAuthOptions["advanced"]> {
  const app = appName();
  if (!secure) return { cookiePrefix: app, useSecureCookies: false };
  return {
    useSecureCookies: false,
    cookiePrefix: app,
    defaultCookieAttributes: { secure: true, httpOnly: true, sameSite: "lax", path: "/" },
    cookies: Object.fromEntries(
      COOKIE_NAMES.map((n) => [n, { name: `__Host-${app}.${n}`, attributes: { secure: true, path: "/" } }]),
    ),
  };
}

declare global {
  var __kitAuthMemory: Record<string, unknown[]> | undefined;
  var __kitAuth: ReturnType<typeof createAuth> | undefined;
}

async function database(): Promise<BetterAuthOptions["database"]> {
  const e = env();
  if (dbDriver(e) === "memory") {
    globalThis.__kitAuthMemory ??= {
      user: [], session: [], account: [], verification: [], organization: [], member: [], invitation: [],
      twoFactor: [], passkey: [], apikey: [], rateLimit: [],
    };
    return memoryAdapter(globalThis.__kitAuthMemory as never);
  }
  const { mongodbAdapter } = await import("better-auth/adapters/mongodb");
  const { mongoClient } = await import("@/lib/db/mongo");
  const client = await mongoClient(e.MONGODB_URI!);
  return mongodbAdapter(client.db(e.MONGODB_DB ?? appName(e)), { client, transaction: false });
}

export function createAuth(db: BetterAuthOptions["database"]) {
  const e = env();
  const base = appUrl(e);
  const secure = base.startsWith("https://");
  return betterAuth({
    appName: product.name,
    baseURL: base,
    secret: e.BETTER_AUTH_SECRET ?? (isProd() ? undefined : "dev-only-secret-dev-only-secret-0000"),
    database: db,
    trustedOrigins: [base, ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []), ...(process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : [])],
    advanced: cookieConfig(secure),
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 300 },
    },
    rateLimit: { enabled: true, window: 60, max: 60, storage: "database" },
    emailAndPassword: { enabled: false },
    socialProviders:
      e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
        ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
        : undefined,
    user: {
      deleteUser: { enabled: true },
      additionalFields: { analyticsConsent: { type: "boolean", required: false, defaultValue: false, input: true } },
    },
    account: { accountLinking: { enabled: true, trustedProviders: ["google"] } },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (isDisposableEmail(user.email)) return false;
            return { data: { ...user, email: user.email.toLowerCase() } };
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 600,
        disableSignUp: false,
        sendMagicLink: async ({ email, url }) => {
          const m = magicLinkEmail(url);
          await sendMail({ to: email, ...m, category: "transactional" });
        },
      }),
      twoFactor({ issuer: product.name, skipVerificationOnEnable: false }),
      passkey({ rpName: product.fullName, rpID: new URL(base).hostname, origin: base }),
      organization({
        ac,
        roles,
        creatorRole: "owner",
        allowUserToCreateOrganization: true,
        invitationExpiresIn: 60 * 60 * 24 * 7,
        sendInvitationEmail: async (data) => {
          const url = `${base}/accept-invite/${data.id}`;
          const m = inviteEmail({ orgName: data.organization.name, inviter: data.inviter.user.name || data.inviter.user.email, url, role: data.role });
          await sendMail({ to: data.email, ...m, category: "transactional" });
        },
      }),
      apiKey({
        references: "organization",
        defaultPrefix: `${product.slug.slice(0, 4)}_`,
        enableMetadata: true,
        requireName: true,
        rateLimit: { enabled: true, timeWindow: 60_000, maxRequests: 600 },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let pending: Promise<Auth> | null = null;
export function getAuth(): Promise<Auth> {
  if (globalThis.__kitAuth) return Promise.resolve(globalThis.__kitAuth);
  return (pending ??= database().then((db) => (globalThis.__kitAuth = createAuth(db))));
}
