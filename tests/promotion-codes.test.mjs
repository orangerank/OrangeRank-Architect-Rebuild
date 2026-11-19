import test from 'node:test'
import assert from 'node:assert/strict'
import { pending, parseIntake, sessionParams } from '../lib/checkout/core.ts'
import { checkoutSessionExpand, processPayment } from '../lib/checkout/payments.ts'
import { receiverPayload, validatedReceiverPayload } from '../lib/handoff/dispatch.ts'
import { contractCPayload } from '../lib/handoff/contract-c.ts'
import { grokPayload } from '../lib/handoff/grok.ts'
import { LuaRedis } from './helpers/lua-redis.mjs'
const submission = '7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
const assessment = 'OR-20261009-TEST'
const key = `or:intake:${submission}`
const now = new Date('2026-10-12T15:00:00Z')
const raw = { businessName:'Private business', customerName:'Private person', email:'private@example.com', website:'https://private.example.com', category:'Home services', city:'Austin', state:'Texas', services:'Service', serviceArea:'Austin metro', terms_accepted:true }
function base(live = false) {
  const record = pending(parseIntake(raw), assessment, submission, now, 'https://preview.example.com', 'price_test')
  const id = live ? 'cs_live_one' : 'cs_test_one'
  record.stripe_checkout_session_id = id
  const metadata = sessionParams(record).metadata
  const session = { id, object:'checkout.session', livemode:live, status:'complete', payment_status:'paid', mode:'payment', customer_details:{ email:raw.email }, currency:'usd', amount_subtotal:14900, amount_total:14900, metadata, client_reference_id:assessment, line_items:{ data:[{ quantity:1, price:{ id:'price_test' } }] }, payment_intent:{ id:'pi_test', livemode:live, status:'succeeded', amount:14900, amount_received:14900, currency:'usd', metadata } }
  const event = { id:'evt_one', object:'event', livemode:live, type:'checkout.session.completed', created:Math.floor(now.getTime() / 1000), data:{ object:{ ...session } } }
  const redis = new LuaRedis()
  redis.rows.set(key, JSON.stringify(record))
  return { record, session, event, redis }
}
function discounted(amount, code, { live = false, status = 'paid', intent = true } = {}) {
  const f = base(live)
  const discount = 14900 - amount
  const promo = code ? { id:'promo_garage', object:'promotion_code', code } : null
  f.session.amount_total = amount
  f.session.payment_status = status
  f.session.total_details = { amount_discount:discount, amount_tax:0, amount_shipping:0, breakdown:{ discounts:[{ amount:discount, discount:{ id:'di_test', object:'discount', promotion_code:promo ? promo.id : null } }] } }
  f.session.discounts = [{ coupon:'coupon_test', promotion_code:promo }]
  if (!intent || amount === 0) f.session.payment_intent = null
  else { f.session.payment_intent.amount = amount; f.session.payment_intent.amount_received = amount }
  f.event.data.object = { ...f.session, amount_subtotal:1, amount_total:1, currency:'eur' }
  return f
}
const run = (f, live = false) => {
  let expand
  const stripe = { checkout:{ sessions:{ retrieve:async (_id, params) => { expand = params.expand; return f.session } } } }
  return processPayment(f.event, stripe, f.redis, 'price_test', now, () => {}, live).then(result => ({ result, expand, paid:JSON.parse(f.redis.rows.get(key)) }))
}
test('checkout retrieval expands promotion codes and ignores event amounts', async () => {
  const full = await run(base())
  assert.equal(full.result, 'CONFIRMED')
  assert.deepEqual(full.expand, checkoutSessionExpand)
  assert.equal(full.paid.verified_payment.amount, 14900)
  assert.equal(full.paid.verified_payment.list_amount, 14900)
  assert.equal(full.paid.verified_payment.discount_amount, 0)
  assert.equal(full.paid.verified_payment.promotion_code ?? null, null)
  assert.equal(full.paid.verified_payment.payment_reference, 'pi_test')
  const payload = validatedReceiverPayload(full.paid)
  assert.deepEqual(payload.payment, { reference:'pi_test', checkout_session_id:'cs_test_one', amount:14900, list_amount:14900, discount_amount:0, promotion_code:null, currency:'usd', confirmed_at:full.paid.verified_payment.confirmed_at })
})
test('$50 promotion code confirms the amount actually paid', async () => {
  const f = discounted(9900, 'GARAGEFRIENDS')
  const paid = await run(f)
  assert.equal(paid.result, 'CONFIRMED')
  assert.equal(paid.paid.current_status, 'PAYMENT_CONFIRMED')
  assert.equal(paid.paid.verified_payment.amount, 9900)
  assert.equal(paid.paid.verified_payment.list_amount, 14900)
  assert.equal(paid.paid.verified_payment.discount_amount, 5000)
  assert.equal(paid.paid.verified_payment.promotion_code, 'GARAGEFRIENDS')
  assert.equal(paid.paid.verified_payment.payment_reference, 'pi_test')
  const contractC = contractCPayload(paid.paid)
  assert.equal(contractC.contract_version, 'orangerank-test-handoff-v1')
  assert.equal(contractC.payment.amount, 9900)
  assert.equal(contractC.payment.list_amount, 14900)
  assert.equal(contractC.payment.discount_amount, 5000)
  assert.equal(contractC.payment.promotion_code, 'GARAGEFRIENDS')
  assert.equal(contractC.execution_mode, 'TEST_MODE')
  assert.equal(contractC.stripe_source_evidence.amount, 9900)
  assert.equal(contractC.stripe_source_evidence.promotion_code, 'GARAGEFRIENDS')
  const live = discounted(9900, 'GARAGEFRIENDS', { live:true })
  live.session.id = 'cs_live_one'
  live.record.stripe_checkout_session_id = 'cs_live_one'
  live.redis.rows.set(key, JSON.stringify(live.record))
  const confirmed = await run(live, true)
  assert.equal(confirmed.result, 'CONFIRMED')
  const contractB = receiverPayload(confirmed.paid)
  assert.equal(contractB.contract_version, 'orangerank-handoff-v1')
  assert.equal(contractB.execution_mode, undefined)
  assert.equal(contractB.mode, undefined)
  assert.deepEqual(contractB.payment, { reference:'pi_test', checkout_session_id:'cs_live_one', amount:9900, list_amount:14900, discount_amount:5000, promotion_code:'GARAGEFRIENDS', currency:'usd', confirmed_at:confirmed.paid.verified_payment.confirmed_at })
  assert.equal(grokPayload(confirmed.paid).payment.list_amount, undefined)
  assert.equal(grokPayload(confirmed.paid).payment.amount, 9900)
  assert.equal(grokPayload(confirmed.paid).mode, 'validation_only')
})
test('a coupon without a customer-facing code still records the paid total', async () => {
  const f = discounted(9900, null)
  const paid = await run(f)
  assert.equal(paid.result, 'CONFIRMED')
  assert.equal(paid.paid.verified_payment.amount, 9900)
  assert.equal(paid.paid.verified_payment.discount_amount, 5000)
  assert.equal(paid.paid.verified_payment.promotion_code ?? null, null)
  assert.equal(contractCPayload(paid.paid).payment.promotion_code, null)
})
test('100% off is paid only when a promotion code was applied', async () => {
  const free = discounted(0, 'GARAGEFRIENDS', { status:'no_payment_required', intent:false })
  const paid = await run(free)
  assert.equal(paid.result, 'CONFIRMED')
  assert.equal(paid.paid.payment_status, 'PAYMENT_CONFIRMED')
  assert.equal(paid.paid.verified_payment.amount, 0)
  assert.equal(paid.paid.verified_payment.list_amount, 14900)
  assert.equal(paid.paid.verified_payment.discount_amount, 14900)
  assert.equal(paid.paid.verified_payment.promotion_code, 'GARAGEFRIENDS')
  assert.equal(paid.paid.verified_payment.payment_reference, 'cs_test_one')
  const payload = contractCPayload(paid.paid).payment
  assert.equal(payload.amount, 0)
  assert.equal(payload.list_amount, 14900)
  assert.equal(payload.discount_amount, 14900)
  assert.equal(payload.promotion_code, 'GARAGEFRIENDS')
  assert.equal(payload.reference, 'cs_test_one')
  for (const change of [
    s => { s.session.discounts = [{ coupon:'coupon_free', promotion_code:null }]; s.session.total_details.breakdown.discounts[0].discount.promotion_code = null },
    s => { s.session.payment_status = 'unpaid' },
    s => { s.session.amount_subtotal = 0 },
    s => { s.session.payment_intent = { id:'pi_zero', livemode:false, status:'succeeded', amount:0, amount_received:0, currency:'usd', metadata:s.session.metadata } },
  ]) {
    const f = discounted(0, 'GARAGEFRIENDS', { status:'no_payment_required', intent:false })
    change(f)
    const result = await run(f)
    assert.notEqual(result.result, 'CONFIRMED')
    assert.equal(result.paid.current_status, 'NEW')
    assert.equal(result.paid.verified_payment, undefined)
  }
})
test('100% off accepts payment_status paid and no_payment_required', async () => {
  for (const status of ['paid', 'no_payment_required']) {
    const f = discounted(0, 'GARAGEFRIENDS', { status, intent:false })
    const paid = await run(f)
    assert.equal(paid.result, 'CONFIRMED', status)
    assert.equal(paid.paid.verified_payment.amount, 0)
    assert.equal(paid.paid.verified_payment.list_amount, 14900)
    assert.equal(paid.paid.verified_payment.discount_amount, 14900)
    assert.equal(paid.paid.verified_payment.promotion_code, 'GARAGEFRIENDS')
    assert.equal(paid.paid.verified_payment.payment_reference, 'cs_test_one')
    assert.equal(paid.paid.verified_payment.currency, 'usd')
  }
  const live = discounted(0, 'GARAGEFRIENDS', { live:true, status:'paid', intent:false })
  const confirmed = await run(live, true)
  assert.equal(confirmed.result, 'CONFIRMED')
  const payload = receiverPayload(confirmed.paid)
  assert.equal(payload.report_template_version, 'V1.3')
  assert.equal(payload.payment.amount, 0)
  assert.equal(payload.payment.discount_amount, 14900)
  assert.equal(payload.payment.promotion_code, 'GARAGEFRIENDS')
  assert.equal(payload.payment.reference, 'cs_live_one')
})
test('an issued V1.2 session still confirms and is stamped V1.3', async () => {
  const f = base()
  f.record.report_template_version = 'V1.2'
  const metadata = sessionParams(f.record).metadata
  assert.equal(metadata.report_template_version, 'V1.2')
  f.session.metadata = metadata
  f.session.payment_intent.metadata = metadata
  f.redis.rows.set(key, JSON.stringify(f.record))
  const paid = await run(f)
  assert.equal(paid.result, 'CONFIRMED')
  assert.equal(paid.paid.report_template_version, 'V1.3')
  assert.equal(validatedReceiverPayload(paid.paid).report_template_version, 'V1.3')
  const stale = base()
  stale.record.report_template_version = 'V1.0'
  stale.session.metadata = sessionParams(stale.record).metadata
  stale.session.payment_intent.metadata = stale.session.metadata
  stale.redis.rows.set(key, JSON.stringify(stale.record))
  assert.equal((await run(stale)).result, 'REVIEW')
})
test('list price, paid total, payment intent, and unreadable codes are not trusted from the client or a partial discount', async () => {
  const changes = [
    s => { s.session.amount_subtotal = 9900 },
    s => { s.session.amount_total = 15000; s.session.payment_intent.amount = 15000; s.session.payment_intent.amount_received = 15000 },
    s => { s.session.amount_total = 9900; s.session.payment_intent.amount = 14900; s.session.payment_intent.amount_received = 14900; s.session.total_details = { amount_discount:5000, amount_tax:0, amount_shipping:0 } },
    s => { s.session.amount_total = 9900; s.session.payment_intent.amount = 9900; s.session.payment_intent.amount_received = 100; s.session.total_details = { amount_discount:5000, amount_tax:0, amount_shipping:0 } },
    s => { s.session.amount_total = -1 },
    s => { s.session.total_details = { amount_discount:100, amount_tax:0, amount_shipping:0 } },
    s => { s.session.total_details = { amount_discount:0, amount_tax:100, amount_shipping:0 } },
    s => { s.session.discounts = [{ promotion_code:'not-a-promo-id' }] },
    s => { s.session.total_details = { amount_discount:5000, amount_tax:0, amount_shipping:0, breakdown:{ discounts:[{ amount:5000, discount:{ id:'di_a', promotion_code:'promo_missing' } }] } }; s.session.amount_total = 9900; s.session.payment_intent.amount = 9900; s.session.payment_intent.amount_received = 9900; s.session.discounts = [] },
    s => { s.session.amount_total = 9900; s.session.payment_intent.amount = 9900; s.session.payment_intent.amount_received = 9900; s.session.total_details = { amount_discount:5000, amount_tax:0, amount_shipping:0, breakdown:{ discounts:[{ amount:2000, discount:{ id:'di_a', promotion_code:'promo_a' } }, { amount:3000, discount:{ id:'di_b', promotion_code:'promo_b' } }] } }; s.session.discounts = [{ promotion_code:{ id:'promo_a', code:'AAAA' } }, { promotion_code:{ id:'promo_b', code:'BBBB' } }] },
    s => { s.session.payment_status = 'no_payment_required'; s.session.amount_total = 9900 },
  ]
  for (const change of changes) {
    const f = base()
    change(f)
    const result = await run(f)
    assert.equal(result.result, 'REVIEW')
    assert.equal(result.paid.current_status, 'NEW')
  }
  const resolved = base()
  resolved.session.amount_total = 9900
  resolved.session.payment_intent.amount = 9900
  resolved.session.payment_intent.amount_received = 9900
  resolved.session.total_details = { amount_discount:5000, amount_tax:0, amount_shipping:0, breakdown:{ discounts:[{ amount:5000, discount:{ id:'di_test', promotion_code:{ id:'promo_garage', object:'promotion_code', code:'GARAGEFRIENDS' } } }] } }
  resolved.session.discounts = null
  const fromBreakdown = await run(resolved)
  assert.equal(fromBreakdown.result, 'CONFIRMED')
  assert.equal(fromBreakdown.paid.verified_payment.promotion_code, 'GARAGEFRIENDS')
})
test('handoff accepts a stored discount and rejects a bare or unpaid-zero amount', () => {
  const f = base()
  Object.assign(f.record, { payment_status:'PAYMENT_CONFIRMED', current_status:'PAYMENT_CONFIRMED', payment_ownership_verified:true, identity_review:'CLEAR' })
  f.record.verified_payment = { livemode:true, assessment_id:assessment, event_id:'evt_one', checkout_session_id:'cs_live_one', payment_reference:'pi_test', amount:100, currency:'usd', paid_at:now.toISOString(), confirmed_at:now.toISOString() }
  assert.throws(() => receiverPayload(f.record), /UNVERIFIED_RECORD/)
  f.record.verified_payment = { ...f.record.verified_payment, amount:0, list_amount:14900, discount_amount:14900, promotion_code:null }
  assert.throws(() => receiverPayload(f.record), /UNVERIFIED_RECORD/)
  f.record.verified_payment = { ...f.record.verified_payment, amount:9900, list_amount:9900, discount_amount:0, promotion_code:'GARAGEFRIENDS' }
  assert.throws(() => receiverPayload(f.record), /UNVERIFIED_RECORD/)
  f.record.verified_payment = { ...f.record.verified_payment, amount:9900, list_amount:14900, discount_amount:5000, promotion_code:'GARAGEFRIENDS' }
  const live = receiverPayload(f.record)
  assert.equal(live.payment.amount, 9900)
  assert.equal(live.payment.list_amount, 14900)
  assert.equal(live.payment.discount_amount, 5000)
  assert.equal(live.payment.promotion_code, 'GARAGEFRIENDS')
  f.record.verified_payment = { ...f.record.verified_payment, livemode:false, amount:0, discount_amount:14900, promotion_code:'GARAGEFRIENDS', payment_reference:'cs_test_one', checkout_session_id:'cs_test_one' }
  const sandbox = contractCPayload(f.record)
  assert.equal(sandbox.contract_version, 'orangerank-test-handoff-v1')
  assert.equal(sandbox.payment.amount, 0)
  assert.equal(sandbox.payment.discount_amount, 14900)
  assert.equal(sandbox.payment.promotion_code, 'GARAGEFRIENDS')
  assert.throws(() => receiverPayload(f.record), /SYNTHETIC_QUARANTINE/)
})
