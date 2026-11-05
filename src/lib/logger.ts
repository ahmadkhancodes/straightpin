// Structured JSON logs. Never log emails, tokens, codes or bodies (BACKEND_REUSE 1.11).
type Level = "debug" | "info" | "warn" | "error";
type Fields = { code?: string; route?: string; userId?: string; orgId?: string; [k: string]: unknown };

const SECRETISH = /(token|secret|password|authorization|cookie|email|code)$/i;

export function scrub(fields: Fields): Fields {
  const out: Fields = {};
  for (const [k, v] of Object.entries(fields)) out[k] = SECRETISH.test(k) && k !== "code" ? "[redacted]" : v;
  return out;
}

function emit(level: Level, msg: string, fields: Fields = {}) {
  if (process.env.NODE_ENV === "test" && level === "debug") return;
  const line = JSON.stringify({ level, msg, at: new Date().toISOString(), ...scrub(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (m: string, f?: Fields) => emit("debug", m, f),
  info: (m: string, f?: Fields) => emit("info", m, f),
  warn: (m: string, f?: Fields) => emit("warn", m, f),
  error: (m: string, f?: Fields) => emit("error", m, f),
};
