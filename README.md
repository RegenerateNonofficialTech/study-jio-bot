# 📚 Study Jio Bot

A Telegram bot that sends **study "jio" polls** to your group. Members vote for the time slots that work for them, and if none fit, they can **add their own option** right in the poll.

```
/jio CLB
```

→ posts a poll titled **CLB** with:

| Fixed options |
|---|
| Morning |
| Lunch at 12pm (or suggest) |
| Afternoon |
| Dinner |
| *+ Add option* (anyone in the chat can add a slot) |

- **Free to host** on Cloudflare Workers (100,000 requests/day on the free plan, far more than a study group needs).
- **No database and nothing to clean up.** Polls and votes live in Telegram itself.
- **Zero runtime dependencies.** The whole Worker is ~16 KB.
- **Security-first.** Authenticated webhook, IP allowlist, fail-closed config, sanitised input, redacted logs. See [SECURITY.md](SECURITY.md).
- **Built to extend.** Add a command by dropping in one file. Scheduling, recurring polls and daily verses are planned (see [docs/EXTENDING.md](docs/EXTENDING.md)).

---

## How it works

```
 Telegram ──HTTPS POST + secret header──▶ Cloudflare Worker ──sendPoll──▶ Telegram
                                           │
                                           ├─ verify source IP is Telegram's
                                           ├─ verify secret token (constant-time)
                                           ├─ validate body (size, JSON)
                                           └─ route "/jio …" → jio command
```

User-added options use Telegram's native `allow_adding_options` poll flag (Bot API 9.6+). Telegram doesn't allow this on anonymous polls, so **votes are visible to the group**.

---

## Quick start (about 15 minutes)

### Prerequisites
- [Node.js](https://nodejs.org) 20 or newer
- A free [Cloudflare account](https://dash.cloudflare.com/sign-up)
- Telegram

### 1. Create the bot
1. In Telegram, message **[@BotFather](https://t.me/BotFather)** → `/newbot` → pick a name and a username (must end in `bot`).
2. Copy the **token** it gives you. Treat it like a password.
3. Recommended hardening in BotFather:
   - `/setjoingroups` → keep **Enabled** only while you add it to your groups, then **Disable** it so strangers can't add your bot elsewhere.
   - `/setprivacy` → leave **Enabled** (the bot only sees commands, not your group chatter).

### 2. Get the code
```bash
git clone https://github.com/<you>/study-jio-bot.git
cd study-jio-bot
npm install
npm run check        # typecheck + tests
```

### 3. Configure
Edit `wrangler.toml` and set your bot's username (without `@`):
```toml
BOT_USERNAME = "MyStudyJioBot"
```

Generate a webhook secret:
```bash
npm run secret:generate
```

### 4. Deploy to Cloudflare
```bash
npx wrangler login                                   # opens your browser
npx wrangler secret put TELEGRAM_BOT_TOKEN           # paste the BotFather token
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET      # paste the generated secret
npm run deploy
```
Wrangler prints your URL, e.g. `https://study-jio-bot.<you>.workers.dev`.

### 5. Connect Telegram to your Worker
```bash
cp .env.example .env     # fill in token, secret, and WEBHOOK_URL=<your url>/telegram/webhook
npm run setup:webhook
npm run webhook:info     # should show your URL and no last_error_message
```

### 6. Try it
Add the bot to a group and send `/jio CLB`. 🎉

---

## Configuration

| Name | Where | Required | Description |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | `wrangler secret` | ✅ | Token from @BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | `wrangler secret` | ✅ | 32–256 chars `A-Z a-z 0-9 _ -`. Telegram sends it back on every call |
| `BOT_USERNAME` | `wrangler.toml` | ✅ | Bot username without `@` |
| `ENFORCE_TELEGRAM_IP` | `wrangler.toml` | — | `true` (default) rejects calls from outside Telegram's IP ranges |
| `ALLOWED_CHAT_IDS` | `wrangler.toml` | — | Comma-separated chat IDs. If set, the bot ignores every other chat |

Poll behaviour (fixed options, multiple answers, cooldown) is in [`src/config.ts`](src/config.ts).

**Lock the bot to your groups (recommended):** add the bot, send `/jio test`, run `npx wrangler tail` and read the `chatId` from the logs, then put it in `ALLOWED_CHAT_IDS` and redeploy.

---

## Commands

| Command | What it does |
|---|---|
| `/jio <name>` | Posts a study poll titled `<name>` with the fixed options. Members can add options |
| `/help` | Lists commands |
| `/start` | Same as `/help` |

`/jio` has a 10-second per-chat cooldown to stop spam.

---

## Project layout

```
src/
  index.ts                 Worker entry: routing, auth, body validation
  env.ts                   Env bindings + strict, fail-closed config validation
  config.ts                Non-secret behaviour settings (poll options, cooldowns)
  logger.ts                JSON logger with token/secret redaction
  bot/
    command.ts             Command + CommandContext interfaces
    router.ts              Parses commands, dedupes, rate-limits, dispatches
    commands/
      index.ts             ← THE REGISTRY: add new commands here
      jio.ts               /jio
      help.ts              /help, /start
  security/
    webhook-auth.ts        Secret check (constant-time) + Telegram IP ranges
    sanitize.ts            Input cleaning, HTML escaping
    rate-limit.ts          Per-chat cooldown, duplicate-update guard
  telegram/
    client.ts              Tiny Bot API client (never leaks the token)
    types.ts               The Bot API types we use
scripts/setup-webhook.ts   Registers webhook + command menu (run locally)
test/                      Vitest unit + end-to-end tests
docs/                      Developer documentation
```

## Developer docs

- [Architecture](docs/ARCHITECTURE.md): request lifecycle and design decisions
- [Development](docs/DEVELOPMENT.md): local dev, testing, debugging
- [Deployment](docs/DEPLOYMENT.md): manual and GitHub Actions deploys, rotating secrets
- [Extending](docs/EXTENDING.md): adding commands, plus blueprints for scheduled and recurring polls and daily verses
- [Hosting options](docs/HOSTING.md): why Cloudflare Workers, and the free alternatives
- [Security](SECURITY.md): threat model, controls, reporting

## License

[MIT](LICENSE)
