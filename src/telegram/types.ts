/**
 * Minimal Telegram Bot API types — only the fields this bot uses.
 * Full reference: https://core.telegram.org/bots/api
 *
 * We deliberately keep our own small type set instead of pulling in a large
 * SDK: fewer dependencies = smaller supply-chain attack surface.
 */

export interface User {
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}

export type ChatType = "private" | "group" | "supergroup" | "channel";

export interface Chat {
  id: number;
  type: ChatType;
  title?: string;
}

export interface MessageEntity {
  type: string; // "bot_command", "mention", ...
  offset: number;
  length: number;
}

export interface Message {
  message_id: number;
  message_thread_id?: number;
  is_topic_message?: boolean;
  from?: User;
  chat: Chat;
  date: number;
  text?: string;
  entities?: MessageEntity[];
}

export interface Update {
  update_id: number;
  message?: Message;
  // Other update types exist but we subscribe only to "message"
  // (see allowed_updates in scripts/setup-webhook.ts).
}

export interface InputPollOption {
  text: string;
}

/** Parameters for sendPoll. See https://core.telegram.org/bots/api#sendpoll */
export interface SendPollParams {
  chat_id: number | string;
  message_thread_id?: number;
  question: string;
  options: InputPollOption[];
  /** Must be false for allow_adding_options to work. */
  is_anonymous?: boolean;
  type?: "regular" | "quiz";
  allows_multiple_answers?: boolean;
  /** Bot API 9.6+: let chat members add their own answer options. */
  allow_adding_options?: boolean;
  /** Bot API 9.6+: let voters change their vote. */
  allows_revoting?: boolean;
  disable_notification?: boolean;
}

export interface SendMessageParams {
  chat_id: number | string;
  message_thread_id?: number;
  text: string;
  parse_mode?: "HTML" | "MarkdownV2";
  link_preview_options?: { is_disabled?: boolean };
  reply_parameters?: { message_id: number; allow_sending_without_reply?: boolean };
}

export interface BotCommand {
  command: string;
  description: string;
}

export interface WebhookInfo {
  url: string;
  has_custom_certificate: boolean;
  pending_update_count: number;
  last_error_date?: number;
  last_error_message?: string;
  allowed_updates?: string[];
}
