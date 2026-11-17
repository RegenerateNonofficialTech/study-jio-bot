import { beforeEach, describe, expect, it, vi } from "vitest";
import { __resetRouterState } from "../src/bot/router";
import { handleRequest } from "../src/index";
import { commandMessage, env, fakeTelegram, updateFor, webhookRequest } from "./helpers";

beforeEach(() => {
  __resetRouterState();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("webhook security", () => {
  it("rejects requests without the secret token", async () => {
    const tg = fakeTelegram();
    const res = await handleRequest(webhookRequest(updateFor(commandMessage("/jio CLB")), { secret: "" }), env, tg);
    expect(res.status).toBe(401);
    expect(tg.calls).toHaveLength(0);
  });

  it("rejects requests with a wrong secret token", async () => {
    const tg = fakeTelegram();
    const res = await handleRequest(
      webhookRequest(updateFor(commandMessage("/jio CLB")), { secret: "x".repeat(48) }),
      env,
      tg,
    );
    expect(res.status).toBe(401);
    expect(tg.calls).toHaveLength(0);
  });

  it("rejects requests from non-Telegram IPs when enforcement is on", async () => {
    const tg = fakeTelegram();
    const res = await handleRequest(webhookRequest(updateFor(commandMessage("/jio CLB")), { ip: "8.8.8.8" }), env, tg);
    expect(res.status).toBe(403);
    expect(tg.calls).toHaveLength(0);
  });

  it("allows non-Telegram IPs only when enforcement is explicitly off", async () => {
    const tg = fakeTelegram();
    const res = await handleRequest(
      webhookRequest(updateFor(commandMessage("/jio CLB")), { ip: "8.8.8.8" }),
      { ...env, ENFORCE_TELEGRAM_IP: "false" },
      tg,
    );
    expect(res.status).toBe(200);
  });

  it("fails closed when secrets are missing or weak", async () => {
    const tg = fakeTelegram();
    const weak = await handleRequest(webhookRequest({}), { ...env, TELEGRAM_WEBHOOK_SECRET: "short" }, tg);
    expect(weak.status).toBe(500);
    const missing = await handleRequest(webhookRequest({}), { ...env, TELEGRAM_BOT_TOKEN: undefined }, tg);
    expect(missing.status).toBe(500);
    expect(tg.calls).toHaveLength(0);
  });

  it("rejects non-POST, unknown paths, bad JSON and oversized bodies", async () => {
    const tg = fakeTelegram();
    expect((await handleRequest(webhookRequest(null, { method: "GET" }), env, tg)).status).toBe(405);
    expect((await handleRequest(webhookRequest({}, { path: "/admin" }), env, tg)).status).toBe(404);
    expect((await handleRequest(webhookRequest("{not json"), env, tg)).status).toBe(400);
    expect((await handleRequest(webhookRequest({ hello: 1 }), env, tg)).status).toBe(400);
    expect((await handleRequest(webhookRequest("x".repeat(70_000)), env, tg)).status).toBe(413);
    expect(tg.calls).toHaveLength(0);
  });

  it("serves a health check", async () => {
    const res = await handleRequest(new Request("https://x.dev/healthz"), env);
    expect(res.status).toBe(200);
  });

  it("never logs the bot token", async () => {
    const tg = fakeTelegram();
    const spy = vi.spyOn(console, "error");
    // Make the API fail with a message that includes the token
    const failingFetch = vi.fn(async () => {
      throw new Error(`connect failed https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPoll`);
    }) as unknown as typeof fetch;
    await handleRequest(webhookRequest(updateFor(commandMessage("/jio CLB"))), env, { fetch: failingFetch });
    const logged = spy.mock.calls.flat().join(" ");
    expect(logged).not.toContain(env.TELEGRAM_BOT_TOKEN);
    expect(tg.calls).toHaveLength(0);
  });
});

describe("/jio end-to-end", () => {
  it("sends a poll with the jio name as the question", async () => {
    const tg = fakeTelegram();
    const res = await handleRequest(webhookRequest(updateFor(commandMessage("/jio CLB"))), env, tg);
    expect(res.status).toBe(200);
    expect(tg.calls).toHaveLength(1);
    const [call] = tg.calls;
    expect(call!.method).toBe("sendPoll");
    expect(call!.params.question).toBe("CLB");
    expect(call!.params.allow_adding_options).toBe(true);
    expect(call!.params.is_anonymous).toBe(false);
  });

  it("does not send duplicate polls when Telegram retries the same update", async () => {
    const tg = fakeTelegram();
    const update = updateFor(commandMessage("/jio Retry test", { chat: { id: -555, type: "group" } }));
    await handleRequest(webhookRequest(update), env, tg);
    await handleRequest(webhookRequest(update), env, tg);
    expect(tg.calls.filter((c) => c.method === "sendPoll")).toHaveLength(1);
  });
});
