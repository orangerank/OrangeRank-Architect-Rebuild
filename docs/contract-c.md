# Contract C — any Stripe sandbox checkout

Contract A (`mode=validation_only` on the Grok routine webhook) stays blocked. A paid sandbox checkout does not call that webhook. Production still disables Grok configuration. Contract B (`orangerank-handoff-v1`) still requires `verified_payment.livemode=true`. A test-mode payment that reaches B fails with `SYNTHETIC_QUARANTINE` before an outbox claim, ledger write, or handoff. Live Contract B behavior is unchanged.

Contract C accepts any verified sandbox payment from the real intake and checkout flow. The assessment id must match `OR-YYYYMMDD-SLUG` and the intake submission id must be a UUID. There is no hardcoded business pair and no pre-provisioned authorization record. `checkout.session.completed` (and the async paid event) on the Stripe webhook confirms the payment, then dispatches Contract C when `livemode` is false. Live mode does not take this path.

The payload uses the Contract B field mapping with `contract_version` `orangerank-test-handoff-v1`, `execution_mode` `TEST_MODE`, `assessment_payment_status` `PAYMENT_PENDING`, `required_artifact_label` `TEST MODE`, `stop_at` `HUMAN_APPROVAL`, `business_contact_allowed` false, `customer_delivery_allowed` true, `delivery_requires_human_approval` true, and a copy of `stripe_source_evidence`. After QA, delivery to the form's `customer_email` still waits for owner approval. The business itself is not contacted. Stored services text is copied as received, including `&amp;`. The source payment record is not rewritten and is not represented as live revenue.

Dispatch claims one attempt per assessment id. A read before that claim does not prove single use, and the local marker does not prove the receiver ran the work only once. Missing, unreadable, incomplete, duplicate, or ambiguous prior-use evidence stops execution. An uncertain transport result is held and is not resent. No handoff or Grok request was sent by this change.

The handoff URL and token still come from the existing Preview receiver configuration. This change does not set environment variables. If that receiver is not configured, the confirmed payment stays `PENDING_INTEGRATION` and nothing is sent.
