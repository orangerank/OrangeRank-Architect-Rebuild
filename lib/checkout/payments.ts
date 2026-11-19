import type Stripe from 'stripe'
import { listAmount } from './config'
import { acceptedTemplate, methodology, sessionParams, template, type Pending } from './core'
import { commitPayment, type Payment } from './payment-store'
import type { Redis } from '@upstash/redis'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const assessmentPattern = /^OR-\d{8}-[A-Z0-9-]{1,80}$/
const promotionCodePattern = /^[A-Za-z0-9-]{1,500}$/
const promotionIdPattern = /^promo_[A-Za-z0-9]+$/
// Retrieved session only. Breakdown discount objects and the session discounts array are the two expandable sources for the customer-facing code.
export const checkoutSessionExpand = ['payment_intent', 'line_items', 'total_details.breakdown.discounts.discount', 'discounts.promotion_code']
export type PaidRecord = Omit<Pending, 'payment_status' | 'current_status'> & {payment_status: string; current_status: string; verified_payment?: Payment}
type Quote = { amount: number; discount: number; code: string | null }
type PromoRef = string | { id?: string; code?: string } | null | undefined

function readPromo(promo: PromoRef, known: Map<string, string>, pending: Set<string>): boolean {
  if (promo == null) return true
  if (typeof promo === 'string') {
    if (!promotionIdPattern.test(promo)) return false
    pending.add(promo)
    return true
  }
  if (typeof promo.id !== 'string' || typeof promo.code !== 'string') return false
  const code = promo.code.trim()
  if (!promotionCodePattern.test(code)) return false
  known.set(promo.id, code)
  return true
}
/** Customer-facing code from expanded breakdown discounts and session discounts. Undefined means a code was present but could not be read. */
export function promotionCodeFromSession(session: Stripe.Checkout.Session): string | null | undefined {
  const known = new Map<string, string>()
  const pending = new Set<string>()
  for (const row of session.discounts ?? []) {
    if (!readPromo(row.promotion_code, known, pending)) return undefined
  }
  for (const row of session.total_details?.breakdown?.discounts ?? []) {
    const discount = row.discount as Stripe.Discount | string
    if (!discount || typeof discount === 'string') continue
    if (!readPromo(discount.promotion_code, known, pending)) return undefined
  }
  for (const id of pending) if (!known.has(id)) return undefined
  const codes = new Set(known.values())
  if (codes.size > 1) return undefined
  return [...codes][0] ?? null
}
function quoted(session: Stripe.Checkout.Session): Quote | null {
  if (session.currency !== 'usd' || session.amount_subtotal !== listAmount) return null
  const amount = session.amount_total
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0 || amount > listAmount) return null
  const discount = listAmount - amount
  const details = session.total_details
  if ((details?.amount_tax ?? 0) !== 0 || (details?.amount_shipping ?? 0) !== 0) return null
  if (!details) {
    if (discount !== 0) return null
  } else if (!Number.isInteger(details.amount_discount) || details.amount_discount !== discount) return null
  const rows = details?.breakdown?.discounts
  if (rows?.length) {
    let sum = 0
    for (const row of rows) {
      if (typeof row.amount !== 'number' || !Number.isInteger(row.amount) || row.amount < 0) return null
      sum += row.amount
    }
    if (sum !== discount) return null
  }
  const code = promotionCodeFromSession(session)
  if (code === undefined) return null
  if (amount === 0 && !code) return null
  return { amount, discount, code }
}
function metadataMismatch(actual: Stripe.Metadata | null | undefined, expected: Record<string, string>, issued: string): boolean {
  return Object.entries(expected).some(([key, value]) => {
    const got = actual?.[key]
    if (key !== 'report_template_version') return got !== value
    if (got === issued) return false
    // Confirm stamps V1.2 records forward to V1.3; the Checkout Session metadata stays as issued.
    return !(issued === template && got === 'V1.2')
  })
}
function mismatch(session: Stripe.Checkout.Session, record: PaidRecord, price: string, live: boolean): boolean {
  const expected = sessionParams(record as Pending).metadata
  const quote = quoted(session)
  if (!quote || session.livemode !== live || session.status !== 'complete' || session.mode !== 'payment') return true
  if (record.price !== price || record.methodology_version !== methodology || !acceptedTemplate(record.report_template_version)) return true
  if (session.client_reference_id !== record.assessment_id) return true
  if (Boolean(record.stripe_checkout_session_id) && record.stripe_checkout_session_id !== session.id) return true
  if (metadataMismatch(session.metadata, expected, record.report_template_version)) return true
  if (session.line_items?.data?.length !== 1 || session.line_items.data[0].quantity !== 1 || session.line_items.data[0].price?.id !== price) return true
  // Stripe basil can mark a fully discounted Checkout Session paid while leaving payment_intent null.
  if (quote.amount === 0) {
    const settled = session.payment_status === 'paid' || session.payment_status === 'no_payment_required'
    return !settled || session.payment_intent != null || !quote.code || quote.discount !== listAmount
  }
  if (session.payment_status !== 'paid') return true
  const intent = session.payment_intent
  if (!intent || typeof intent === 'string' || !/^pi_[A-Za-z0-9]+$/.test(intent.id)) return true
  if (intent.livemode !== live || intent.status !== 'succeeded' || intent.amount !== quote.amount || intent.amount_received !== quote.amount || intent.currency !== 'usd') return true
  return metadataMismatch(intent.metadata, expected, record.report_template_version)
}
export function confirmationFor(session: Stripe.Checkout.Session, record: PaidRecord, price: string, live: boolean, event: {id: string, created: number}, now: Date) {
  const quote = quoted(session)
  if (!quote || mismatch(session, record, price, live)) return null
  const intent = session.payment_intent
  const reference = quote.amount === 0 ? session.id : (intent as Stripe.PaymentIntent).id
  const presented = session.customer_details?.email
  const identity_review = !presented ? 'MISSING' as const : presented.trim().toLowerCase() !== record.customer_email.trim().toLowerCase() ? 'MISMATCH' as const : 'CLEAR' as const
  return {identity_review, payment:{livemode:session.livemode,event_id:event.id,checkout_session_id:session.id,payment_reference:reference,amount:quote.amount,list_amount:listAmount,discount_amount:quote.discount,promotion_code:quote.code,currency:'usd' as const,paid_at:new Date(event.created*1000).toISOString(),confirmed_at:now.toISOString(),assessment_id:record.assessment_id}}
}
/** Legacy full-price rows omit discount fields. A reduced amount is valid only with the stored list, discount, and code from the retrieved session. */
export function paymentFacts(payment: Payment): { amount: number; list_amount: number; discount_amount: number; promotion_code: string | null } | null {
  if (payment.currency !== 'usd' || !Number.isInteger(payment.amount) || payment.amount < 0 || payment.amount > listAmount) return null
  const legacy = payment.list_amount === undefined && payment.discount_amount === undefined && payment.promotion_code == null
  if (legacy) {
    if (payment.amount !== listAmount) return null
    return { amount: payment.amount, list_amount: listAmount, discount_amount: 0, promotion_code: null }
  }
  const discount = payment.discount_amount
  if (payment.list_amount !== listAmount || typeof discount !== 'number' || !Number.isInteger(discount) || discount < 0 || payment.amount + discount !== listAmount) return null
  const code = payment.promotion_code ?? null
  if (code !== null && !promotionCodePattern.test(code)) return null
  if (payment.amount === 0 && (discount !== listAmount || !code)) return null
  return { amount: payment.amount, list_amount: listAmount, discount_amount: discount, promotion_code: code }
}
export async function processPayment(event: Stripe.Event, stripe: Pick<Stripe, 'checkout'>, redis: Redis, price: string, now = new Date(), stage: (value: string)=>void = ()=>{}, live=false) {
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return 'IGNORED'
  if (event.livemode!==live) return 'REJECTED'
  const object = event.data.object as Stripe.Checkout.Session
  if (object.object !== 'checkout.session' || !(live?/^cs_live_[A-Za-z0-9]+$/:/^cs_test_[A-Za-z0-9]+$/).test(object.id)) return 'REJECTED'
  // Never use browser callbacks or the webhook's supplied payment fields as authority.
  stage('STRIPE_SESSION_RETRIEVAL')
  let session: Stripe.Checkout.Session
  try { session = await stripe.checkout.sessions.retrieve(object.id, {expand: checkoutSessionExpand}) } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'resource_missing') return commitPayment(redis, 'unknown', event.id, 'unknown', null, {review:true,reason:'UNKNOWN_STRIPE_SESSION'})
    throw error
  }
  if (session.id !== object.id || session.livemode!==live) return 'REJECTED'
  // Delayed/unpaid completion is not acknowledged as paid. A later success event can confirm it.
  if (session.payment_status === 'unpaid') return 'UNPAID'
  const submission = session.metadata?.intake_submission_id ?? ''
  const assessment = session.metadata?.assessment_id ?? ''
  if (!uuid.test(submission) || !assessmentPattern.test(assessment)) {
    return commitPayment(redis, 'unknown', event.id, 'unknown', null, {review:true,reason:'INVALID_REFERENCE'})
  }
  stage('REDIS_ASSESSMENT_READ')
  const raw = await redis.get<string>(`or:intake:${submission}`)
  const record: PaidRecord | null = raw ? JSON.parse(raw) : null
  stage('PAYMENT_VALIDATION')
  const confirmed = record && record.assessment_id === assessment && record.intake_submission_id === submission ? confirmationFor(session, record, price, live, event, now) : null
  if (!confirmed) {
    return commitPayment(redis, submission, event.id, assessment, raw, {review:true,reason:record ? 'PAYMENT_MISMATCH' : 'UNKNOWN_ASSESSMENT'})
  }
  stage('REDIS_PAYMENT_COMMIT')
  return commitPayment(redis, submission, event.id, assessment, raw, {review:false,...confirmed})
}
