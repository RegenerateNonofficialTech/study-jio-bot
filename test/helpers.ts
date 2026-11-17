import { vi } from "vitest";
import type { Env } from "../src/env";
import type { Message, Update } from "../src/telegram/types";

export const TOKEN = "123456789:AAH_test-token-abcdefghijklmnopqrstuvwxyz";
export const SECRET = "test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
export const BOT = "StudyJioBot";
export const TELEGRAM_IP = "149.154.167.220";

export const env: Env = {
  TELEGRAM_BOT_TOKEN: TOKEN,
  TELEGRAM_WEBHOOK_SECRET: SECRET,
  BOT_USERNAME: BOT,
  ENFORCE_TELEGRAM_IP: "true",
  ALLOWED_CHAT_IDS: "",
};

let nextUpdateId = 1000;

export function commandMessage(text: string, overrides: Partial<Message> = {}): Message {
  const cmdLen = text.split(/\s/)[0]!.length;
  return {
    message_id: 42,
    from: { id: 7, is_bot: false, first_name: "Ty" },
    chat: { id: -100123, type: "supergroup", title: "Study gang" },
    date: 1_700_000_000,
    text,
    entities: text.startsWith("/") ? [{ type: "bot_command", offset: 0, length: cmdLen }] : [],
    ...overrides,
  };
}

export function updateFor(message: Message): Update {
  return { update_id: nextUpdateId++, message };
}

export function webhookRequest(
  body: unknown,
  { secret = SECRET, ip = TELEGRAM_IP, method = "POST", path = "/telegram/webhook" } = {},
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers["X-Telegram-Bot-Api-Secret-Token"] = secret;
  if (ip) headers["CF-Connecting-IP"] = ip;
  return new Request(`https://bot.example.workers.dev${path}`, {
    method,
    headers,
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  });
}

/** A fake Telegram API that records calls and returns ok. */
export function fakeTelegram() {
  const calls: { method: string; params: Record<string, unknown> }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = url.split("/").pop()!;
    calls.push({ method, params: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1, chat: { id: 1, type: "group" }, date: 0 } }), {
      headers: { "content-type": "application/json" },
    });
  });
  return { calls, fetch: fetchMock as unknown as typeof fetch };
}
