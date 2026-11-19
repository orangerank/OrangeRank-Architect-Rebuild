# Production launch

www.getorangerank.com can run on Stripe sandbox keys first. A paid sandbox checkout (`livemode: false`) confirms through the Stripe webhook and dispatches Contract C (`orangerank-test-handoff-v1`). A later switch to live keys uses Contract B (`orangerank-handoff-v1`) for `livemode: true` payments only. Contract B still rejects a test payment with `SYNTHETIC_QUARANTINE` before any handoff. Contract A (`validation_only`) stays off in production.

Checkout stays closed until `ORANGERANK_CHECKOUT_ENABLED` and `ORANGERANK_CHECKOUT_RELEASE_APPROVED` are both `true`. Live keys also require `ORANGERANK_LIVE_APPROVED=true`.

## Production environment names

Names only. Set them in the Vercel Production environment. Do not commit values.

| Name | Sandbox launch | Live switch |
|---|---|---|
| `ORANGERANK_STRIPE_MODE` | `test` | `live` |
| `ORANGERANK_LIVE_APPROVED` | unset or not `true` | `true` |
| `STRIPE_SECRET_KEY` | sandbox secret key | live secret key |
| `STRIPE_ORANGERANK_PRICE_ID` | sandbox $149 price | live $149 price |
| `STRIPE_WEBHOOK_SECRET` | sandbox endpoint secret | live endpoint secret |
| `ORANGERANK_CHECKOUT_ENABLED` | `true` | `true` |
| `ORANGERANK_CHECKOUT_RELEASE_APPROVED` | `true` | `true` |
| `ORANGERANK_CHECKOUT_ORIGIN` | `https://www.getorangerank.com` | same origin |
| `UPSTASH_REDIS_REST_URL` | production Redis URL | same, unless a separate live database is chosen |
| `UPSTASH_REDIS_REST_TOKEN` | matching Redis token | same, unless that database changes |
| `ORANGERANK_HANDOFF_ENABLED` | `true` to complete handoff | `true` |
| `ORANGERANK_HANDOFF_URL` | receiver HTTPS URL | same, unless the live receiver is different |
| `ORANGERANK_HANDOFF_TOKEN` | receiver bearer token | same, unless the live receiver is different |

Leave these unset in Production so Contract A and internal operator routes stay closed:

`GROK_ROUTINE_WEBHOOK_URL`, `GROK_ROUTINE_WEBHOOK_KEY`, `ORANGERANK_DISPATCH_SECRET`, `ORANGERANK_AUDIT_SECRET`, `ORANGERANK_SANDBOX_CORRECTION_SECRET`.

`ORANGERANK_REVIEW_REPLAY_SECRET` stays unset except during the one-time review replay in [review-replay.md](./review-replay.md). Remove it after that call.

`ORANGERANK_OUTREACH_CLICKS_SECRET` authorizes `GET /api/internal/outreach-clicks`. Set it in Production when daily click readback should run. It must be at least 32 characters and distinct from the other `ORANGERANK_*` secrets. See [outreach-clicks.md](./outreach-clicks.md).

`VERCEL_ENV` is set by the platform.

Stripe webhook endpoint: `https://www.getorangerank.com/api/stripe/webhook`. Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`. The sandbox endpoint secret and the live endpoint secret are different.
