import { escapeHtml } from "../../security/sanitize";
import type { Command } from "../command";

export const helpCommand: Command = {
  name: "help",
  description: "Show what I can do",

  async handle(ctx) {
    const lines = ctx.commands
      .filter((c) => !c.hidden)
      .map((c) => `${escapeHtml(c.usage ?? `/${c.name}`)} — ${escapeHtml(c.description)}`);

    await ctx.reply(
      [
        "<b>Study Jio Bot</b> 📚",
        "",
        ...lines,
        "",
        "Vote for the slots that work for you. Don't see a good time? Tap <i>Add option</i> on the poll to suggest one.",
      ].join("\n"),
      { html: true },
    );
  },
};

export const startCommand: Command = {
  name: "start",
  description: "Introduction",
  hidden: true,
  handle: (ctx) => helpCommand.handle(ctx),
};
