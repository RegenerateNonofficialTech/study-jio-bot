import { DEFAULT_JIO_OPTIONS, JIO_COOLDOWN_MS, JIO_POLL_SETTINGS } from "../../config";
import { MAX_POLL_QUESTION_LENGTH, sanitizeText } from "../../security/sanitize";
import type { SendPollParams } from "../../telegram/types";
import type { Command } from "../command";

/** Build the sendPoll request for a jio. Pure function → easy to test and reuse
 *  (e.g. by a future scheduled/recurring-poll feature). */
export function buildJioPoll(
  chatId: number,
  jioName: string,
  messageThreadId?: number,
): SendPollParams {
  return {
    chat_id: chatId,
    ...(messageThreadId !== undefined ? { message_thread_id: messageThreadId } : {}),
    question: jioName,
    options: DEFAULT_JIO_OPTIONS.map((text) => ({ text })),
    type: "regular",
    is_anonymous: JIO_POLL_SETTINGS.isAnonymous,
    allows_multiple_answers: JIO_POLL_SETTINGS.allowsMultipleAnswers,
    allow_adding_options: JIO_POLL_SETTINGS.allowAddingOptions,
    allows_revoting: JIO_POLL_SETTINGS.allowsRevoting,
  };
}

export const jioCommand: Command = {
  name: "jio",
  description: "Start a study poll, e.g. /jio CLB",
  usage: "/jio <name of the jio>",
  cooldownMs: JIO_COOLDOWN_MS,

  async handle(ctx) {
    const name = sanitizeText(ctx.args, MAX_POLL_QUESTION_LENGTH);
    if (!name) {
      await ctx.reply("Tell me what the jio is called 🙂\nExample: /jio CLB");
      return;
    }

    const threadId = ctx.message.is_topic_message ? ctx.message.message_thread_id : undefined;
    await ctx.api.sendPoll(buildJioPoll(ctx.message.chat.id, name, threadId));
    ctx.log.info("jio poll sent", { chatId: ctx.message.chat.id });
  },
};
