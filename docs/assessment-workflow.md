# Consolidated payment → assessment workflow / launch gate

Base: main `4a5142f`, merged PR #5 diagnostics and PR #6 verified payment. This is an extension, NOT a replacement checkout. Branding, page design, intake fields, $149 pricing, and fixed methodology `PRODUCTION-v1-LOCKED` are unchanged. New checkout and handoff metadata set report template `V1.3`. Sessions already issued as `V1.2` still verify and are stamped `V1.3` when payment is confirmed. Redis remains authoritative until a real ledger receiver is connected.

## Confirmed investigation (October 9, 2026)

Production sandbox launch is documented in `docs/production-launch.md`. The inventory below describes the earlier Preview setup.

Reviewed actual main source, PRs #5/#6, Lua scripts and prior setup guides. Queried Vercel function logs for 04:44–05:29 UTC and specifically searched webhook invocations. Latest observed checkout: request `lwnhm-1791523476752-fdde1743230e`, deployment `dpl_ARRsdQtwsUnVvfa7ac9gRHLtgqk1`, 05:24:37 UTC, HTTP 403. CHECKOUT_ENABLED_GUARD passed; ORIGIN_VERIFICATION failed. Code compares BOTH browser Origin and request.nextUrl.origin to configured ORANGERANK_CHECKOUT_ORIGIN. Query strings/paths are not origin. This proves that request did not reach Redis/Stripe; it does NOT prove Stripe Sandbox Checkout never worked.

No /api/stripe/webhook invocation was returned by the targeted query in that interval. Stripe destination URL, account, delivery HTTP error and endpoint-secret binding are inaccessible via available tools. Therefore prior Sandbox payment verification failure is NOT conclusively attributable to a bad signature, Redis, or a specific webhook condition. Owner must inspect the existing Stripe event/destination delivery history (no new payment required) to establish what URL/environment received it, whether Vercel protection stopped it, and what status was returned. The current production code explicitly blocks this webhook with 503, so pointing a Sandbox destination at the production domain today will not work.

Seven Preview payment variable names are configured; values remain hidden/unverified. No marketplace project resources or team installations are available. Repository contains no Chief of Staff callable endpoint, specialist orchestration, Sheets client/schema or Drive artifact access. No connected Google tools exist in this Agent. Existing Sheets/Drive/bot artifacts cannot be audited until owner grants supported access/provides the real contract. Do not infer that those systems do not exist elsewhere.

## Real request path (preserved)

Checkout guard (Production hard block/test key) → exact-origin guard → request/UUID/intake validation → Redis rate limit → Stripe configured Price retrieval/validation → Redis pending Assessment ID reservation/write → Stripe Session creation with stable submission idempotency key → field-only Session ID save → browser Stripe URL. Browser success/cancel pages never confirm payment.

Webhook: raw-byte signature against receiving environment's STRIPE_WEBHOOK_SECRET → recognized test event → authoritative expanded Session/PaymentIntent retrieval → metadata/product/price/14900 USD/mode/paid validation → Redis CAS Lua transition + durable outbox + event acknowledgement. Delayed unpaid completion waits for async success. Unknown/mismatched/second payments enter durable review, not work. Retries never downgrade an advanced assessment. PR #6 recovery and durability caveats still apply.

Additional safe evidence: origin failures log ONLY configured/header_matches/url_matches booleans; webhook and handoff stage lines identify fixed internal operation stages and allowlisted results in preview and production. No values, bodies, exception messages, tokens, secrets, or full email addresses are logged.

## Receiver contract (adapter implemented; NOT yet a connected integration)

Owner must supply the REAL existing Chief of Staff endpoint and approve the mapping below. No URL is fabricated or preconfigured. The receiver MUST validate bearer auth, atomically deduplicate `Idempotency-Key: orangerank-assessment-<Assessment ID>`, durably upsert its existing Google Sheets Control Ledger using the owner's established schema, enqueue the existing specialist workflow at most once, and only then acknowledge. The adapter is disabled unless explicitly configured in Sandbox Preview. Receiver must also know that test payments may initiate ONLY owner-approved dummy assessment jobs, not real customer production work.

Request POST JSON:
- contract_version: `orangerank-handoff-v1`
- assessment_id and fixed methodology_version/report_template_version
- payment: verified reference, Checkout Session ID, amount 14900, currency usd, confirmed_at (no card data or Stripe secret)
- intake: explicit existing approved field mapping: business_name, website, customer_name, customer_email, business_category, primary_location, primary_services, terms_accepted, phone, service_area, competitors_known, google_business_url, additional_urls, notes. No fingerprint, arbitrary extra record fields, raw event/Stripe objects or credentials. Owner must approve this mapping before enabling transmission.

Required 2xx acknowledgement JSON: `{ "contract_version":"orangerank-handoff-v1", "assessment_id":"<same ID>", "accepted":true, "ledger_recorded":true }`. The receiver must return the SAME durable acknowledgement on repeated delivery. An HTTP 200 alone is not sufficient. This acknowledgement is a TRUSTED receiver claim, not independent proof of a Google Sheets row. Real ledger/bot/Drive artifacts must be checked in acceptance testing.

`POST /api/internal/assessment-handoff` is a server-only authenticated dispatch route, NOT a public diagnostic endpoint. Bearer ORANGERANK_DISPATCH_SECRET (at least 32 characters) is required; Production and live keys remain blocked. Body is either `{ "intake_submission_id":"<UUID>" }` for one item or `{ "cursor":0 }` to begin Redis SCAN of `or:handoff:*`. Consumer supplies each returned cursor, stops at zero, then starts a new pass on its next run. Use existing owner-controlled scheduler/Chief of Staff service; no new database/service or paid scheduler is added. No scheduling is configured by this PR. On a 503 retry after at least 60 seconds; transport interruption replay is safe. SCAN can repeat keys; idempotency/leases handle this.

Outbox entries now include submission ID. Old PR #6 outboxes without it require an owner-run single-item dispatch using the known intake UUID; they are deliberately skipped by automatic scan. No PII scan/migration is silently performed.

## Durable handoff/recovery

Atomic claim checks the verified record snapshot, assigns a random fenced lease (60s), increments attempts. Dispatcher timeout is 15s, no redirects. Failed/invalid acknowledgements retain RETRY_PENDING with one-minute backoff. A worker crash after delivery but before acknowledgement leaves a lease; replay after expiry sends the SAME idempotency key. Receiver-side deduplication is REQUIRED for external exactly-once work; at-least-once delivery is all this sender can promise. Stale workers cannot finalize a new lease.

Atomic acknowledgement updates outbox and `handoff_status=ACKNOWLEDGED`, leaving `current_status=PAYMENT_CONFIRMED`. It does not mark assessment started/completed or fabricate report/Drive links. Actual workflow state/finished artifacts must come from the real existing system. Missing configuration leaves PENDING_INTEGRATION without sending. No Google Sheets schema or replacement bot orchestration is invented. Redis must be durable/non-evicting with backups; Lua does not roll back internal storage errors; infrastructure failure/reconciliation policy remains owner responsibility.

## Vercel environment inventory — names and scopes only

| Name | Purpose | Preview/Sandbox now | Production now |
|---|---|---|---|
| ORANGERANK_CHECKOUT_ENABLED | checkout/webhook gate | exactly true only after owner Sandbox approval | false/unset; hard-blocked regardless |
| ORANGERANK_CHECKOUT_ORIGIN | exact HTTPS browser/server origin, no slash/path/query | SAME stable branch origin used in browser | reserved for canonical production domain; not activated |
| STRIPE_SECRET_KEY | server Stripe API access | Sandbox/test account key only | no live key introduced |
| STRIPE_ORANGERANK_PRICE_ID | one-time USD 14900 Price in same account | Sandbox Price | reserved separate future account Price; no change |
| STRIPE_WEBHOOK_SECRET | endpoint-specific raw signature verification | secret for EXACT Sandbox destination hitting this Preview | reserved separate future destination; no change |
| UPSTASH_REDIS_REST_URL | HTTPS REST database endpoint | owner-approved Sandbox database | separate protected database required before launch; no change |
| UPSTASH_REDIS_REST_TOKEN | private Redis API auth | matching Sandbox DB token | separate Production auth; no change |
| ORANGERANK_HANDOFF_ENABLED | allow actual outgoing approved intake | false until receiver contract verified | false/unset; hard-blocked |
| ORANGERANK_HANDOFF_URL | owner's REAL HTTPS Chief of Staff receiver | unset until supplied; no query/credentials/redirects | reserved real approved receiver; no change |
| ORANGERANK_HANDOFF_TOKEN | receiver bearer credential | protected Preview only | separate Production credential, not configured |
| ORANGERANK_DISPATCH_SECRET | private dispatcher authorization | protected Preview only, >=32 characters | not configured; endpoint blocked |
| VERCEL_ENV | platform-injected environment identity | preview | production hard block |

All custom names are server-only, never NEXT_PUBLIC. Placeholder-only .env.example. Use Vercel → OrangeRank → Settings → Environment Variables protected inputs, preferably branch scope. Redeploy SAME Preview branch after updates; changing main does not update a feature-branch alias. No secrets via chat/Git. No environment mutation was performed by Agent.

## Canonical domains and Stripe destinations

**Canonical permanent production webhook:** `https://www.getorangerank.com/api/stripe/webhook` (same existing route). This is documentation of the future canonical endpoint, NOT an enabled production webhook. It currently returns 503 under the preserved Production hard guard. Do NOT replace a working Sandbox destination with that URL until a separately reviewed Production/Sandbox reception policy and environment deployment is authorized. Live payments remain disabled; Production support requires a separate approval.

**Current Sandbox acceptance webhook:** `https://orangerank-git-vercel-agent-assessment-workflow-chris-4427.vercel.app/api/stripe/webhook` — the intended stable alias for branch `vercel-agent/assessment-workflow`; verify its assignment in Vercel before configuring the destination. Use stable branch alias, not the unique deployment URL and not main's alias (which may follow Production). Preview URL is a testing destination, never the permanent production endpoint. After testing, owner should disable/remove obsolete unique-deployment destinations to prevent stale-key/deployment deliveries.

Event types exactly: `checkout.session.completed`, `checkout.session.async_payment_succeeded`. Configure in matching Stripe Sandbox → Workbench → Webhooks. Endpoint signing secrets are destination-specific and different from CLI listen secrets/live destination secrets. Confirm incoming Stripe traffic is not blocked by Vercel protection; arrange secure endpoint access without broad protection disablement or credential exposure. No Stripe destination, protection, or live-payment setting is changed by Agent.

Checkout success/cancel are derived ONLY from ORANGERANK_CHECKOUT_ORIGIN plus `/checkout/success` or `/checkout/cancel`. For Preview, browser origin and server origin must match that exact stable alias; no weakening/proxy bypass is added.

## Sandbox acceptance procedure / exact evidence

1. Review PR; retain existing Production hard blocks. Set Preview branch configuration and signing secret privately for this branch, redeploy branch. Confirm Preview identity and current commit.
2. Before spending another test payment, inspect prior Stripe event's delivery history. Record only sanitized event ID, destination environment, HTTP status and fixed error code. Retry delivery of an existing event only after matching its original Price, assessment Redis DB and Session are confirmed. Unknown old assessments must go to REVIEW, not create invented intake.
3. For a new full acceptance run use dummy intake through stable branch `/get-your-orange-score`. Verify server validation rejects missing required fields, and valid intake creates one pending Redis record and Stripe test Session referencing configured $149 USD Price and fixed metadata. Retry same submission; verify no duplicate assessment/session.
4. Complete a real Stripe Sandbox test payment. Browser redirect is NOT evidence of confirmation. Inspect actual Stripe event delivery and Vercel webhook logs: signature accepted (no SIGNATURE rejection), durable result CONFIRMED. Privately verify Redis verified_payment/session/reference, one NEW→PAYMENT_CONFIRMED history, one pending outbox. Capture sanitized IDs/status/counts only.
5. Redeliver same real event and a second event for same Session: no extra transition/outbox/work. Exercise unpaid/delayed success with supported Sandbox method; do not confirm before paid. Test amount/metadata mismatch in isolated dummy assessment: REVIEW only. Simulate Redis/transient provider failure and verify Stripe retries with eventual one transition.
6. Owner deploys REAL authenticated receiver adapter to existing Chief of Staff/ledger system, approves payload mapping, and establishes durable receiver-side deduplication before enabling Preview handoff. Configure protected receiver/dispatch credentials, no secrets in browser. Trigger internal single-item dispatch or owner scheduler scan. Confirm acknowledgement only after real Sheets row and existing workflow enqueue are durable.
7. Validate actual Sheets row by Assessment ID, workflow acceptance/run ID, and eventual real Drive/report artifacts through owner access. No artifact links are fabricated here. Interrupt receiver after acceptance before sender ack; retry after lease expiry and confirm the same assessment creates NO duplicate ledger row/work. Interrupt receiver before acceptance; verify RETRY_PENDING then recovery. Wrong ack/ledger refusal must not change current_status or mark work started.
8. Record actual Sandbox pass/fail table. Do not call automated mocks an actual Stripe delivery. Stop before live-key activation.

## Launch blockers (all must be cleared)

- [ ] Confirm old failure via Stripe destination delivery history; correct origin/environment routing.
- [ ] Real Sandbox signed delivery, Redis durability and duplicate/redelivery evidence.
- [ ] REAL Chief of Staff receiver and approved mapping/auth/idempotency.
- [ ] Owner scheduler/drain configured and lost-ack/retry recovery verified.
- [ ] Actual Google Sheets schema/upsert and one-row evidence, Drive/report artifacts verified.
- [ ] Old outbox reconciliation and Redis retention/eviction/backups policy.
- [ ] Legal/privacy drafts approved for actual data recipients/storage.
- [ ] Separately reviewed Production receiving/configuration deployment policy; canonical domain destination configured only when enabled safely.
- [ ] Separately authorized live payments (NOT part of this PR).

Automated coverage is simulated Stripe/provider responses plus real Stripe signing logic and actual Lua scripts in Fengari. No Stripe Sandbox event or real external receiver/Sheets/Drive operation was executed by this Agent. The runtime cannot call deployment URLs; no direct Stripe/Google account tools exist. Owner acceptance evidence is indispensable.
