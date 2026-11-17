/**
 * Structured JSON logger with secret redaction.
 *
 * Logs show up in the Cloudflare dashboard (Workers → your worker → Logs) and
 * in `npx wrangler tail`. Anything that looks like a bot token is scrubbed
 * before it is written, in case one ever ends up in an error message.
 */

const TOKEN_PATTERN = /\d{5,}:[A-Za-z0-9_-]{30,}/g;

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

export function redact(value: string, extraSecrets: string[] = []): string {
  let out = value.replace(TOKEN_PATTERN, "[REDACTED_TOKEN]");
  for (const secret of extraSecrets) {
    if (secret.length >= 8) out = out.split(secret).join("[REDACTED]");
  }
  return out;
}

export function createLogger(secrets: string[] = []): Logger {
  const write = (level: LogLevel, msg: string, fields: LogFields = {}) => {
    const line = redact(JSON.stringify({ level, msg, ...fields }), secrets);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, f) => write("debug", m, f),
    info: (m, f) => write("info", m, f),
    warn: (m, f) => write("warn", m, f),
    error: (m, f) => write("error", m, f),
  };
}

/** Turn an unknown thrown value into something safe to log. */
export function describeError(err: unknown): LogFields {
  if (err instanceof Error) return { error: err.name, detail: err.message };
  return { error: "NonError", detail: String(err) };
}
