/**
 * Cloudflare Worker entry point.
 *
 * Routes:
 *   POST /telegram/webhook  – Telegram updates (authenticated)
 *   GET  /healthz           – liveness check, reveals nothing
 *   everything else         – 404
 */

import { commands } from "./bot/commands";
import { handleUpdate } from "./bot/router";
import { MAX_BODY_BYTES } from "./config";
import { ConfigError, loadConfig, type AppConfig, type Env } from "./env";
import { createLogger, describeError } from "./logger";
import { clientIp, hasValidSecret, isTelegramIp } from "./security/webhook-auth";
import { TelegramClient } from "./telegram/client";
import type { Update } from "./telegram/types";

export const WEBHOOK_PATH = "/telegram/webhook";

const SECURITY_HEADERS: Record<string, string> = {
  "content-type": "text/plain; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
};

function respond(status: number, body = ""): Response {
  return new Response(body, { status, headers: SECURITY_HEADERS });
}

export interface HandlerDeps {
  /** Override fetch used for Telegram API calls (tests). */
  fetch?: typeof fetch;
}

export async function handleRequest(request: Request, env: Env, deps: HandlerDeps = {}): Promise<Response> {
  const url = new URL(request.url);

  if (url.pathname === "/healthz" && request.method === "GET") return respond(200, "ok");
  if (url.pathname !== WEBHOOK_PATH) return respond(404, "not found");
  if (request.method !== "POST") return respond(405, "method not allowed");

  let config: AppConfig;
  try {
    config = loadConfig(env);
  } catch (err) {
    // Fail closed. Don't tell the caller what's wrong; log it for the operator.
    createLogger().error("invalid configuration", {
      detail: err instanceof ConfigError ? err.message : "unknown",
    });
    return respond(500, "server misconfigured");
  }

  const log = createLogger([config.botToken, config.webhookSecret]);

  // --- Authentication -------------------------------------------------------
  if (config.enforceTelegramIp && !isTelegramIp(clientIp(request))) {
    log.warn("rejected: source IP not in Telegram ranges", { ip: clientIp(request) });
    return respond(403, "forbidden");
  }
  if (!(await hasValidSecret(request, config.webhookSecret))) {
    log.warn("rejected: bad or missing secret token", { ip: clientIp(request) });
    return respond(401, "unauthorized");
  }

  // --- Body validation ------------------------------------------------------
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return respond(415, "unsupported media type");
  }
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) return respond(413, "payload too large");

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return respond(413, "payload too large");

  let update: Update;
  try {
    update = JSON.parse(raw) as Update;
  } catch {
    return respond(400, "bad request");
  }
  if (typeof update !== "object" || update === null || typeof update.update_id !== "number") {
    return respond(400, "bad request");
  }

  // --- Handle ---------------------------------------------------------------
  const api = new TelegramClient(config.botToken, deps.fetch ? { fetch: deps.fetch } : {});
  try {
    await handleUpdate(update, { api, config, log, commands });
  } catch (err) {
    log.error("unhandled error", describeError(err));
  }

  // Always 200 once authenticated, so Telegram doesn't retry a failing update forever.
  return respond(200, "ok");
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
} satisfies ExportedHandler<Env>;
