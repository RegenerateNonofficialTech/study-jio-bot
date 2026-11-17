import type { AppConfig } from "../env";
import { describeError, type Logger } from "../logger";
import { CooldownLimiter, RecentIds } from "../security/rate-limit";
import type { TelegramClient } from "../telegram/client";
import type { Message, Update } from "../telegram/types";
import type { Command, CommandContext } from "./command";

export interface ParsedCommand {
  name: string;
  args: string;
}

/**
 * Parse "/cmd", "/cmd args" or "/cmd@BotName args".
 * Uses Telegram's own bot_command entity rather than regex-guessing.
 * Returns null if it isn't a command, or it's addressed to a different bot.
 */
export function parseCommand(message: Message, botUsername: string): ParsedCommand | null {
  const text = message.text;
  if (!text) return null;

  const entity = message.entities?.find((e) => e.type === "bot_command" && e.offset === 0);
  if (!entity) return null;

  const raw = text.slice(1, entity.length); // drop leading "/"
  const at = raw.indexOf("@");
  const name = (at === -1 ? raw : raw.slice(0, at)).toLowerCase();
  const target = at === -1 ? null : raw.slice(at + 1);

  if (target !== null && target.toLowerCase() !== botUsername.toLowerCase()) return null;
  if (!/^[a-z0-9_]{1,32}$/.test(name)) return null;

  return { name, args: text.slice(entity.length).trim() };
}

export interface RouterDeps {
  api: TelegramClient;
  config: AppConfig;
  log: Logger;
  commands: readonly Command[];
}

/** Per-isolate state. Module-level so it survives across requests in one isolate. */
const recentUpdates = new RecentIds();
const limiters = new Map<string, CooldownLimiter>();

function limiterFor(command: Command): CooldownLimiter | null {
  if (!command.cooldownMs) return null;
  let l = limiters.get(command.name);
  if (!l) {
    l = new CooldownLimiter(command.cooldownMs);
    limiters.set(command.name, l);
  }
  return l;
}

/** Route one Telegram update. Never throws — errors are logged. */
export async function handleUpdate(update: Update, deps: RouterDeps): Promise<void> {
  const { api, config, log } = deps;

  if (recentUpdates.seen(update.update_id)) {
    log.debug("duplicate update ignored", { updateId: update.update_id });
    return;
  }

  const message = update.message;
  if (!message || !message.from || message.from.is_bot) return;

  if (config.allowedChatIds && !config.allowedChatIds.has(message.chat.id)) {
    log.warn("message from non-allowlisted chat ignored", { chatId: message.chat.id });
    return;
  }

  const parsed = parseCommand(message, config.botUsername);
  if (!parsed) return;

  const command = deps.commands.find((c) => c.name === parsed.name);
  if (!command) return; // unknown commands are ignored silently (don't be noisy in groups)

  const ctx: CommandContext = {
    message,
    args: parsed.args,
    api,
    config,
    log,
    commands: deps.commands,
    async reply(text, options) {
      await api.sendMessage({
        chat_id: message.chat.id,
        ...(message.is_topic_message && message.message_thread_id !== undefined
          ? { message_thread_id: message.message_thread_id }
          : {}),
        text,
        ...(options?.html ? { parse_mode: "HTML" as const } : {}),
        link_preview_options: { is_disabled: true },
        reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true },
      });
    },
  };

  const limiter = limiterFor(command);
  if (limiter && !limiter.tryAcquire(String(message.chat.id))) {
    log.info("command rate-limited", { command: command.name, chatId: message.chat.id });
    return; // stay silent: replying to spam would itself be spam
  }

  try {
    await command.handle(ctx);
  } catch (err) {
    log.error("command failed", { command: command.name, chatId: message.chat.id, ...describeError(err) });
    try {
      await ctx.reply("Sorry, something went wrong. Please try again in a moment.");
    } catch {
      /* already logged; nothing more to do */
    }
  }
}

/** Test helper: reset per-isolate state. */
export function __resetRouterState(): void {
  limiters.clear();
  // RecentIds has no clear(); replace by re-seeding is unnecessary for tests that use unique ids.
}
