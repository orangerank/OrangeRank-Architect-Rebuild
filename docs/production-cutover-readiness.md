# Production launch readiness

Production can accept Stripe sandbox keys when `ORANGERANK_STRIPE_MODE=test` and the checkout release flags are true. A sandbox payment on production dispatches Contract C. Live keys stay closed until `ORANGERANK_LIVE_APPROVED=true`, and those payments use Contract B. See `docs/production-launch.md` for the environment names.

Contract A remains disabled when `VERCEL_ENV` is production. Do not point the Grok validation webhook at production.
