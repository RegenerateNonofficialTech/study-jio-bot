# Architecture

## Goals

1. **Free and always-on**: no server to keep awake, no cold-start sleep.
2. **Stateless**: Telegram stores polls and votes, so there's no database to secure, back up or clean.
3. **Small and auditable**: zero runtime dependencies; every line that runs in production is in `src/`.
4. **Easy to extend**: a new feature is a new file, not a rewrite.

## Request lifecycle

```
POST /telegram/webhook
│
├─ index.ts: handleRequest
│   ├─ path/method routing ............ 404 / 405
│   ├─ loadConfig(env) ................ 500 if invalid (fail closed)
│   ├─ isTelegramIp(CF-Connecting-IP) . 403
│   ├─ hasValidSecret(header) ......... 401 (constant-time compare)
│   ├─ content-type + size checks ..... 415 / 413
│   ├─ JSON parse + shape check ....... 400
│   └─ handleUpdate(...) then always 200
│
└─ bot/router.ts: handleUpdate
    ├─ duplicate update_id? → ignore
    ├─ not a message / from a bot? → ignore
    ├─ chat not in allowlist? → ignore
    ├─ parseCommand (uses Telegram's bot_command entity, handles /cmd@BotName)
    ├─ find command in registry → unknown? ignore
    ├─ per-chat cooldown → limited? ignore silently
    └─ command.handle(ctx), and on error log it and send a polite apology
```

## Key design decisions

| Decision | Why |
|---|---|
| **Cloudflare Workers** | Free plan covers 100k requests/day, HTTPS out of the box, no sleeping, secrets stored encrypted. See [HOSTING.md](HOSTING.md) |
| **Webhook, not long-polling** | Serverless-friendly; Telegram pushes updates only when something happens |
| **Native `allow_adding_options`** | Telegram handles "add an option" UI and storage. No custom buttons or DB needed |
| **No SDK (grammY/telegraf)** | Fewer dependencies means less supply-chain risk and a smaller bundle. We need ~5 API methods |
| **Dependencies injected via `CommandContext`** | Handlers are pure-ish and unit-testable with a fake `fetch` |
| **Setup via local script, not an endpoint** | No admin surface on the public internet |
| **Always 200 after auth** | Prevents Telegram from retrying a failing update in a loop |
| **Silent on unknown commands and rate limits** | Bots that chatter in groups get muted or kicked |

## Module boundaries

- `telegram/`: knows the Bot API and nothing about the bot's features.
- `security/`: pure functions, no I/O except `crypto.subtle`.
- `bot/`: features. Depends on `telegram/` and `security/` via interfaces.
- `index.ts`: the only file that knows about HTTP and Cloudflare.

Moving to another host (Deno Deploy, Vercel, a Node server) means rewriting only `index.ts`'s thin adapter.
