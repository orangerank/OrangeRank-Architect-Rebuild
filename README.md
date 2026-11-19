# OrangeRank

Marketing site and AI Visibility Assessment checkout for OrangeRank.

- `/` introduces both offerings. Outreach links can still land here with `?utm_content=<code>`.
- `/ai-visibility` is the assessment page.
- `/get-your-orange-score` is the intake and secure checkout path. Do not rename it.
- `/ai-workforce-systems` is the AI Workforce Systems page. The discovery CTA is `mailto:hello@getorangerank.com`.

The assessment pipeline is copied from `orangerank/orangerank` and checked in [PARITY-CHECKLIST.md](PARITY-CHECKLIST.md).

## Scripts

```bash
pnpm install
pnpm test
pnpm build
pnpm dev
```

## Environment

Copy `.env.example` to `.env`. Do not commit `.env`. A new deploy needs the names listed in `PARITY-CHECKLIST.md`. Checkout stays off until `ORANGERANK_CHECKOUT_ENABLED` and `ORANGERANK_CHECKOUT_RELEASE_APPROVED` are both `true`, and `ORANGERANK_CHECKOUT_ORIGIN` is the exact origin of that deploy. Live Stripe mode also needs `ORANGERANK_LIVE_APPROVED=true`. This repo does not change the production Vercel project or DNS.
