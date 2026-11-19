import { timingSafeEqual } from 'node:crypto'
import Stripe from 'stripe'
import { stripeConfiguration } from '@/lib/checkout/config'
import { store } from '@/lib/checkout/store'
import { replayAndHandoff, replayEmail } from '@/lib/checkout/replay'
import { sanitizedProviderError } from '@/lib/checkout/diagnostics'
export const runtime = 'nodejs'
const headers = {'Cache-Control':'no-store'}
const results = new Set(['CONFIRMED','ALREADY_CONFIRMED','ALREADY_DISPATCHED','REVIEW','NOT_REVIEW','CONFLICT','MISSING_ASSESSMENT','MISSING_SESSION','UNPAID','REJECTED','RETRY','INVALID_REFERENCE','UNAUTHORIZED'])
const reasons = new Set(['PAYMENT_MISMATCH'])
function respond(status: number, result: string, handoff?: string, reason?: string) {
  const safe = results.has(result) ? result : 'RETRY'
  return Response.json({result:safe, ...(handoff ? {handoff} : {}), ...(reason && reasons.has(reason) ? {reason} : {})}, {status, headers})
}
function log(result: string, error?: unknown) {
  try { console.info(JSON.stringify({event:'orangerank_review_replay', result: results.has(result) ? result : 'RETRY', ...(error === undefined ? {} : sanitizedProviderError(error)), timestamp:new Date().toISOString()})) } catch { /* logging must not change the replay */ }
}
function authorized(supplied: string) {
  const secret = process.env.ORANGERANK_REVIEW_REPLAY_SECRET
  if (!secret || secret.length < 32 || supplied.length > 1024 || secret === process.env.ORANGERANK_AUDIT_SECRET || secret === process.env.ORANGERANK_DISPATCH_SECRET) return false
  const expected = Buffer.from(`Bearer ${secret}`), actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
export async function POST(request: Request) {
  if (!authorized(request.headers.get('authorization') ?? '')) { log('UNAUTHORIZED'); return respond(401, 'UNAUTHORIZED') }
  let configuration
  try { configuration = stripeConfiguration() } catch { log('RETRY'); return respond(503, 'RETRY') }
  let body: Record<string, unknown>
  try {
    const text = await request.text()
    if (Buffer.byteLength(text) > 2000) return respond(413, 'INVALID_REFERENCE')
    const parsed = JSON.parse(text) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return respond(400, 'INVALID_REFERENCE')
    body = parsed as Record<string, unknown>
  } catch { return respond(400, 'INVALID_REFERENCE') }
  const keys = Object.keys(body).sort()
  const shape = keys.join(',')
  if (shape !== 'assessment_id,event_id' && shape !== 'assessment_id,customer_email,event_id') return respond(400, 'INVALID_REFERENCE')
  if (typeof body.event_id !== 'string' || typeof body.assessment_id !== 'string') return respond(400, 'INVALID_REFERENCE')
  let email: string | undefined
  if ('customer_email' in body) {
    const corrected = replayEmail(body.customer_email)
    if (!corrected) return respond(400, 'INVALID_REFERENCE')
    email = corrected
  }
  try {
    const stripe = new Stripe(configuration.key)
    const outcome = await replayAndHandoff(stripe, store(false), body.event_id, body.assessment_id, configuration.price, configuration.live, email)
    log(outcome.result)
    const status = outcome.result === 'CONFIRMED' || outcome.result === 'ALREADY_CONFIRMED' ? 200 : outcome.result === 'RETRY' ? 503 : 409
    return respond(status, outcome.result, outcome.handoff, outcome.reason)
  } catch (error) { log('RETRY', error); return respond(503, 'RETRY') }
}
