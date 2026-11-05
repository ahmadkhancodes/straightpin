import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = async (req: Request) => (await getAuth()).handler(req);
export const { GET, POST, PATCH, PUT, DELETE } = toNextJsHandler(handler);
