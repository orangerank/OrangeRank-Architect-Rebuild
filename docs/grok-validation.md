# Grok Routine connection — validation only

Extends PR #7; no replacement checkout, bot workforce or ledger. The existing signed Stripe webhook, USD 149 validation, payment/event deduplication and retryable outbox remain authoritative. Production remains blocked.

## Retrieve the real trigger (not another search of the same schedule screen)

Official routine documentation: https://cursor.com/help/grok-bot/routines and https://docs.x.ai/grok-bot/skills-routines-and-automations . A saved scheduled routine is not necessarily webhook-enabled. The supported action is to ask the owning Bot in chat:

“Add a webhook trigger to the EXISTING OrangeRank Paid Assessment Webhook routine. Keep it validation-only; do not create a duplicate routine, change its schedule, write the production ledger, call specialists, or start assessments.”

Then open that same routine on desktop. Its Webhook section should expose POST to, key, and full header. Documentation specifies `Authorization: Bearer <key>`. If the trigger was already added but these fields remain absent, this Agent has no Grok account-management tool to retrieve them. Contact the platform's support with the routine identity and request webhook-trigger provisioning/credential access; do NOT guess a URL/key or repeatedly search the unchanged schedule screen. No documented alternate retrieval API was found in the retrieved sources.

A 200 only means Grok accepted a call and started a Routine run; it does not mean validation finished. View Routine chat/run history for the result. No receiver ledger acknowledgement is inferred from 200.

## Configuration / operation

Preview only, server-only protected inputs:
- ORANGERANK_GROK_VALIDATION_ENABLED: explicit true only for this validation-only routine.
- ORANGERANK_GROK_ROUTINE_URL: actual POST to field, HTTPS without embedded credentials/query.
- ORANGERANK_GROK_SENDER_KEY: actual sender key, never chat/Git/browser.
- ORANGERANK_GROK_AUTH_FORMAT: bearer (documented format only; unsupported formats fail closed).
- ORANGERANK_HANDOFF_ENABLED: false. Grok validation and production handoff are mutually exclusive.
- ORANGERANK_DISPATCH_SECRET: existing >=32-character internal dispatch authentication.

Use existing authenticated `/api/internal/assessment-handoff` single-submission or cursor drain after signed payment confirmation. No direct client invocation and no new webhook endpoint. Routine JSON includes mode validation_only, instructions forbidding ledger/bots/start/delivery, stable idempotency_key, verified payment references/fixed versions and original validated intake field names. No full Stripe objects/credentials are forwarded.

New records persist allowlisted original validated intake as intake_payload, preserving blank url0–url4 positions (the old additional_urls array compressed empty entries). Legacy records lacking that payload are NOT reconstructed or silently sent; owner must reconcile the original intake from an approved source. Do not invent missing URL positions or bypass verification.

A 200 records validation_status=VALIDATION_ACCEPTED on the outbox only; its production status stays PENDING_INTEGRATION and assessment state stays PAYMENT_CONFIRMED. Duplicate dispatch skips already accepted validation. Authentication/network failures retain retryable state/backoff; no response bodies/errors are logged. Crashes after remote acceptance before local persistence may resend. Grok documentation does NOT promise receiver idempotency: idempotency_key in the body is an instruction/reference, not a platform guarantee. Duplicate validation runs remain possible after ambiguous failures. This must never activate ledger writes or production work. Owner must keep the Routine's actual instructions in validation-only mode; a payload instruction alone is not enforcement of remote behavior.

## Existing Google Sheets preparation — read-only, no schema invention

No existing Sheets connector/code, spreadsheet ID, tab/header schema, Grok connector access or Google credentials are available in repository/Vercel integration reads. Therefore no production row can be mapped or read honestly yet. Do not create a replacement Sheet.

Shortest option: owning Grok Bot's supported connectors/Marketplace connection to the EXISTING Control Ledger, authorized by owner. First grant read-only access and inspect exact spreadsheet ID, tab, header row, Assessment ID uniqueness rule, status transitions and protected columns. Supply non-secret schema documentation to this PR before mapping writes. Alternative is existing Google Sheets API OAuth/service identity with `spreadsheets.readonly` and file access to that same spreadsheet. Official scopes: https://developers.google.com/workspace/sheets/api/scopes . No new Google credential variables or write API are introduced without an actual chosen connection/schema. Required missing items: existing ledger file identity + approved headers/status mapping + supported authenticated read access; obtain from ledger owner/Google sharing and owning Bot connector settings.

## Acceptance / limitations

Automated tests exercise original payload mapping/blank URL preservation, arbitrary-field exclusion, missing config, real documented bearer format, 401/403, duplicate suppression and retry recovery. Existing Stripe duplicate/signature/payment tests remain included. These are simulated transports/Lua tests, NOT an actual Grok run or Stripe Sandbox event.

Owner configures actual trigger URL/key privately, redeploys SAME Preview branch, then dispatches a dummy paid assessment through the existing protected route. Inspect real HTTP 200 and Grok validation result in chat; verify ledger unchanged, no specialist calls and no assessment started. Record sanitized HTTP status/validation output only, never intake PII/key. Real request/response and validation completion are unverified by this Agent. Sheets/Drive/report production workflow remains unconnected; launch readiness is not claimed.

## Owner-confirmed contract update

This section supersedes the older variable/payload instructions above. Read only `GROK_ROUTINE_WEBHOOK_URL` and `GROK_ROUTINE_WEBHOOK_KEY`; use owner-confirmed `Authorization: Bearer <key>`. Presence of both valid protected Preview values opts into automatic VALIDATION-ONLY dispatch after a durable confirmed-payment result (including duplicate replay). ORANGERANK_HANDOFF_ENABLED must stay false; Production remains hard blocked. Old ORANGERANK_GROK_* flags are not used.

Payload now uses required top-level assessment_id/customer_name/customer_email/business_name/website/business_category/primary_city/primary_state/primary_service_area/main_services/terms_accepted/terms_accepted_at and payment provider/status/stripe_event_id/checkout_session_id/payment_intent_id/amount/currency/paid_at/signature_verified. mode remains validation_only. Optional original fields are preserved under optional_intake. Missing required serviceArea (optional in the website but required by this Routine) yields INVALID_ROUTINE_INTAKE; no inferred city/service-area value. New records capture terms_accepted_at server-side when accepted intake is reserved; old records lacking original intake or a documented acceptance timestamp cannot be silently migrated. Capture timestamp is server receipt/reservation time, not invented browser interaction time.

Webhook signature verification and authoritative Stripe validation precede Redis confirmation/outbox creation. Grok dispatch then reads that verified record. HTTP200 changes only outbox validation_status, not assessment/current production status. Retryable transport/auth failures return503 so Stripe can retry its existing verified event; event payment deduplication remains committed and retry re-enters dispatch without another payment transition. The authenticated dispatcher remains available for outbox recovery. Receiver-side idempotency is not documented, so a lost response can cause duplicate validation runs (never production work).

Safe single Sandbox acceptance run: update PR#7 Preview deployment to this revision with existing protected Grok URL/key, valid exact checkout branch origin, Sandbox price/key/signing secret and matching Redis DB. Use stable alias /get-your-orange-score with DUMMY intake, fill service-area and all required fields, accept terms. Complete one Sandbox payment; inspect signed Stripe delivery, Vercel DURABLE_PAYMENT=CONFIRMED and GROK_VALIDATION_DISPATCH=VALIDATION_ACCEPTED, then inspect actual Grok run's validation outcome. Confirm no ledger write/specialist invocation/assessment start. Redeliver same Stripe event to verify dispatch skip and unchanged history/outbox count. No real response has been received by Agent; acceptance remains owner verification. Do not send old incomplete records or enable Production.

## Minimal validation alignment follow-up

Service area is now required in both the existing browser/server intake validation BEFORE payment. Services free text is sent unchanged as ONE main_services list item; commas/newlines are not interpreted. No historical customer values or terms timestamps are backfilled.

Immediately before Grok transport, `routineIssues` emits only fixed field names plus missing/wrong_type/invalid statuses, never values or IDs. Incomplete records do not dispatch. Existing protected internal endpoint additionally accepts `{ "audit_submission_id":"<existing UUID>" }` and returns only AUDIT_ONLY plus value-free issues. This branch requires its existing server-side dispatch authorization, is Production-blocked, and only reads Redis: no leases, writes, replay, Stripe call or Grok transport. Obtain the existing UUID privately from the Stripe Session intake_submission_id metadata or owner Redis console; never create another payment. Agent cannot invoke deployment URLs or inspect protected Redis directly, so the historical assessment's exact defects remain unverified until this authenticated read-only audit is performed. Do not send the dispatch body instead of audit_submission_id.

If only services mapping was wrong, no additional customer data is needed; if service area or another original field is genuinely absent, obtain that actual value under an approved process. Missing historical terms timestamp requires evidence, not assigning a new invented timestamp. Preserve validation-only lock and do not dispatch until reconciled and separately authorized.

## Separate audit credential (supersedes shared dispatch audit authentication)

Read-only audit now requires ORANGERANK_AUDIT_SECRET, at least32 characters, VERCEL_ENV exactly preview, and a test Stripe key. Authorization: Bearer <audit-secret>. ORANGERANK_DISPATCH_SECRET no longer authorizes audits; it retains dispatch/drain only. Audit credential permits exactly one JSON field audit_submission_id (valid UUID); any intake_submission_id/cursor/extra operation is rejected before Redis access. Audit identity takes precedence if secrets were accidentally configured equal, preventing dispatch with the audit key. Keep credentials distinct regardless.

Owner setup: independently generate/store audit credential privately in approved password manager. Vercel project Settings→Environment Variables: ORANGERANK_AUDIT_SECRET, Secret type, Preview ONLY, branch vercel-agent/assessment-workflow. No dispatch secret is needed to run an audit. Do not use Grok sender key or Vercel bypass secret as audit identity. Existing Vercel protection still requires its separate protected bypass header. Redeploy SAME Preview branch after adding the variable (existing deployment keeps old values). Never paste credentials in chat/source/browser/logs. No secrets or configuration were created/changed by Agent.

Trusted operator POSTs only {"audit_submission_id":"9b988777-b758-4893-a464-e357c56198d0"} to stable branch /api/internal/assessment-handoff with audit Bearer plus Vercel protection authorization, passing headers privately. Response contains AUDIT_ONLY and fixed field/status issues; no original values/IDs. Read-only branch performs Redis GET only, not outbox claim, write, replay, Stripe/Grok call or drain. Historical record audit not executed here.

## Narrow synthetic Sandbox service-area correction (not executed)

Owner confirmed both stored service-area copies are empty on the known paid dummy record. New POST /api/internal/sandbox-service-area is restricted to VERCEL_ENV=preview/test Stripe key and a distinct ORANGERANK_SANDBOX_CORRECTION_SECRET (>=32 chars), never audit or dispatch identity. Configure privately in Preview, branch vercel-agent/assessment-workflow, only if separately authorizing the correction; redeploy same branch after adding. Agent has NOT added any secret, configured/deployed the operation manually, or changed the record.

Bearer authorization uses that correction secret plus existing private Vercel protection authorization. Exact request:

```json
{"assessment_id":"OR-20261009-ORANGERANK-SANDBOX-BUSINESS","submission_id":"9b988777-b758-4893-a464-e357c56198d0","service_area":"SYNTHETIC TEST: Sandbox-only service region","synthetic_test_value":true}
```

The example is explicitly synthetic validation data, not genuine customer geography. Never use it for a real report/production assessment. No extra fields accepted. Lua verifies exact IDs, reported dummy email/website, confirmed payment/current status and cs_test_ verified Session reference, original intake exists and both copies are empty. It GETs and SETs only the existing intake key, updating service_area/intake_payload.serviceArea and narrowly named correction provenance source/synthetic flag/timestamp. Existing provenance is not overwritten. Payment/consent/identifiers/history/outbox are untouched. Same-value repeat returns ALREADY_CORRECTED without writing. Nonempty/other records fail closed. There is no dispatch/drain/Sheets/Grok call. Responses contain fixed result codes only, not values.

After separately authorized correction, run audit with the separate audit secret; do NOT replay Stripe or dispatch without subsequent approval. No historical consent timestamps are filled. Remove/disable the correction credential after this test reconciliation; do not generalize it to real customers.

## Consolidated safety follow-up (local, not deployed)
Preview audit now emits orangerank_audit/AUDIT_ONLY, issue_count and allowlisted field/status pairs. Zero issues is explicitly logged. Missing/malformed stored records and failures emit AUDIT_UNVERIFIED with null count, not a false clean result; exceptions/raw records are never logged. Audit response and GET-only authorization remain unchanged.

Synthetic safeguard: any service_area_correction provenance (including malformed/false flags), or a SYNTHETIC TEST prefix in either stored service-area copy, quarantines the whole record. Both generic receiverPayload and Grok payload construction throw before transmission; dispatch returns REVIEW before an outbox claim/write or outbound call. Audit reports primary_service_area invalid. This deliberately blocks synthetic validation dispatch too: no receiver schema/lock has been independently verified to safely carry synthetic provenance. No geographic value is inferred, stripped to look real, or promoted; original provenance stays intact. There is no implemented customer report generator here, and quarantined records cannot pass either outbound report/handoff boundary. Future report code must reuse this guard; this is not a guarantee about external systems processing earlier payloads.

Available evidence proves only the application's mode=validation_only and local production guards. Owner-confirmed contract and HTTP 200 do NOT independently prove the remote Routine is locked, side-effect-free or idempotent. Obtain a redacted receiver configuration/export and run evidence showing explicit validation-only enforcement and no Sheets/Drive, report/customer delivery or specialist actions before requesting any dispatch authorization.

Next step: approve deployment of this PR revision to Preview only (publication may itself trigger Git Preview deployment). Then authorize exactly one read-only audit to inspect sanitized logs. No audit/dispatch/replay/drain/external write was executed for this follow-up. Synthetic record stays quarantined; a subsequent end-to-end test needs independently verified receiver lock, genuine dummy test geography with approved provenance contract, and separate dispatch authorization. No Production changes.

## Isolated local fixture validation
The owner-reported HTTP 200 AUDIT_ONLY / primary_service_area=invalid is consistent with the intentional synthetic quarantine: routineIssues marks correction provenance or a synthetic prefix invalid; the value is not accepted as real geography. No additional Redis read was made to reverify the actual value/provenance. Keep that record and provenance unchanged, and expect its audit to remain invalid.

lib/handoff/sandbox-fixture.ts supplies a frozen, exact-schema LOCAL_SYNTHETIC_VALIDATION_ONLY fixture for local structural tests, with no customer/business/payment identifiers, original intake, store or transport. Its only result is LOCAL_FIXTURE_VALIDATED with real_assessment_eligible=false and outbound_eligible=false. It is not a Routine payload or successful assessment audit. Extra fields, changed geography, alternate operation modes or missing provenance fail. Both outbound builders reject it and dispatch cannot claim/write/send it. There is no deployed endpoint, environment switch or quarantine bypass. No report or delivery path is implemented/authorized by this fixture.

This safely tests the local synthetic-workflow boundary, not remote Grok end-to-end acceptance. Remote validation-only enforcement is still independently unverified. Do not dispatch the corrected synthetic record. Next step is review/approval of this local change; any Preview publication/deployment requires separate approval. A remote end-to-end test needs verified receiver isolation and a separately approved fixture contract/path, not reuse of the normal assessment payload or reinterpretation of synthetic geography.
