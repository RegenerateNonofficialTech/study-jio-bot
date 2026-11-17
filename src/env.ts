/**
 * Environment bindings and their validation.
 *
 * Secrets (set with `wrangler secret put`):
 *   TELEGRAM_BOT_TOKEN       – from @BotFather
 *   TELEGRAM_WEBHOOK_SECRET  – random string; Telegram echoes it back in a header
 *
 * Plain vars (wrangler.toml [vars]):
 *   BOT_USERNAME, ENFORCE_TELEGRAM_IP, ALLOWED_CHAT_IDS
 */

export interface Env {
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BOT_USERNAME?: string;
  ENFORCE_TELEGRAM_IP?: string;
  ALLOWED_CHAT_IDS?: string;
}

export interface AppConfig {
  botToken: string;
  webhookSecret: string;
  botUsername: string;
  enforceTelegramIp: boolean;
  /** null = all chats allowed */
  allowedChatIds: ReadonlySet<number> | null;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const BOT_TOKEN_RE = /^\d{5,}:[A-Za-z0-9_-]{30,}$/;
// Telegram allows 1-256 chars of A-Z a-z 0-9 _ -. We require at least 32 for strength.
const WEBHOOK_SECRET_RE = /^[A-Za-z0-9_-]{32,256}$/;
const USERNAME_RE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

/**
 * Validate configuration. Fails closed: if anything security-relevant is
 * missing or weak, the Worker refuses to process updates at all.
 */
export function loadConfig(env: Env): AppConfig {
  const botToken = env.TELEGRAM_BOT_TOKEN?.trim() ?? "";
  if (!BOT_TOKEN_RE.test(botToken)) {
    throw new ConfigError("TELEGRAM_BOT_TOKEN is missing or malformed");
  }

  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? "";
  if (!WEBHOOK_SECRET_RE.test(webhookSecret)) {
    throw new ConfigError(
      "TELEGRAM_WEBHOOK_SECRET must be 32-256 chars of A-Z, a-z, 0-9, _ or - (run `npm run secret:generate`)",
    );
  }

  const botUsername = (env.BOT_USERNAME ?? "").trim().replace(/^@/, "");
  if (!USERNAME_RE.test(botUsername)) {
    throw new ConfigError("BOT_USERNAME is missing or invalid (set it in wrangler.toml)");
  }

  // Secure default: enforce unless explicitly turned off.
  const enforceTelegramIp = (env.ENFORCE_TELEGRAM_IP ?? "true").trim().toLowerCase() !== "false";

  return {
    botToken,
    webhookSecret,
    botUsername,
    enforceTelegramIp,
    allowedChatIds: parseChatIds(env.ALLOWED_CHAT_IDS),
  };
}

export function parseChatIds(raw: string | undefined): ReadonlySet<number> | null {
  const parts = (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;

  const ids = new Set<number>();
  for (const part of parts) {
    if (!/^-?\d{1,20}$/.test(part)) {
      throw new ConfigError(`ALLOWED_CHAT_IDS contains an invalid id: "${part}"`);
    }
    ids.add(Number(part));
  }
  return ids;
}
