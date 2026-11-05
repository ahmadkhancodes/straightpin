import { json } from "@/lib/http";
import { outbox } from "@/lib/mail/transports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** E2E only: last console-transport messages. 404 unless E2E_OUTBOX=1 (never set on Vercel). */
export async function GET(req: Request) {
  if (process.env.E2E_OUTBOX !== "1") return json({ error: "not_found" }, 404);
  const to = new URL(req.url).searchParams.get("to");
  return json({ messages: outbox.filter((m) => !to || m.to === to).slice(-5).map((m) => ({ to: m.to, subject: m.subject, text: m.text })) });
}
