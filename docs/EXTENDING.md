# Extending the bot

## Adding a command (5 minutes)

Example: `/ping`, which replies "pong".

**1. Create `src/bot/commands/ping.ts`**
```ts
import type { Command } from "../command";

export const pingCommand: Command = {
  name: "ping",                 // a-z, 0-9, _ ; max 32 chars
  description: "Check the bot is alive",
  cooldownMs: 5_000,            // optional per-chat anti-spam
  async handle(ctx) {
    await ctx.reply("pong 🏓");
  },
};
```

**2. Register it** in `src/bot/commands/index.ts`:
```ts
export const commands = [jioCommand, helpCommand, startCommand, pingCommand];
```

**3. Test it** in `test/router.test.ts` (copy an existing `handleUpdate` test).

**4. Ship it**
```bash
npm run check && npm run deploy && npm run setup:webhook   # last step refreshes the "/" menu
```

### Rules for handlers
- Use `ctx.api` / `ctx.reply`. Never call `fetch` directly (keeps tests and token handling centralised).
- **Sanitise any user text** you echo: `sanitizeText(ctx.args, max)`; `escapeHtml()` if you reply with `{ html: true }`.
- Throwing is fine. The router logs it and sends a polite apology.
- Keep handlers fast. The free plan has a tight per-request CPU budget (network waits don't count).

---

## Planned features: blueprints

These are **not implemented yet**. They're designed so they slot in without restructuring.

### 1. Scheduled polls: `/schedule <when> <name>`

Needs storage and a timer.

- **Storage:** Cloudflare **D1** (SQLite). Add to `wrangler.toml`:
  ```toml
  [[d1_databases]]
  binding = "DB"
  database_name = "study-jio-bot"
  database_id = "<from `npx wrangler d1 create study-jio-bot`>"
  ```
  Table: `scheduled_polls(id, chat_id, thread_id, name, run_at, created_by, created_at)`.
- **Timer:** a Cron Trigger that runs every few minutes:
  ```toml
  [triggers]
  crons = ["*/5 * * * *"]
  ```
  and add a `scheduled` handler next to `fetch` in `src/index.ts`:
  ```ts
  async scheduled(_event, env, ctx) {
    // SELECT due rows → api.sendPoll(buildJioPoll(chatId, name, threadId)) → DELETE sent rows
  }
  ```
  `buildJioPoll` in `src/bot/commands/jio.ts` is already a pure, reusable function for this.
- **Security:** only let chat admins schedule (check with `getChatMember`), cap pending schedules per chat (e.g. 10), validate `<when>` strictly, and **delete rows once sent** (this is your data cleanup).

### 2. Recurring polls: `/recurring weekly mon 9:00 CLB`

Same as above with a `recurrence` column (store a simple rule, not raw cron strings from users). After sending, compute and store the next `run_at` instead of deleting. Add `/recurring list` and `/recurring stop <id>`. Store times in UTC; convert from the chat's timezone (default `Asia/Singapore`) at input.

### 3. Daily verse: `/verse` and an optional daily post

- Bundle a small verse list as a JSON module (no external API means no new attack surface or rate limits), or call a public API with a strict timeout and a fallback.
- For a daily post, reuse the Cron Trigger and store subscribed chats in D1 (`/verse on`, `/verse off`).
- Check the translation's licence before bundling text.

### Moving rate limits to hard guarantees

If abuse becomes a problem, replace `CooldownLimiter` in `src/security/rate-limit.ts` with a Durable Object-backed limiter. The `tryAcquire(key)` interface stays the same, so the router doesn't change.
