# Deployment

## Manual (from your laptop)

```bash
npm run check
npm run deploy
```

Run `npm run setup:webhook` again only if the URL or secret changed, or you added/renamed commands (it refreshes the `/` menu).

## Automatic (GitHub Actions)

`.github/workflows/deploy.yml` deploys on every push to `main` after tests pass.

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token** → template **"Edit Cloudflare Workers"**. Restrict it to your account. Don't use your Global API Key.
2. GitHub repo → **Settings → Environments → New environment** named `production`. Optionally require a reviewer.
3. Add environment secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID` (Cloudflare dashboard → Workers & Pages → right sidebar)

The bot token and webhook secret are **not** stored in GitHub. They live only in Cloudflare (`wrangler secret put`) and survive deploys.

## Rotating secrets

Rotate if a secret may have leaked, or periodically (e.g. each semester).

**Webhook secret** (no downtime if done in this order):
```bash
npm run secret:generate                         # new value
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET # paste new value
npm run setup:webhook                           # with new value in .env
```
Updates sent between the two steps get a 401, and Telegram retries them.

**Bot token:**
1. @BotFather → `/revoke` → choose bot → copy the new token (the old one stops working immediately).
2. `npx wrangler secret put TELEGRAM_BOT_TOKEN`
3. `npm run setup:webhook` (a revoked token also removes the webhook)

## Free-plan limits

On the Workers Free plan you get 100,000 requests/day and a small CPU budget per request. Each Telegram message the bot receives is one request. With privacy mode on, it only receives commands, so a study group will use a tiny fraction. If the daily limit is hit, requests fail until the daily reset (00:00 UTC). Telegram retries, so nothing breaks permanently.
