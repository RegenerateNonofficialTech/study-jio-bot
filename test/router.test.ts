import { beforeEach, describe, expect, it, vi } from "vitest";
import { commands } from "../src/bot/commands";
import { buildJioPoll } from "../src/bot/commands/jio";
import { __resetRouterState, handleUpdate, parseCommand } from "../src/bot/router";
import { DEFAULT_JIO_OPTIONS } from "../src/config";
import { loadConfig } from "../src/env";
import { createLogger } from "../src/logger";
import { TelegramClient } from "../src/telegram/client";
import { BOT, commandMessage, env, fakeTelegram, updateFor } from "./helpers";

beforeEach(() => {
  __resetRouterState();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function deps(fetchImpl: typeof fetch, envOverrides = {}) {
  const config = loadConfig({ ...env, ...envOverrides });
  return {
    api: new TelegramClient(config.botToken, { fetch: fetchImpl }),
    config,
    log: createLogger(),
    commands,
  };
}

describe("parseCommand", () => {
  it("parses a command with arguments", () => {
    expect(parseCommand(commandMessage("/jio CLB"), BOT)).toEqual({ name: "jio", args: "CLB" });
  });

  it("accepts /cmd@ThisBot and ignores /cmd@OtherBot", () => {
    expect(parseCommand(commandMessage(`/jio@${BOT} CLB`), BOT)).toEqual({ name: "jio", args: "CLB" });
    expect(parseCommand(commandMessage(`/jio@${BOT.toLowerCase()} CLB`), BOT)?.name).toBe("jio");
    expect(parseCommand(commandMessage("/jio@OtherBot CLB"), BOT)).toBeNull();
  });

  it("is case-insensitive on the command name", () => {
    expect(parseCommand(commandMessage("/JIO CLB"), BOT)?.name).toBe("jio");
  });

  it("ignores plain text and commands not at the start", () => {
    expect(parseCommand(commandMessage("hello"), BOT)).toBeNull();
    expect(
      parseCommand(
        { ...commandMessage("hey /jio"), entities: [{ type: "bot_command", offset: 4, length: 4 }] },
        BOT,
      ),
    ).toBeNull();
  });
});

describe("buildJioPoll", () => {
  it("uses the fixed options and enables user-added options", () => {
    const poll = buildJioPoll(-1, "CLB");
    expect(poll.question).toBe("CLB");
    expect(poll.options.map((o) => o.text)).toEqual([...DEFAULT_JIO_OPTIONS]);
    expect(poll.allow_adding_options).toBe(true);
    expect(poll.is_anonymous).toBe(false); // required by Telegram for adding options
    expect(poll.allows_multiple_answers).toBe(true);
  });

  it("posts into the same forum topic when given a thread id", () => {
    expect(buildJioPoll(-1, "CLB", 99).message_thread_id).toBe(99);
    expect(buildJioPoll(-1, "CLB")).not.toHaveProperty("message_thread_id");
  });
});

describe("handleUpdate", () => {
  it("replies with usage when /jio has no name", async () => {
    const tg = fakeTelegram();
    await handleUpdate(updateFor(commandMessage("/jio")), deps(tg.fetch));
    expect(tg.calls).toHaveLength(1);
    expect(tg.calls[0]!.method).toBe("sendMessage");
    expect(String(tg.calls[0]!.params.text)).toContain("/jio CLB");
  });

  it("sanitises the jio name (control chars, whitespace, length)", async () => {
    const tg = fakeTelegram();
    const nasty = "  CLB‮\u0000 \n\n level   5 " + "x".repeat(400);
    await handleUpdate(updateFor(commandMessage(`/jio ${nasty}`)), deps(tg.fetch));
    const q = String(tg.calls[0]!.params.question);
    expect(q.startsWith("CLB level 5 x")).toBe(true);
    expect(q).not.toMatch(/[\u0000‮\n]/);
    expect(Array.from(q).length).toBeLessThanOrEqual(300);
  });

  it("rate-limits repeated /jio in the same chat", async () => {
    const tg = fakeTelegram();
    const d = deps(tg.fetch);
    await handleUpdate(updateFor(commandMessage("/jio A")), d);
    await handleUpdate(updateFor(commandMessage("/jio B")), d);
    expect(tg.calls.filter((c) => c.method === "sendPoll")).toHaveLength(1);
  });

  it("ignores messages from bots", async () => {
    const tg = fakeTelegram();
    await handleUpdate(
      updateFor(commandMessage("/jio CLB", { from: { id: 9, is_bot: true, first_name: "Bot" } })),
      deps(tg.fetch),
    );
    expect(tg.calls).toHaveLength(0);
  });

  it("respects the chat allowlist", async () => {
    const tg = fakeTelegram();
    const d = deps(tg.fetch, { ALLOWED_CHAT_IDS: "-999" });
    await handleUpdate(updateFor(commandMessage("/jio CLB")), d); // chat -100123 not allowed
    expect(tg.calls).toHaveLength(0);
    await handleUpdate(updateFor(commandMessage("/jio CLB", { chat: { id: -999, type: "group" } })), d);
    expect(tg.calls).toHaveLength(1);
  });

  it("ignores unknown commands silently", async () => {
    const tg = fakeTelegram();
    await handleUpdate(updateFor(commandMessage("/whatever")), deps(tg.fetch));
    expect(tg.calls).toHaveLength(0);
  });

  it("/help lists visible commands and escapes HTML", async () => {
    const tg = fakeTelegram();
    await handleUpdate(updateFor(commandMessage("/help")), deps(tg.fetch));
    const text = String(tg.calls[0]!.params.text);
    expect(text).toContain("/jio &lt;name of the jio&gt;");
    expect(tg.calls[0]!.params.parse_mode).toBe("HTML");
  });

  it("tells the user when something fails instead of crashing", async () => {
    let n = 0;
    const flaky = vi.fn(async () => {
      n++;
      if (n === 1) return new Response(JSON.stringify({ ok: false, error_code: 400, description: "Bad Request" }));
      return new Response(JSON.stringify({ ok: true, result: {} }));
    }) as unknown as typeof fetch;
    await expect(handleUpdate(updateFor(commandMessage("/jio CLB")), deps(flaky))).resolves.toBeUndefined();
    expect(n).toBe(2); // failed sendPoll + apology sendMessage
  });
});
