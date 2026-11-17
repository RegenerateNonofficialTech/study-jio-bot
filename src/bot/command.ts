import type { AppConfig } from "../env";
import type { Logger } from "../logger";
import type { TelegramClient } from "../telegram/client";
import type { Message } from "../telegram/types";

/**
 * Everything a command handler needs. Handlers get dependencies through this
 * object (never globals), which keeps them easy to unit-test with fakes.
 */
export interface CommandContext {
  /** The message that triggered the command. */
  message: Message;
  /** Text after the command, trimmed. "/jio CLB tonight" → "CLB tonight". */
  args: string;
  api: TelegramClient;
  config: AppConfig;
  log: Logger;
  /** All registered commands (used by /help). */
  commands: readonly Command[];
  /** Reply in the same chat (and same forum topic, if any). */
  reply(text: string, options?: { html?: boolean }): Promise<void>;
}

export interface Command {
  /** Lowercase, without the slash. Telegram allows a-z, 0-9, _ (max 32). */
  name: string;
  /** Shown in Telegram's command menu and in /help. */
  description: string;
  /** Usage line for /help, e.g. "/jio <name>". */
  usage?: string;
  /** Hide from the Telegram "/" menu (still works if typed). */
  hidden?: boolean;
  /** Optional per-chat cooldown in ms (anti-spam). */
  cooldownMs?: number;
  handle(ctx: CommandContext): Promise<void>;
}
