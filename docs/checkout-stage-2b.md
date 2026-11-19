# Stage 2B — Sandbox verified payment foundation (not launch-ready)

Historical foundation guide. For the consolidated dispatcher, current environment inventory and acceptance/launch gates, see [assessment-workflow.md](./assessment-workflow.md).

## Inspection: exists versus missing

Base: latest main `edb66ce`. Stage 2A is `app/api/checkout/route.ts`, `lib/checkout/core.ts`, `lib/checkout/store.ts`; Stripe 23.x is already installed. Pending Redis records contain validated intake, NEW/PENDING state, Assessment ID, UUID submission ID, fixed versions, trusted origin/price, fingerprint and optional Stripe Session ID. Session/PaymentIntent metadata already includes product, ledger version, methodology/template versions and assessment/submission references plus business/email/website. Browser return pages do not confirm payment. PR #5 diagnostics use Preview-only allowlisted stage logs; they are preserved.

No Chief of Staff receiver, specialist orchestration, Google Sheets client/ledger schema, callable handoff credentials or endpoint exists in this repository. Read-only Vercel inspection returned no project marketplace resources and no team marketplace installations; the account integration-configuration API also returned zero configurations. This does not prove the owner's bot team does not exist elsewhere; it means there is no demonstrable callable integration available here. No replacement bot workflow or invented endpoint was created.

## Endpoint and verification

`POST /api/stripe/webhook` is server-only. It keeps Production blocked and accepts only enabled test-key configuration. `STRIPE_WEBHOOK_SECRET` is a server-only placeholder in `.env.example`, never NEXT_PUBLIC.

The untouched request bytes and Stripe-Signature are checked by Stripe's `constructEvent`. Signed malformed envelopes are rejected. Only `checkout.session.completed` and `checkout.session.async_payment_succeeded` are processed. Live events are ignored/rejected without work. Unsupported events are acknowledged without work.

Retrieve the authoritative test Checkout Session with expanded PaymentIntent and line items. Require paid/complete, payment mode, exactly USD 14900, matching configured price/quantity, succeeded test PaymentIntent with matching received amount/currency, matching assessment/submission/client reference and all existing Session/PaymentIntent metadata (including fixed versions and product). Delayed unpaid events cannot confirm anything; await a later payment-success event. No origin check applies to Stripe webhooks (Stripe is not a browser); checkout's existing exact-origin checks are unchanged.

Permanent mismatches and unknown assessments are durably held in `or:stripe:review:<event>` with reason and review flag; existing assessment data/state is never overwritten by a review. The event is acknowledged only after review persistence. No work starts. Missing Stripe Session (`resource_missing`) is also a permanent review. Configuration/provider/Redis failures and compare-and-swap conflicts return 503 for Stripe retry. Missing/invalid signatures or malformed envelopes return 400; oversized bodies return 413. Webhook bodies and exceptions are never logged or returned. Logs contain only fixed stages and allowlisted outcomes.

## Durable state and recovery

Redis remains authoritative; no Google Sheets schema is invented. Existing intake storage is extended with `verified_payment` (event/session/payment references, USD amount, paid-event timestamp, confirmation timestamp, assessment), transition_history, and handoff_status.

One Redis Lua invocation performs a byte-exact compare-and-swap against the verified record snapshot, transitions NEW/PENDING → PAYMENT_CONFIRMED, persists the verified Session ID, creates one `or:handoff:<assessment>` outbox entry, then acknowledges `or:stripe:event:<event>`. The script is executed serially by Redis: concurrent duplicates cannot both transition the assessment. Event/outbox keys have no expiry. Different events for the same verified session acknowledge duplicate payment without adding history or work. A second different payment/session goes to review; approved/completed/unexpected states are not downgraded.

Before-commit failures can retry. A lost response after commit replays as duplicate. Concurrent record changes return RETRY without event acknowledgment. For a confirmed assessment, a different event for the same session can repair a missing outbox before acknowledgement; an existing outbox is not replaced. Checkout's later Session-ID persistence now atomically updates only that field instead of replacing the entire record, preventing a racing checkout retry from erasing verified payment state.

Infrastructure requirement: a durable, non-evicting Redis service with backups and sufficient memory. Lua execution prevents concurrent interleaving but Redis scripts are NOT rollback transactions after an internal runtime/storage error. Scripts use controlled JSON/GET/SET operations; malformed stored JSON/infrastructure errors must be investigated, not manually cleared. Payment/event/outbox keys require an operator reconciliation/retention policy; no automated expiry, dispatcher or reconciliation scheduler is introduced. Hosted Redis integration and partial infrastructure failures still require owner verification.

## Explicit handoff dependency

State after confirmation: `current_status=PAYMENT_CONFIRMED`, `payment_status=PAYMENT_CONFIRMED`, `handoff_status=PENDING_INTEGRATION`. Outbox status is PENDING_INTEGRATION. No processing/complete state is fabricated.

The outbox references the authoritative assessment and stores verified payment plus fixed versions, NOT another full intake copy. Required next work: owner provides the actual Chief of Staff callable contract, authentication, approved intake-field mapping and a receiver-side idempotency contract keyed by Assessment ID. Implement a durable consumer that reads the existing approved intake record, sends only approved intake fields, Assessment ID, verified payment reference and fixed versions, and records receiver acknowledgement. On transient failure retain/retry the same outbox item; after restart resume pending items. A recoverable dispatcher and receiver deduplication must be tested before external work is enabled. Exactly-once external delivery is NOT claimed. No card data or Stripe secrets may be handed off. Google Sheets ledger mapping/authentication is separate work and must use the owner's real schema.

## Owner Sandbox setup (no Production changes)

1. Review PR and use a Preview deployment/branch with its stable alias. Keep checkout origin equal to that alias and all existing Stage 2A test settings. This PR does not change environment values or deploy Production.
2. Stripe Dashboard: select the matching Sandbox → Workbench → Webhooks → Add destination. Select ONLY `checkout.session.completed` and `checkout.session.async_payment_succeeded`, destination type Webhook endpoint, URL `https://<stable-preview-alias>/api/stripe/webhook`. Use the account's current compatible API version and validate expanded Session/Intent fields during testing.
3. Add the destination signing secret as `STRIPE_WEBHOOK_SECRET` in Vercel → OrangeRank → Settings → Environment Variables, Preview only (prefer branch scope). Store it through the dashboard's protected input, never chat/Git. Redeploy that same branch as Preview to apply it.
4. Stripe must be able to reach the endpoint without Vercel authentication. If Preview deployment protection blocks delivery, owner must arrange an appropriately secured webhook-access mechanism; do not disable protection broadly or expose bypass credentials. This PR makes no protection changes.
5. Use dummy intake and a Stripe Sandbox test payment. Verify the signed event receives 200, one Redis transition and one pending outbox exist, and a browser success redirect alone does not alter state. Redeliver the same Stripe event and verify no duplicate transition/work. Exercise delayed/unpaid events, bad metadata and transient Redis interruption in Sandbox.
6. Do not enable live keys or Production checkout. Payment verification is not fulfillment/launch readiness. Legal/privacy drafts still require owner approval; they remain unchanged.

References: https://docs.stripe.com/checkout/fulfillment and https://docs.stripe.com/webhooks/handling-payment-events

## Validation scope

Automated tests use Stripe's real signing/verification implementation with dummy secrets, mocked provider responses, and execute the actual Lua scripts in the Fengari Lua VM against simulated Redis GET/SET semantics. This validates application logic and serial script execution, not actual Upstash durability/network behavior. Existing checkout tests remain included. No real Sandbox payment, webhook destination setup, hosted Redis EVAL validation, Chief of Staff delivery, or Google Sheets write was performed by this Agent. External handoff failure/recovery cannot be tested while the receiver/consumer is missing; tests prove the pending item is retained and never invokes a fabricated receiver.
