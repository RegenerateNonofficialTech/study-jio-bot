# Security

## Reporting a vulnerability

Please **don't open a public issue**. Use GitHub's **private vulnerability reporting** (Security tab → *Report a vulnerability*) on this repository. Expect an acknowledgement within 7 days.

If your bot token may have leaked, **revoke it immediately** in @BotFather (`/revoke`), then follow *Rotating secrets* in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Threat model

| # | Threat | Impact | Controls |
|---|---|---|---|
| T1 | Someone finds the Worker URL and POSTs fake updates | Bot spams polls / is used as a relay | Secret token header (constant-time compare) **and** Telegram IP allowlist. Both must pass |
| T2 | Bot token leaks (repo, logs, error messages) | Full takeover of the bot | Token only in Cloudflare encrypted secrets; `.dev.vars`/`.env` git-ignored; client never puts the URL in errors; logger redacts anything token-shaped; CI secret scanning |
| T3 | Misconfiguration (missing/weak secret) silently disables auth | T1 becomes possible | Config is validated on every request and **fails closed** (HTTP 500, nothing processed). Secret must be ≥ 32 chars |
| T4 | Group member spams `/jio` | Chat flooded with polls | Per-chat cooldown (10 s); bot stays silent when rate-limited |
| T5 | Malicious jio name (control chars, RTL-override spoofing, HTML injection, huge input) | Spoofed or broken messages | Unicode-normalised, control/bidi/zero-width chars removed, whitespace collapsed, 300-char cap; HTML-escaped wherever we use HTML mode |
| T6 | Bot added to strangers' groups | Abuse of your bot and free quota | `ALLOWED_CHAT_IDS` allowlist; BotFather `/setjoingroups` → Disable |
| T7 | Telegram retries cause duplicate polls | Annoyance | `update_id` de-duplication; always 200 after auth so Telegram stops retrying |
| T8 | Oversized or malformed bodies (resource exhaustion) | Worker errors / CPU burn | Content-type check, 64 KB cap (header and actual), strict JSON shape check |
| T9 | Supply-chain attack via dependencies | Arbitrary code in your bot | **Zero runtime dependencies** (dev tooling only); lockfile committed; Dependabot; `npm audit` in CI; CodeQL |
| T10 | Exposed admin endpoints | Takeover via setup URL | No admin endpoints. Webhook setup runs from your machine via `npm run setup:webhook` |
| T11 | Over-broad update subscription | Bot receives data it doesn't need | `allowed_updates: ["message"]`; BotFather privacy mode on |

### Known limitations (by design)

- **Rate limiting and de-duplication are per Worker isolate** (in memory). They stop bursts, not a determined distributed attacker, but such an attacker is already blocked by T1's controls. Back them with Durable Objects if you need hard guarantees.
- **Polls are not anonymous.** Telegram requires this for user-added options.
- **IPv6 webhook sources are rejected** while `ENFORCE_TELEGRAM_IP=true`. Telegram's published webhook ranges are IPv4. If Telegram changes its ranges, update `TELEGRAM_CIDRS` in `src/security/webhook-auth.ts`; rejections appear in logs as `rejected: source IP not in Telegram ranges`.

---

## Operator checklist

- [ ] Token and webhook secret set with `wrangler secret put`, never in `wrangler.toml` or git
- [ ] Webhook secret generated with `npm run secret:generate` (≥ 32 chars)
- [ ] `ENFORCE_TELEGRAM_IP` left as `true`
- [ ] `ALLOWED_CHAT_IDS` set to your groups
- [ ] BotFather: `/setjoingroups` → Disable after adding to your groups; `/setprivacy` → Enabled
- [ ] GitHub: enable **secret scanning**, **push protection**, **Dependabot alerts**, **private vulnerability reporting**
- [ ] GitHub: protect `main` (require PR + passing CI)
- [ ] Cloudflare: 2FA on the account; the API token used by CI is scoped to *Workers Scripts: Edit* only
