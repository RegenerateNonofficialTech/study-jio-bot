# Hosting options

Free tiers change often, so check the provider's current pricing page before you rely on one.

## What a Telegram bot needs

- A public **HTTPS** URL Telegram can POST to
- Ability to **read request headers** (to verify `X-Telegram-Bot-Api-Secret-Token`)
- Encrypted **secret storage** for the bot token
- Ideally **no sleeping**, so commands are answered instantly

## Comparison

| Option | Free? | Verdict |
|---|---|---|
| **Cloudflare Workers** ✅ *(chosen)* | Yes: 100k requests/day | Always on, HTTPS by default, encrypted secrets, reads headers, no credit card needed. Cron Triggers available later for scheduled polls |
| Google Apps Script | Yes | Works for simple bots, but a web app's `doPost(e)` **cannot read HTTP headers**, so you can't verify Telegram's secret token. You'd have to hide a secret in the URL instead (it ends up in logs and history). Storage in Sheets/Properties also needs manual cleanup. Not recommended for "strong security" |
| Vercel / Netlify functions | Yes (hobby tiers) | Fine technically; hobby tiers have usage terms and limits. More moving parts for the same result |
| Deno Deploy | Yes | Good alternative; similar model to Workers. Only `src/index.ts` would need adapting |
| Render / Railway / Fly.io | Limited or trial | Container hosts. Free tiers typically sleep when idle or are time-limited, which means slow or missed replies |

## On "cleaning up data"

This bot **stores nothing**. Polls, options and votes are stored by Telegram as part of the chat. There's nothing to purge or back up, and no personal data held by you. Logs in Cloudflare are short-lived and contain only chat IDs and event names, never message text or tokens.

If you add features that need storage (scheduled or recurring polls), use Cloudflare **D1** or **KV** and add a cleanup rule at the same time. See [EXTENDING.md](EXTENDING.md).
