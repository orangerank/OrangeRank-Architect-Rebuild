import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createRequire } from 'node:module'
const Stripe = createRequire(import.meta.url)('stripe')
import { pending, parseIntake, sessionParams } from '../lib/checkout/core.ts'
import { replayAndHandoff, replayEmail } from '../lib/checkout/replay.ts'
import { POST } from '../app/api/internal/review-replay/route.ts'
import { LuaRedis } from './helpers/lua-redis.mjs'
const submission = '7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
const assessment = 'OR-20261013-THE-POST-SPORTS-BAR-GRILL'
const typo = 'chrisdemko@gmali.com'
const corrected = 'chrisdemko@gmail.com'
const now = new Date('2026-10-13T18:00:00Z')
const eventId = 'evt_1UQHEcE0Bkxod3r8Kb7rNyof'
function held() {
  const record = pending(parseIntake({ businessName:'The Post Sports Bar Grill', customerName:'Chris Demko', email:typo, website:'https://example.com', category:'Restaurants & hospitality', city:'Austin', state:'Texas', services:'Dining', serviceArea:'Austin metro', terms_accepted:true }), assessment, submission, now, 'https://www.getorangerank.com', 'price_live')
  record.report_template_version = 'V1.2'
  record.stripe_checkout_session_id = 'cs_live_promo'
  const metadata = sessionParams(record).metadata
  const promo = { id:'promo_1UPqc1E0Bkxod3r8Chuo5NIO', object:'promotion_code', code:'POST100' }
  const session = { id:'cs_live_promo', object:'checkout.session', livemode:true, status:'complete', payment_status:'paid', mode:'payment', payment_method_collection:'if_required', customer_details:{ email:typo }, currency:'usd', amount_subtotal:14900, amount_total:0, total_details:{ amount_discount:14900, amount_tax:0, amount_shipping:0, breakdown:{ discounts:[{ amount:14900, discount:{ id:'di_live', object:'discount', promotion_code:promo } }] } }, discounts:[{ promotion_code:promo }], metadata, client_reference_id:assessment, line_items:{ data:[{ quantity:1, price:{ id:'price_live' } }] }, payment_intent:null }
  const event = { id:eventId, object:'event', livemode:true, type:'checkout.session.completed', created:Math.floor(now.getTime() / 1000), data:{ object:{ id:session.id, object:'checkout.session' } } }
  const redis = new LuaRedis()
  redis.rows.set(`or:intake:${submission}`, JSON.stringify(record))
  redis.rows.set(`or:stripe:event:${eventId}`, 'REVIEW')
  redis.rows.set(`or:stripe:review:${eventId}`, JSON.stringify({ review:true, reason:'PAYMENT_MISMATCH' }))
  const stripe = { events:{ retrieve:async () => event }, checkout:{ sessions:{ retrieve:async () => session } } }
  return { redis, stripe, session, event }
}
function restore(saved) { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved) }
test('replay confirms the held paid promo, corrects both email copies, and sends one Contract B handoff', async () => {
  const saved = { ...process.env }
  try {
    Object.assign(process.env, { VERCEL_ENV:'production', ORANGERANK_HANDOFF_ENABLED:'true', ORANGERANK_HANDOFF_URL:'https://handoff.example.com/contract', ORANGERANK_HANDOFF_TOKEN:'dummy-token' })
    const f = held()
    let sends = 0
    const send = async (_url, options) => {
      sends++
      assert.equal(options.headers['Idempotency-Key'], `orangerank-assessment-${assessment}`)
      const body = JSON.parse(options.body)
      assert.equal(body.contract_version, 'orangerank-handoff-v1')
      assert.equal(body.report_template_version, 'V1.3')
      assert.equal(body.intake.customer_email, corrected)
      assert.equal(body.payment.amount, 0)
      assert.equal(body.payment.list_amount, 14900)
      assert.equal(body.payment.discount_amount, 14900)
      assert.equal(body.payment.promotion_code, 'POST100')
      assert.equal(body.payment.reference, 'cs_live_promo')
      assert.equal(options.body.includes(typo), false)
      return new Response('', { status:200 })
    }
    const first = await replayAndHandoff(f.stripe, f.redis, eventId, assessment, 'price_live', true, corrected, send, now)
    assert.equal(first.result, 'CONFIRMED')
    assert.equal(first.handoff, 'TRANSPORT_ACCEPTED')
    const paid = JSON.parse(f.redis.rows.get(`or:intake:${submission}`))
    assert.equal(paid.customer_email, corrected)
    assert.equal(paid.intake_payload.email, corrected)
    assert.equal(paid.identity_review, 'CLEAR')
    assert.equal(paid.report_template_version, 'V1.3')
    assert.equal(paid.payment_status, 'PAYMENT_CONFIRMED')
    assert.equal(paid.transition_history.length, 1)
    assert.equal(f.redis.rows.get(`or:stripe:event:${eventId}`), 'CONFIRMED')
    assert.equal(f.redis.rows.get(`or:stripe:review:${eventId}`), 'REPLAYED')
    const second = await replayAndHandoff(f.stripe, f.redis, eventId, assessment, 'price_live', true, corrected, send, now)
    assert.equal(second.result, 'ALREADY_CONFIRMED')
    assert.equal(second.handoff, 'TRANSPORT_ACCEPTED')
    assert.equal(sends, 1)
    assert.equal(JSON.parse(f.redis.rows.get(`or:intake:${submission}`)).transition_history.length, 1)
    const blocked = await replayAndHandoff(f.stripe, f.redis, eventId, assessment, 'price_live', true, 'other@example.com', send, now)
    assert.equal(blocked.result, 'ALREADY_DISPATCHED')
    assert.equal(JSON.parse(f.redis.rows.get(`or:intake:${submission}`)).customer_email, corrected)
    assert.equal(sends, 1)
  } finally { restore(saved) }
})
test('replay leaves an invalid or unreviewed event unchanged', async () => {
  const saved = { ...process.env }
  try {
    process.env.VERCEL_ENV = 'production'
    const invalid = held()
    invalid.session.payment_intent = { id:'pi_live_zero', livemode:true, status:'succeeded', amount:0, amount_received:0, currency:'usd', metadata:invalid.session.metadata }
    const before = invalid.redis.rows.get(`or:intake:${submission}`)
    assert.equal((await replayAndHandoff(invalid.stripe, invalid.redis, eventId, assessment, 'price_live', true, corrected, async () => { throw new Error('no send') }, now)).result, 'REVIEW')
    assert.equal(invalid.redis.rows.get(`or:intake:${submission}`), before)
    assert.equal(invalid.redis.rows.get(`or:stripe:event:${eventId}`), 'REVIEW')
    const missing = held()
    missing.redis.rows.delete(`or:stripe:review:${eventId}`)
    const snapshot = missing.redis.rows.get(`or:intake:${submission}`)
    assert.equal((await replayAndHandoff(missing.stripe, missing.redis, eventId, assessment, 'price_live', true, undefined, async () => { throw new Error('no send') }, now)).result, 'NOT_REVIEW')
    assert.equal(missing.redis.rows.get(`or:intake:${submission}`), snapshot)
    const wrong = held()
    assert.equal((await replayAndHandoff(wrong.stripe, wrong.redis, eventId, 'OR-20261013-OTHER', 'price_live', true, corrected, async () => { throw new Error('no send') }, now)).result, 'CONFLICT')
    assert.equal(wrong.redis.rows.get(`or:stripe:event:${eventId}`), 'REVIEW')
  } finally { restore(saved) }
})
test('replay route requires its own secret and does not log the corrected email', async () => {
  const saved = { ...process.env }
  const logs = []
  try {
    Object.assign(process.env, { VERCEL_ENV:'production', ORANGERANK_STRIPE_MODE:'live', ORANGERANK_LIVE_APPROVED:'true', STRIPE_SECRET_KEY:'sk_live_dummy', STRIPE_ORANGERANK_PRICE_ID:'price_live', UPSTASH_REDIS_REST_URL:'https://redis.example.com', UPSTASH_REDIS_REST_TOKEN:'dummy', ORANGERANK_REVIEW_REPLAY_SECRET:'r'.repeat(32), ORANGERANK_DISPATCH_SECRET:'d'.repeat(32), ORANGERANK_AUDIT_SECRET:'a'.repeat(32), ORANGERANK_HANDOFF_ENABLED:'true', ORANGERANK_HANDOFF_URL:'https://handoff.example.com/contract', ORANGERANK_HANDOFF_TOKEN:'dummy-token' })
    const request = (authorization, body) => new Request('https://www.getorangerank.com/api/internal/review-replay', { method:'POST', headers:{ authorization, 'content-type':'application/json' }, body:JSON.stringify(body) })
    assert.equal((await POST(request('', { event_id:eventId, assessment_id:assessment }))).status, 401)
    assert.equal((await POST(request('Bearer ' + 'd'.repeat(32), { event_id:eventId, assessment_id:assessment }))).status, 401)
    assert.equal((await POST(request('Bearer ' + 'r'.repeat(32), { event_id:eventId, assessment_id:assessment, customer_email:'not-an-email' }))).status, 400)
    assert.equal(replayEmail('  ' + corrected + ' '), corrected)
    const f = held()
    mock.method(console, 'info', line => logs.push(String(line)))
    mock.method(Object.getPrototypeOf(new Stripe('sk_live_dummy').events), 'retrieve', async () => f.event)
    mock.method(Object.getPrototypeOf(new Stripe('sk_live_dummy').checkout.sessions), 'retrieve', async () => f.session)
    let idempotency = ''
    mock.method(globalThis, 'fetch', async (url, options) => {
      if (String(url) === 'https://handoff.example.com/contract') { idempotency = options.headers['Idempotency-Key']; return new Response('', { status:200 }) }
      const body = JSON.parse(options.body)
      const pipeline = Array.isArray(body[0])
      const results = await Promise.all((pipeline ? body : [body]).map(async command => ({ result:String(command[0]).toLowerCase() === 'get' ? await f.redis.get(command[1]) : await f.redis.eval(command[1], command.slice(3, 3 + Number(command[2])), command.slice(3 + Number(command[2]))) })))
      const encoded = results.map(row => ({ result:typeof row.result === 'string' ? Buffer.from(row.result).toString('base64') : row.result }))
      return new Response(JSON.stringify(pipeline ? encoded : encoded[0]), { status:200 })
    })
    const response = await POST(request('Bearer ' + 'r'.repeat(32), { event_id:eventId, assessment_id:assessment, customer_email:corrected }))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { result:'CONFIRMED', handoff:'TRANSPORT_ACCEPTED' })
    assert.equal(idempotency, `orangerank-assessment-${assessment}`)
    assert.equal(logs.join('').includes(corrected), false)
    assert.equal(logs.join('').includes(typo), false)
    assert.equal(logs.join('').includes('r'.repeat(32)), false)
  } finally { mock.restoreAll(); restore(saved) }
})
