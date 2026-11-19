import type Stripe from 'stripe'
import type { Redis } from '@upstash/redis'
import { template } from './core'
import { checkoutSessionExpand, confirmationFor, type PaidRecord } from './payments'
import { replayScript } from './payment-store'
import { dispatchAssessment, receiverConfiguration } from '../handoff/dispatch'
import { dispatchContractC } from '../handoff/contract-c'
import { grokConfiguration } from '../handoff/grok'

const eventPattern = /^evt_[A-Za-z0-9]+$/
const assessmentPattern = /^OR-\d{8}-[A-Z0-9-]{1,80}$/
const submissionPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export type ReplayStripe = {
  events: { retrieve: (id: string) => Promise<Stripe.Event> }
  checkout: { sessions: { retrieve: (id: string, params: {expand: string[]}) => Promise<Stripe.Checkout.Session> } }
}
export type ReplayResult = { result: string, handoff?: string, reason?: string }
type Stored = { raw: string, record: PaidRecord }

function stored(raw: unknown): Stored | null {
  if (typeof raw !== 'string' || !raw) return null
  try { return { raw, record: JSON.parse(raw) as PaidRecord } } catch { return null }
}
export function replayEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const email = value.trim()
  if (!email || email.length > 200 || !emailPattern.test(email) || /[\u0000-\u001f]/.test(email)) return null
  return email
}
async function loadSession(stripe: ReplayStripe, eventId: string, live: boolean): Promise<{result:'MISSING_SESSION'|'REJECTED'} | {event: Stripe.Event, session: Stripe.Checkout.Session}> {
  let event: Stripe.Event
  try { event = await stripe.events.retrieve(eventId) } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') return {result:'MISSING_SESSION' as const}
    throw error
  }
  if (event.id !== eventId || event.livemode !== live || event.object !== 'event') return {result:'REJECTED' as const}
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return {result:'REJECTED' as const}
  const object = event.data.object as Stripe.Checkout.Session
  if (object.object !== 'checkout.session' || !(live ? /^cs_live_[A-Za-z0-9]+$/ : /^cs_test_[A-Za-z0-9]+$/).test(object.id)) return {result:'REJECTED' as const}
  let session: Stripe.Checkout.Session
  try { session = await stripe.checkout.sessions.retrieve(object.id, {expand: checkoutSessionExpand}) } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') return {result:'MISSING_SESSION' as const}
    throw error
  }
  if (session.id !== object.id || session.livemode !== live) return {result:'REJECTED' as const}
  return {event, session}
}
/** Re-evaluate one stored review. Does not send. Caller enqueues handoff only after CONFIRMED or ALREADY_CONFIRMED. */
export async function replayRecordedReview(stripe: ReplayStripe, redis: Redis, eventId: string, assessmentId: string, price: string, live: boolean, email?: string, now = new Date()) {
  if (!eventPattern.test(eventId) || !assessmentPattern.test(assessmentId)) return {result:'INVALID_REFERENCE'}
  const loaded = await loadSession(stripe, eventId, live)
  if (!('session' in loaded)) return loaded
  const {event, session} = loaded
  if (session.metadata?.assessment_id !== assessmentId) return {result:'CONFLICT'}
  const submission = session.metadata?.intake_submission_id ?? ''
  if (!submissionPattern.test(submission)) return {result:'INVALID_REFERENCE'}
  const intake = stored(await redis.get<string>(`or:intake:${submission}`))
  if (!intake || intake.record.assessment_id !== assessmentId || intake.record.intake_submission_id !== submission) return {result:'MISSING_ASSESSMENT'}
  const state = await redis.get<string>(`or:stripe:event:${eventId}`)
  const settled = state === 'CONFIRMED' || state === 'DUPLICATE_PAYMENT'
  // A corrected email no longer matches Checkout metadata. Replay of a settled event uses the stored payment.
  if (settled) {
    const payment = intake.record.verified_payment
    if (!payment || payment.event_id !== event.id || payment.checkout_session_id !== session.id || payment.assessment_id !== assessmentId) return {result:'CONFLICT'}
    const decision = {identity_review:'CLEAR' as const, payment, ...(email ? {email_override:email} : {})}
    const result = String(await redis.eval(replayScript, [`or:stripe:event:${eventId}`, `or:intake:${submission}`, `or:handoff:${assessmentId}`, `or:stripe:review:${eventId}`, `or:payment-owner:${payment.payment_reference}`], [JSON.stringify(decision), intake.raw, assessmentId, template]))
    return {result, submission, assessment:assessmentId, livemode:session.livemode}
  }
  if (state !== 'REVIEW' || !await redis.get<string>(`or:stripe:review:${eventId}`)) return {result:'NOT_REVIEW'}
  if (session.payment_status === 'unpaid') return {result:'UNPAID'}
  const confirmed = confirmationFor(session, intake.record, price, live, event, now)
  if (!confirmed) return {result:'REVIEW', reason:'PAYMENT_MISMATCH'}
  const decision = {...confirmed, ...(email ? {email_override:email} : {})}
  const result = String(await redis.eval(replayScript, [`or:stripe:event:${eventId}`, `or:intake:${submission}`, `or:handoff:${assessmentId}`, `or:stripe:review:${eventId}`, `or:payment-owner:${confirmed.payment.payment_reference}`], [JSON.stringify(decision), intake.raw, assessmentId, template]))
  return {result, submission, assessment:assessmentId, livemode:session.livemode}
}
export async function replayAndHandoff(stripe: ReplayStripe, redis: Redis, eventId: string, assessmentId: string, price: string, live: boolean, email?: string, send: typeof fetch = fetch, now = new Date()): Promise<ReplayResult> {
  const outcome = await replayRecordedReview(stripe, redis, eventId, assessmentId, price, live, email, now)
  if (outcome.result !== 'CONFIRMED' && outcome.result !== 'ALREADY_CONFIRMED') return {result:outcome.result, ...(outcome.reason ? {reason:outcome.reason} : {})}
  if (!outcome.submission || !outcome.assessment) return {result:'CONFLICT'}
  let handoff = 'PENDING_INTEGRATION'
  if (live === false && outcome.livemode === false) handoff = await dispatchContractC(redis, outcome.assessment, outcome.submission, receiverConfiguration(), send)
  else if (live === true && outcome.livemode === true && !grokConfiguration()) handoff = await dispatchAssessment(redis, outcome.submission, receiverConfiguration(), send, now)
  const safe = ['TRANSPORT_ACCEPTED','PENDING_INTEGRATION','IDENTITY_MISMATCH','INCOMPLETE_LOOKUP','PRIOR_USE_OR_UNKNOWN','OUTCOME_UNKNOWN','REVIEW','TEST_MODE_UNVERIFIED','INVALID_SOURCE','SYNTHETIC_QUARANTINE','PAYMENT_REVIEW','INCONSISTENT_INTAKE','UNVERIFIED_RECORD','MISSING','INVALID_REFERENCE','BUSY','BACKOFF','STALE_LEASE'].includes(handoff) ? handoff : 'OUTCOME_UNKNOWN'
  return {result:outcome.result, handoff:safe}
}
