import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig, parseChatIds } from "../src/env";
import { redact } from "../src/logger";
import { CooldownLimiter, RecentIds } from "../src/security/rate-limit";
import { escapeHtml, sanitizeText } from "../src/security/sanitize";
import { ipv4ToInt, isTelegramIp, timingSafeEqual } from "../src/security/webhook-auth";
import { env, TOKEN } from "./helpers";

describe("timingSafeEqual", () => {
  it("compares correctly", async () => {
    expect(await timingSafeEqual("abc", "abc")).toBe(true);
    expect(await timingSafeEqual("abc", "abd")).toBe(false);
    expect(await timingSafeEqual("abc", "abcd")).toBe(false);
    expect(await timingSafeEqual("", "a")).toBe(false);
  });
});

describe("Telegram IP check", () => {
  it("accepts Telegram ranges", () => {
    expect(isTelegramIp("149.154.160.1")).toBe(true);
    expect(isTelegramIp("149.154.175.254")).toBe(true);
    expect(isTelegramIp("91.108.4.10")).toBe(true);
    expect(isTelegramIp("91.108.7.255")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isTelegramIp("149.154.176.0")).toBe(false);
    expect(isTelegramIp("91.108.8.0")).toBe(false);
    expect(isTelegramIp("8.8.8.8")).toBe(false);
    expect(isTelegramIp("::1")).toBe(false);
    expect(isTelegramIp("149.154.160.1.5")).toBe(false);
    expect(isTelegramIp("149.154.160.999")).toBe(false);
    expect(isTelegramIp(null)).toBe(false);
  });

  it("parses IPv4", () => {
    expect(ipv4ToInt("0.0.0.0")).toBe(0);
    expect(ipv4ToInt("255.255.255.255")).toBe(4294967295);
    expect(ipv4ToInt("1.2.3")).toBeNull();
  });
});

describe("config validation", () => {
  it("loads a valid config with secure defaults", () => {
    const c = loadConfig({ ...env, ENFORCE_TELEGRAM_IP: undefined });
    expect(c.enforceTelegramIp).toBe(true);
    expect(c.allowedChatIds).toBeNull();
  });

  it("rejects malformed values", () => {
    expect(() => loadConfig({ ...env, TELEGRAM_BOT_TOKEN: "nope" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...env, TELEGRAM_WEBHOOK_SECRET: "has spaces in it which are not allowed!!" })).toThrow(ConfigError);
    expect(() => loadConfig({ ...env, BOT_USERNAME: "" })).toThrow(ConfigError);
    expect(() => parseChatIds("123,abc")).toThrow(ConfigError);
  });

  it("parses chat id allowlists", () => {
    expect([...(parseChatIds(" -1001, 42 ") ?? [])]).toEqual([-1001, 42]);
    expect(parseChatIds("")).toBeNull();
  });
});

describe("sanitize", () => {
  it("strips control/bidi chars and collapses whitespace", () => {
    expect(sanitizeText(" a\u0000b‮c \n\t d ", 100)).toBe("a b c d");
  });
  it("truncates by code point without splitting emoji", () => {
    expect(sanitizeText("📚📚📚", 2)).toBe("📚📚");
  });
  it("escapes HTML", () => {
    expect(escapeHtml("<b>&</b>")).toBe("&lt;b&gt;&amp;&lt;/b&gt;");
  });
});

describe("redact", () => {
  it("removes bot tokens and explicit secrets", () => {
    expect(redact(`url /bot${TOKEN}/x`)).not.toContain(TOKEN);
    expect(redact("my-super-secret-value here", ["my-super-secret-value"])).toBe("[REDACTED] here");
  });
});

describe("rate limiting", () => {
  it("enforces a cooldown per key", () => {
    let t = 0;
    const l = new CooldownLimiter(1000, 100, () => t);
    expect(l.tryAcquire("a")).toBe(true);
    expect(l.tryAcquire("a")).toBe(false);
    expect(l.tryAcquire("b")).toBe(true);
    t = 1000;
    expect(l.tryAcquire("a")).toBe(true);
  });

  it("bounds memory", () => {
    const l = new CooldownLimiter(1000, 2, () => 0);
    l.tryAcquire("a");
    l.tryAcquire("b");
    l.tryAcquire("c"); // evicts "a"
    expect(l.tryAcquire("a")).toBe(true);
  });

  it("detects duplicate update ids", () => {
    const r = new RecentIds(2);
    expect(r.seen(1)).toBe(false);
    expect(r.seen(1)).toBe(true);
    r.seen(2);
    r.seen(3); // evicts 1
    expect(r.seen(1)).toBe(false);
  });
});
