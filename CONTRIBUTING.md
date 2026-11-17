# Contributing

1. Fork the repo and create a branch: `git checkout -b feat/my-feature`
2. `npm install && npm run check`
3. Make your change, **with tests**. Security-relevant code needs a test proving bad input is rejected.
4. `npm run check` must pass.
5. Open a PR describing what and why.

Ground rules:
- No new **runtime** dependencies without discussion (supply-chain risk, see SECURITY.md).
- Never commit tokens, `.dev.vars` or `.env`. Push protection should block it, but don't rely on that.
- New commands follow [docs/EXTENDING.md](docs/EXTENDING.md).
