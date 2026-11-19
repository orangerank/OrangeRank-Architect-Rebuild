# Assessment pipeline parity

Source: `orangerank/orangerank` at `9fe530b35ee37802bb6cd512de107ab605a6149f` (main). Pipeline files were copied byte-for-byte. `tests/parity-pipeline.test.mjs` checks those bytes, the intake post, the Checkout Session object, and a signed Stripe test event. The existing `tests/*.test.mjs` suite is included unchanged except `tests/platform-presentation.test.mjs`, which no longer shells out to a commit that does not exist in this repo.

Status values: **ported and verified**, **ported but unverifiable without secrets**, **changed**.

## Intake form

Route: `GET /get-your-orange-score`. Component: `components/intake/intake-form.tsx`. Validation: `components/intake/validation.ts`. Server parse: `lib/checkout/core.ts` `parseIntake`.

Two steps. Step 1 is business name, website, primary city, state, and customer email. Continue moves to step 2 only when those fields pass. Step 2 is category, primary services, service area, customer name, phone, known competitors, Google Business Profile URL, up to five additional URLs (`url0`–`url4`), notes, and the terms checkbox.

The checkbox `acceptance` must be `yes`. The browser posts:

```json
{
  "intake_submission_id": "<uuid v4, reused from sessionStorage for the same payload>",
  "intake": { "...values": true, "terms_accepted": true }
}
```

`terms_accepted` is the boolean `values.acceptance === 'yes'`. Resume posts `{ "resume": true }` to the same route and uses the `or_checkout` cookie.

| Field | Required | Validation |
|---|---|---|
| businessName | yes | non-empty, max 200 |
| website | yes | http(s) URL, hostname contains a dot, no credentials, max 500 |
| customerName | yes | non-empty, max 200 |
| email | yes | contains `@` and a dot in the domain; common provider typos suggest a correction and do not block |
| category | yes | one of the 11 categories in `validation.ts` |
| city | yes | non-empty, max 200 |
| state | yes | US state or District of Columbia |
| services | yes | non-empty, max 5000 |
| serviceArea | yes | non-empty, max 200 |
| acceptance | yes | checkbox; stored as `yes`, posted as `terms_accepted: true` |
| phone | no | max 200 |
| competitors | no | max 5000 |
| googleUrl | no | same URL rules, max 500 |
| url0–url4 | no | same URL rules, max 500 |
| notes | no | max 5000 |

Prefill query params, left separate from `utm_*`: `biz` → businessName, `site` → website, `city` → city, `email` → email.

Server rejects a missing or non-true `terms_accepted`, control characters, and any field over its max. Checkout is `POST /api/checkout`.

**Status: ported and verified.** `components/intake/*`, the checkout page, and `parseIntake` match the source hashes. The parity test reads the posted body and the required-field list.

## Checkout session

`POST /api/checkout` (`app/api/checkout/route.ts`).

Gates, all required: `ORANGERANK_CHECKOUT_ENABLED=true`, `ORANGERANK_CHECKOUT_RELEASE_APPROVED=true`, `ORANGERANK_STRIPE_MODE` of `test` or `live`, a matching `sk_test_` / `sk_live_` key, `STRIPE_ORANGERANK_PRICE_ID` starting with `price_`, and `Origin` plus the request URL equal to `ORANGERANK_CHECKOUT_ORIGIN`. Live mode also requires `VERCEL_ENV=production` and `ORANGERANK_LIVE_APPROVED=true`. Otherwise the route returns 503 and does not call Stripe.

The price is retrieved from Stripe and must be active, one-time, USD, and `unit_amount` 14900 in the same livemode. No amount is hardcoded on the Session line item. The line item is `{ price: <STRIPE_ORANGERANK_PRICE_ID>, quantity: 1 }`.

Session object from `sessionParams`:

- `mode`: `payment`
- `currency`: `usd`
- `allow_promotion_codes`: `true` (Stripe Checkout can accept a code; the site does not show one)
- `customer_email`: intake email
- `client_reference_id`: assessment id (`OR-YYYYMMDD-<slug>`, America/Chicago)
- `success_url`: `<ORANGERANK_CHECKOUT_ORIGIN>/checkout/success`
- `cancel_url`: `<ORANGERANK_CHECKOUT_ORIGIN>/checkout/cancel`
- `metadata` and `payment_intent_data.metadata`: `assessment_id`, `business_name`, `website`, `customer_email`, `product` `orangerank_assessment_v1`, `ledger_version` `ControlLedger-V1.0`, `methodology_version` `PRODUCTION-v1-LOCKED`, `report_template_version` `V1.3`, `intake_submission_id`
- idempotency key: `or-checkout-<intake_submission_id>`

Pending intake is stored in Upstash Redis. The response sets cookie `or_checkout` and returns `{ url, assessment_id }` only when the Session URL host is `checkout.stripe.com`.

`GET /api/checkout/status` reads that cookie and returns the customer status. It does not confirm payment by itself.

**Status: ported and verified** for the Session payload, gates, and URLs (parity test plus `tests/checkout.test.mjs`). **Creating a real Stripe Session against the live price is unverifiable without secrets.**

## Stripe webhook

One route: `POST /api/stripe/webhook`.

Signature: raw body, header `stripe-signature`, `stripe.webhooks.constructEvent` with `STRIPE_WEBHOOK_SECRET` (must start with `whsec_`). Missing, invalid, tampered, or oversized bodies are rejected. There is no second webhook route.

Handled events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and only when `event.livemode` matches `ORANGERANK_STRIPE_MODE`. Any other event returns 200 and is ignored. The handler re-fetches the Session from Stripe (`payment_intent`, `line_items`, discount expansions) and does not trust the event body for the amount. A confirmed payment is written in Redis. Browser success and cancel pages do not mark a payment confirmed.

**Status: ported and verified** against a signed test event in `tests/parity-pipeline.test.mjs` and `tests/payment-webhook.test.mjs`. **A delivery signed by Stripe’s live or sandbox endpoint is unverifiable without secrets.**

## Outbound webhooks

Test-mode Stripe webhook (`ORANGERANK_STRIPE_MODE=test`), after a confirmed, duplicate, or duplicate-payment result, calls `dispatchContractC`.

- URL: `ORANGERANK_HANDOFF_URL`
- Auth: `Authorization: Bearer <ORANGERANK_HANDOFF_TOKEN>`
- Also sends `Content-Type: application/json` and `Idempotency-Key: orangerank-test-<assessment_id>-<intake_submission_id>`
- Body: `contract_version` `orangerank-test-handoff-v1`, `execution_mode` `TEST_MODE`, plus the intake allowlist below
- Requires `ORANGERANK_HANDOFF_ENABLED=true` and an https URL with no userinfo, query, or hash

Live-mode Stripe webhook calls `dispatchAssessment` (Contract B) when Grok validation is not configured.

- Same URL and bearer token
- `Idempotency-Key: orangerank-assessment-<assessment_id>`
- Body: `contract_version` `orangerank-handoff-v1`
- Intake fields: `business_name`, `website`, `customer_name`, `customer_email`, `business_category`, `primary_location` `{city, state}`, `primary_services`, `terms_accepted`, `phone`, `service_area`, `competitors_known`, `google_business_url`, `additional_urls`, `notes`
- Payment fields: reference, checkout session id, amount, list amount 14900, discount, promotion code, currency `usd`, confirmed_at

Grok Bot paid-assessment validation is a different POST, not the test-mode Stripe branch.

- URL: `GROK_ROUTINE_WEBHOOK_URL`
- Auth: `Authorization: Bearer <GROK_ROUTINE_WEBHOOK_KEY>`
- Sent by `sendGrokValidation` from `dispatchAssessment` on `POST /api/internal/assessment-handoff` when handoff is off and `VERCEL_ENV` is not `production`
- `mode`: `validation_only`
- Fields: `assessment_id`, `business_name`, `website`, `business_category`, `primary_city`, `primary_state`, `primary_service_area`, `main_services` (one string, the services text), `customer_email`, `customer_name`, terms timestamps, and `optional_intake.competitors` when present
- Older names `ORANGERANK_GROK_*` are not read

**Status: ported and verified** for both payloads and headers, with transport mocked. **Calling the real handoff or Grok URL is unverifiable without secrets.**

## Emails

This repository does not send email. There is no mail provider in `package.json` and no send call. Copy on the intake, success, privacy, and terms pages still says the finished report goes to the email on the form. That address is stored as `customer_email` and included on the handoff and Grok payloads. Contact links use `mailto:hello@getorangerank.com`.

**Status: ported and verified** that no mailer was added or removed. **Whether a downstream system actually delivers the report is unverifiable without that system.**

## Environment variables

Names only. Values are not in this repo. `.env.example` documents the empty placeholders. `.env` is gitignored.

| Name | Role |
|---|---|
| ORANGERANK_CHECKOUT_ENABLED | Checkout gate |
| ORANGERANK_CHECKOUT_RELEASE_APPROVED | Checkout gate |
| ORANGERANK_CHECKOUT_ORIGIN | Exact trusted origin for checkout and click same-site checks |
| ORANGERANK_STRIPE_MODE | `test` or `live` |
| ORANGERANK_LIVE_APPROVED | Required before live mode |
| STRIPE_SECRET_KEY | `sk_test_` or `sk_live_` matching the mode |
| STRIPE_ORANGERANK_PRICE_ID | `price_` id; retrieved amount must be 14900 USD one-time |
| STRIPE_WEBHOOK_SECRET | `whsec_` signing secret for this mode |
| UPSTASH_REDIS_REST_URL | Intake, payment, and click store |
| UPSTASH_REDIS_REST_TOKEN | Redis token |
| ORANGERANK_HANDOFF_ENABLED | Turn on the outbound handoff |
| ORANGERANK_HANDOFF_URL | Contract B / Contract C POST URL |
| ORANGERANK_HANDOFF_TOKEN | Bearer token for that URL |
| ORANGERANK_DISPATCH_SECRET | Bearer secret for internal dispatch, at least 32 characters |
| GROK_ROUTINE_WEBHOOK_URL | Grok validation POST URL. Preview only. Blocked when handoff is on or in production |
| GROK_ROUTINE_WEBHOOK_KEY | Bearer key for that URL |
| ORANGERANK_AUDIT_SECRET | Preview read-only audit |
| ORANGERANK_SANDBOX_CORRECTION_SECRET | Preview synthetic correction |
| ORANGERANK_REVIEW_REPLAY_SECRET | One-time review replay |
| ORANGERANK_OUTREACH_CLICKS_SECRET | Read API for stored click codes |
| VERCEL_ENV | Platform. Production blocks several preview-only routes |
| NODE_ENV | Platform. Vercel Analytics renders only when this is `production` |

**Status: ported and verified** that these names are the ones the code reads. **The secret values on the new deploy are unverifiable here.**

## utm_content

`OutreachClickBeacon` is mounted in the root layout. It reads `utm_content`, keeps codes shaped like `b18-0001` or `b18-0001-f2`, and `POST`s `{ code, path }` to `/api/outreach-click`. The route stores the code, path, and time. It does not store a name, email, IP, or user agent. Outreach prefill params do not consume `utm_*`. The beacon, code rules, POST body, and route are unchanged from the source.

**Changed.** A request to `/` with a non-empty `utm_content` redirects to `/ai-visibility` and keeps the full query string (`proxy.ts`). Outreach prospects are local businesses, so they see the assessment. The beacon then runs on `/ai-visibility` and records the same code. The stored path is `/ai-visibility` rather than `/`. A visit to `/` with no `utm_content` renders the split homepage and does not redirect. A live Redis write is still unverifiable without the store.

## Analytics

`@vercel/analytics/next` `<Analytics />` renders only when `NODE_ENV === 'production'`. The intake form does not send field values to it.

**Status: ported and verified** in `app/layout.tsx`. A hit in the Vercel Analytics UI is unverifiable until this repo is deployed.

## Redirects and rewrites

`next.config.mjs` sets security headers only. It has no `redirects` or `rewrites`. There is no `vercel.json`.

**Changed.** The only redirect is the outreach landing rule in `proxy.ts`, described under utm_content. Checkout, intake, webhook, and handoff routes are not redirected.

## Other routes kept

These files are in the hash manifest and were not edited:

- `POST /api/checkout`
- `GET /api/checkout/status`
- `POST /api/stripe/webhook`
- `POST /api/outreach-click`
- `POST /api/internal/assessment-handoff`
- `GET /api/internal/handoff-configuration`
- `GET /api/internal/outreach-clicks`
- `POST /api/internal/review-replay`
- `POST /api/internal/sandbox-service-area`
- `POST /api/internal/test-handoff`
- `GET /checkout/success`
- `GET /checkout/cancel`
- `GET /privacy`
- `GET /terms`

## Changed

- Outreach landing only. `/?utm_content=<code>` redirects to `/ai-visibility` with the query string preserved. The click code is still recorded by the same beacon and the same `/api/outreach-click` route. The stored path for that visit is `/ai-visibility`.

No intake field, Checkout Session shape, webhook path, signature check, event list, outbound payload, or env var name was changed.
