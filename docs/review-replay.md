# Replay a stored Stripe review

A fully discounted Checkout Session can complete with `payment_status: "paid"`, `payment_intent: null`, and `payment_method_collection: if_required`. Those sessions are confirmed when the retrieved Session is USD, `amount_subtotal` 14900, `amount_total` 0, `total_details.amount_discount` 14900, tax and shipping 0, and exactly one promotion code. `payment_status` may be `paid` or `no_payment_required`. Every other payment check is unchanged.

`checkout.session.completed` for `evt_1UQHEcE0Bkxod3r8Kb7rNyof` was acknowledged and stored as `or:stripe:review:evt_1UQHEcE0Bkxod3r8Kb7rNyof` with `PAYMENT_MISMATCH` because the previous rule required `no_payment_required`. Stripe will not redeliver that event into a new confirmation. The replay route re-reads the stored review, retrieves the live Session, and confirms it only when the current rules pass.

New checkout metadata and the handoff payload use report template `V1.3`. A Session issued as `V1.2` still matches its intake record. Confirmation stamps the stored record to `V1.3` before Contract B is built.

## One-time production replay

Do this only after the deployment that contains this change is serving production. The route is `POST /api/internal/review-replay`. It stays closed until `ORANGERANK_REVIEW_REPLAY_SECRET` is set to at least 32 characters and is different from `ORANGERANK_AUDIT_SECRET` and `ORANGERANK_DISPATCH_SECRET`.

1. Set `ORANGERANK_REVIEW_REPLAY_SECRET` on the Vercel Production environment through the protected input. Redeploy that same production deployment so the function can read it.
2. Confirm `ORANGERANK_HANDOFF_ENABLED=true` and the Contract B URL and token are the live receiver. If they are off, the route still confirms payment and leaves `or:handoff:OR-20261013-THE-POST-SPORTS-BAR-GRILL` at `PENDING_INTEGRATION`. A later call sends it.
3. Run the replay. The customer typed `chrisdemko@gmali.com`. The override replaces both stored email copies and marks identity clear. It does not change the Stripe Session.

```bash
curl -sS -X POST 'https://www.getorangerank.com/api/internal/review-replay' \
  -H "Authorization: Bearer $ORANGERANK_REVIEW_REPLAY_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"event_id":"evt_1UQHEcE0Bkxod3r8Kb7rNyof","assessment_id":"OR-20261013-THE-POST-SPORTS-BAR-GRILL","customer_email":"chrisdemko@gmail.com"}'
```

A first success is HTTP 200:

```json
{"result":"CONFIRMED","handoff":"TRANSPORT_ACCEPTED"}
```

The receiver is called with `Idempotency-Key: orangerank-assessment-OR-20261013-THE-POST-SPORTS-BAR-GRILL`. Repeating the same command returns `ALREADY_CONFIRMED` and does not send a second handoff. Webhook and handoff logs in production contain only the fixed stage, result, and sanitized error type. They do not contain the email or the replay secret.

`handoff: "PENDING_INTEGRATION"` means the outbox is waiting for the receiver configuration. Call the route again after enabling it. `ALREADY_DISPATCHED` means a handoff already left with a different email; this route will not rewrite or resend it. `REVIEW` means the retrieved Session still fails the payment checks and nothing was confirmed.

4. Remove `ORANGERANK_REVIEW_REPLAY_SECRET` from Production after the replay and redeploy. Leave it unset in normal operation.
