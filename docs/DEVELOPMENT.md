# Development

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars   # fill in a TEST bot token (create a second bot in @BotFather for dev)
npm run check                    # typecheck + tests
```

> Use a **separate dev bot**. Pointing your production bot's webhook at a dev tunnel would take production offline.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Runs the Worker locally at `http://localhost:8787` (reads `.dev.vars`) |
| `npm test` / `npm run test:watch` | Vitest |
| `npm run typecheck` | `tsc --noEmit` (strict mode) |
| `npm run check` | Both of the above. CI runs this |
| `npm run deploy` | `wrangler deploy` |
| `npm run setup:webhook` | Registers webhook URL + secret + command menu with Telegram |
| `npm run webhook:info` | Shows Telegram's webhook status and last error |
| `npm run secret:generate` | Prints a strong random webhook secret |

## Testing against real Telegram locally

Telegram needs a public HTTPS URL. Run a tunnel to your local Worker:

```bash
npm run dev
npx cloudflared tunnel --url http://localhost:8787   # prints https://<random>.trycloudflare.com
```

Then point your **dev bot** at it:
```bash
WEBHOOK_URL=https://<random>.trycloudflare.com/telegram/webhook \
TELEGRAM_BOT_TOKEN=<dev token> TELEGRAM_WEBHOOK_SECRET=<dev secret> \
npm run setup:webhook
```
`.dev.vars.example` sets `ENFORCE_TELEGRAM_IP=false` because tunnelled requests don't carry Telegram's IP in `CF-Connecting-IP`.

## Simulating an update with curl

```bash
curl -i http://localhost:8787/telegram/webhook \
  -H 'content-type: application/json' \
  -H "X-Telegram-Bot-Api-Secret-Token: $TELEGRAM_WEBHOOK_SECRET" \
  -d '{"update_id":1,"message":{"message_id":1,"date":0,
       "from":{"id":1,"is_bot":false,"first_name":"Me"},
       "chat":{"id":<your chat id>,"type":"private"},
       "text":"/jio CLB","entities":[{"type":"bot_command","offset":0,"length":4}]}}'
```

## Tests

- `test/security.test.ts`: auth primitives, config validation, sanitising, rate limits
- `test/router.test.ts`: command parsing and every router branch
- `test/webhook.test.ts`: end-to-end through `handleRequest` with a fake Telegram API

Every security control has a test that proves it **rejects** bad input, not just that good input works. Keep it that way when adding features.

## Debugging production

```bash
npx wrangler tail          # live JSON logs
npm run webhook:info       # Telegram's view: pending updates, last error
```

Common issues:

| Symptom | Likely cause |
|---|---|
| `last_error_message: "Wrong response from the webhook: 401"` | Secret in Telegram ≠ secret in Cloudflare. Re-run `setup:webhook` with the same value |
| `... 403` | Request didn't come from a Telegram IP (check logs; see SECURITY.md) |
| `... 500` + log `invalid configuration` | A secret or `BOT_USERNAME` is missing or malformed |
| Bot ignores `/jio` in a group | `BOT_USERNAME` wrong, chat not in `ALLOWED_CHAT_IDS`, or cooldown active |
| Poll has no "Add option" | Telegram app too old. Users need an app version that supports Bot API 9.6 polls |

## Code style

- TypeScript `strict` + `noUncheckedIndexedAccess`.
- No new runtime dependencies without discussing it in a PR (see SECURITY.md T9).
- Handlers receive everything via `CommandContext`. No globals, no direct `fetch`.
