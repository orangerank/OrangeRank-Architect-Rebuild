# Offline-only payload verification
Run pnpm test (default-deny network guard), or pnpm exec tsx --import ./tests/helpers/network-guard.mjs --test tests/offline-contract.test.mjs . No deployed test endpoint or environment flag exists.

lib/handoff/offline-validation.ts constructs a disposable in-memory paid fixture and exercises the actual grokPayload schema. Payment evidence is explicitly fabricated for unit testing, never persisted or represented as a Stripe payment. No Redis, Stripe or network client is used. Output carries unique test_id, test_mode=offline_only and no-processing instructions. These three fields are PROPOSED local-only fields, NOT confirmed receiver fields. The rest follows docs/grok-validation.md's owner-confirmed contract; actual remote schema remains unverified.

The security boundary is code, not text: all test_id/test_mode/fixture_kind-bearing objects are quarantined at payload builders/dispatch; sendGrokValidation rejects them before transport. This module exposes no send operation. Removing labels to deliberately forge a different object is outside this guarantee. No mocked acceptance proves remote execution, QA, completion or delivery.

Existing retry/duplicate tests cover ambiguous sends and lease recovery. New tests assert POST/JSON/Bearer construction with dummy auth, response statuses, AbortSignal timeout propagation, network errors and unchanged fixture state. No real receiver is contacted.

Production remains blocked. Next prerequisite is independent verification of receiver schema, enforced tool isolation and idempotency/acknowledgement semantics, followed by separately approved test and production-capable implementation. Do not use the quarantined assessment or this local envelope as a live webhook payload.
