import type { Redis } from '@upstash/redis'
import { template } from './core'

// One atomic script: payment state, outbox and event acknowledgement commit together.
// No event expiry: retention requires an explicit owner policy.
export const paymentScript = `
local oldEvent = redis.call('GET', KEYS[1])
if oldEvent then return 'DUPLICATE' end
local raw = redis.call('GET', KEYS[2])
local decision = cjson.decode(ARGV[1])
if not raw then
  redis.call('SET', KEYS[4], ARGV[1])
  redis.call('SET', KEYS[1], 'REVIEW')
  return 'REVIEW'
end
local record = cjson.decode(raw)
-- Compare the exact record read during verification. A concurrent update requires retry.
if raw ~= ARGV[2] then return 'RETRY' end
if decision.review then
  redis.call('SET', KEYS[4], ARGV[1])
  redis.call('SET', KEYS[1], 'REVIEW')
  return 'REVIEW'
end
local owner = redis.call('GET', KEYS[5])
if owner and owner ~= ARGV[3] then
  redis.call('SET', KEYS[4], cjson.encode({review=true, reason='PAYMENT_OWNERSHIP_CONFLICT'}))
  redis.call('SET', KEYS[1], 'REVIEW')
  return 'REVIEW'
end
if record.payment_status == 'PAYMENT_CONFIRMED' and not owner then
  return 'OWNERSHIP_REVIEW'
end
if record.payment_status == 'PAYMENT_CONFIRMED' then
  if record.verified_payment.checkout_session_id ~= decision.payment.checkout_session_id or record.verified_payment.payment_reference ~= decision.payment.payment_reference then
    redis.call('SET', KEYS[4], ARGV[1])
    redis.call('SET', KEYS[1], 'REVIEW')
    return 'REVIEW'
  end
  -- Repair a missing outbox after an infrastructure interruption; never replace it.
  if not redis.call('GET', KEYS[3]) then
    redis.call('SET', KEYS[3], cjson.encode({assessment_id=record.assessment_id, intake_submission_id=record.intake_submission_id, status='PENDING_INTEGRATION', payment=record.verified_payment, methodology_version=record.methodology_version, report_template_version=record.report_template_version}))
  end
  redis.call('SET', KEYS[1], 'DUPLICATE_PAYMENT')
  return 'DUPLICATE_PAYMENT'
end
if record.current_status ~= 'NEW' or record.payment_status ~= 'PENDING' then
  redis.call('SET', KEYS[4], ARGV[1])
  redis.call('SET', KEYS[1], 'REVIEW')
  return 'REVIEW'
end
redis.call('SET', KEYS[5], ARGV[3])
if record.report_template_version == 'V1.2' and ARGV[4] == 'V1.3' then record.report_template_version = ARGV[4] end
record.payment_ownership_verified = true
record.identity_review = decision.identity_review or 'MISSING'
record.payment_status = 'PAYMENT_CONFIRMED'
record.current_status = 'PAYMENT_CONFIRMED'
record.verified_payment = decision.payment
record.stripe_checkout_session_id = decision.payment.checkout_session_id
record.handoff_status = 'PENDING_INTEGRATION'
record.transition_history = record.transition_history or {}
table.insert(record.transition_history, {from='NEW', to='PAYMENT_CONFIRMED', at=decision.payment.confirmed_at})
redis.call('SET', KEYS[2], cjson.encode(record))
redis.call('SET', KEYS[3], cjson.encode({assessment_id=record.assessment_id, intake_submission_id=record.intake_submission_id, status='PENDING_INTEGRATION', payment=decision.payment, methodology_version=record.methodology_version, report_template_version=record.report_template_version}))
redis.call('SET', KEYS[1], 'CONFIRMED')
return 'CONFIRMED'
`
export const sessionSaveScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'MISSING' end
local record = cjson.decode(raw)
if record.verified_payment and record.verified_payment.checkout_session_id ~= ARGV[1] then return 'CONFLICT' end
if record.stripe_checkout_session_id and record.stripe_checkout_session_id ~= cjson.null and record.stripe_checkout_session_id ~= ARGV[1] then return 'CONFLICT' end
record.stripe_checkout_session_id = ARGV[1]
redis.call('SET', KEYS[1], cjson.encode(record))
return 'SAVED'
`
export async function saveSession(redis: Redis, submission: string, session: string) {
  const result = await redis.eval(sessionSaveScript, [`or:intake:${submission}`], [session])
  if (result !== 'SAVED') throw new Error('SESSION_SAVE_CONFLICT')
}
export type Payment = { livemode?: boolean; event_id: string; checkout_session_id: string; payment_reference: string; amount: number; currency: string; paid_at: string; confirmed_at: string; assessment_id: string; list_amount?: number; discount_amount?: number; promotion_code?: string | null }
export async function commitPayment(redis: Redis, submission: string, event: string, assessment: string, raw: string | null, decision: { review: boolean; reason?: string; payment?: Payment; identity_review?:string }) {
  return redis.eval(paymentScript, [`or:stripe:event:${event}`, `or:intake:${submission}`, `or:handoff:${assessment}`, `or:stripe:review:${event}`, `or:payment-owner:${decision.payment?.payment_reference ?? "review"}`], [JSON.stringify(decision), raw ?? '',assessment, template])
}
// Resolves one previously persisted REVIEW without opening a second payment. A sent handoff is not rewritten.
export const replayScript = `
local eventState = redis.call('GET', KEYS[1])
local raw = redis.call('GET', KEYS[2])
if not raw then return 'MISSING_ASSESSMENT' end
if raw ~= ARGV[2] then return 'RETRY' end
local record = cjson.decode(raw)
local decision = cjson.decode(ARGV[1])
if record.assessment_id ~= ARGV[3] or not decision.payment then return 'CONFLICT' end
local function handoff_sent(job)
  if not job then return false end
  local parsed = cjson.decode(job)
  local status = parsed.status
  return status == 'TRANSPORT_ACCEPTED' or status == 'ACKNOWLEDGED' or status == 'SEND_INTENT_RECORDED' or status == 'OUTCOME_UNKNOWN' or status == 'CLAIMED_NO_TRANSPORT'
end
local function apply_override(target)
  local override = decision.email_override
  if type(override) ~= 'string' or override == '' then return 'NONE' end
  if target.customer_email == override and (type(target.intake_payload) ~= 'table' or target.intake_payload.email == override) then return 'SAME' end
  if handoff_sent(redis.call('GET', KEYS[3])) then return 'SENT' end
  target.customer_email = override
  if type(target.intake_payload) == 'table' then target.intake_payload.email = override end
  target.identity_review = 'CLEAR'
  return 'APPLIED'
end
local function write_outbox(target)
  if redis.call('GET', KEYS[3]) then return end
  redis.call('SET', KEYS[3], cjson.encode({assessment_id=target.assessment_id, intake_submission_id=target.intake_submission_id, status='PENDING_INTEGRATION', payment=target.verified_payment, methodology_version=target.methodology_version, report_template_version=target.report_template_version}))
end
if eventState == 'CONFIRMED' or eventState == 'DUPLICATE_PAYMENT' then
  if record.payment_status ~= 'PAYMENT_CONFIRMED' or not record.verified_payment then return 'CONFLICT' end
  if record.verified_payment.event_id ~= decision.payment.event_id or record.verified_payment.checkout_session_id ~= decision.payment.checkout_session_id then return 'CONFLICT' end
  local changed = apply_override(record)
  if changed == 'SENT' then return 'ALREADY_DISPATCHED' end
  if changed == 'APPLIED' then redis.call('SET', KEYS[2], cjson.encode(record)) end
  write_outbox(record)
  return 'ALREADY_CONFIRMED'
end
if eventState ~= 'REVIEW' or not redis.call('GET', KEYS[4]) then return 'NOT_REVIEW' end
if record.payment_status == 'PAYMENT_CONFIRMED' then
  if record.verified_payment and record.verified_payment.checkout_session_id == decision.payment.checkout_session_id and record.verified_payment.payment_reference == decision.payment.payment_reference then
    local changed = apply_override(record)
    if changed == 'SENT' then return 'ALREADY_DISPATCHED' end
    if changed == 'APPLIED' then redis.call('SET', KEYS[2], cjson.encode(record)) end
    write_outbox(record)
    redis.call('SET', KEYS[1], 'DUPLICATE_PAYMENT')
    redis.call('SET', KEYS[4], 'REPLAYED')
    return 'ALREADY_CONFIRMED'
  end
  return 'CONFLICT'
end
if record.current_status ~= 'NEW' or record.payment_status ~= 'PENDING' then return 'CONFLICT' end
local owner = redis.call('GET', KEYS[5])
if owner and owner ~= ARGV[3] then return 'CONFLICT' end
if record.report_template_version == 'V1.2' and ARGV[4] == 'V1.3' then record.report_template_version = ARGV[4] end
local changed = apply_override(record)
if changed ~= 'APPLIED' then record.identity_review = decision.identity_review or 'MISSING' end
redis.call('SET', KEYS[5], ARGV[3])
record.payment_ownership_verified = true
record.payment_status = 'PAYMENT_CONFIRMED'
record.current_status = 'PAYMENT_CONFIRMED'
record.verified_payment = decision.payment
record.stripe_checkout_session_id = decision.payment.checkout_session_id
record.handoff_status = 'PENDING_INTEGRATION'
record.transition_history = record.transition_history or {}
table.insert(record.transition_history, {from='NEW', to='PAYMENT_CONFIRMED', at=decision.payment.confirmed_at})
redis.call('SET', KEYS[2], cjson.encode(record))
redis.call('SET', KEYS[3], cjson.encode({assessment_id=record.assessment_id, intake_submission_id=record.intake_submission_id, status='PENDING_INTEGRATION', payment=decision.payment, methodology_version=record.methodology_version, report_template_version=record.report_template_version}))
redis.call('SET', KEYS[1], 'CONFIRMED')
redis.call('SET', KEYS[4], 'REPLAYED')
return 'CONFIRMED'
`
