/**
 * One-time (and after-each-command-change) setup, run from YOUR machine:
 *
 *   npm run setup:webhook      → registers the webhook + the "/" command menu
 *   npm run webhook:info       → shows Telegram's view of the webhook
 *
 * Reads TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, WEBHOOK_URL from the
 * environment or from a local .env file (git-ignored).
 *
 * Why a script and not an HTTP "/setup" endpoint on the Worker?
 * An admin endpoint on the public internet is one more thing to attack.
 */

import { existsSync, readFileSync } from "node:fs";
import { commands } from "../src/bot/commands";
import { TelegramClient } from "../src/telegram/client";

function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trimStart().startsWith("#") && process.env[m[1]!] === undefined) {
      process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
    }
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing ${name}. Set it in your shell or in .env (see .env.example).`);
    process.exit(1);
  }
  return v;
}

async function main(): Promise<void> {
  loadDotEnv();
  const api = new TelegramClient(required("TELEGRAM_BOT_TOKEN"));

  if (process.argv.includes("--info")) {
    const info = await api.getWebhookInfo();
    console.log(JSON.stringify(info, null, 2));
    return;
  }

  const url = required("WEBHOOK_URL");
  const secret = required("TELEGRAM_WEBHOOK_SECRET");
  if (!url.startsWith("https://")) throw new Error("WEBHOOK_URL must be https://");
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) {
    throw new Error("TELEGRAM_WEBHOOK_SECRET must be 32-256 chars of A-Z a-z 0-9 _ - (npm run secret:generate)");
  }

  await api.setWebhook({
    url,
    secret_token: secret,
    allowed_updates: ["message"], // least privilege: we only need messages
    drop_pending_updates: true,
    max_connections: 10,
  });
  console.log(`✓ Webhook set → ${url}`);

  await api.setMyCommands(
    commands.filter((c) => !c.hidden).map((c) => ({ command: c.name, description: c.description })),
  );
  console.log(`✓ Command menu updated (${commands.filter((c) => !c.hidden).map((c) => "/" + c.name).join(", ")})`);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
