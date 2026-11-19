import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { mock } from 'node:test'
import { createRequire } from 'node:module'
import { NextRequest } from 'next/server'
import { parseIntake, pending, sessionParams, assessmentBase } from '../lib/checkout/core.ts'
import { grokPayload, sendGrokValidation } from '../lib/handoff/grok.ts'
import { POST as checkoutPost } from '../app/api/checkout/route.ts'
import { POST as webhookPost } from '../app/api/stripe/webhook/route.ts'
import { LuaRedis } from './helpers/lua-redis.mjs'

const Stripe = createRequire(import.meta.url)('stripe')

test('ported assessment pipeline files match the source bytes', () => {
  const lines = readFileSync('tests/fixtures/pipeline-sha256.txt', 'utf8').trim().split('\n')
  assert.ok(lines.length > 20)
  for (const line of lines) {
    const [hash, file, size] = line.split(/\s+/)
    const data = readFileSync(file)
    assert.equal(createHash('sha256').update(data).digest('hex'), hash, file)
    assert.equal(String(data.length), size, file)
  }
})

test('intake form posts the same fields, keeps two steps, and requires the terms checkbox', () => {
  const form = readFileSync('components/intake/intake-form.tsx', 'utf8')
  const validation = readFileSync('components/intake/validation.ts', 'utf8')
  assert.match(form, /const step1Fields = \['businessName', 'website', 'city', 'state', 'email'\]/)
  assert.match(form, /Step \{step\} of 2/)
  assert.match(form, /id="acceptance"/)
  assert.match(form, /type="checkbox"/)
  assert.match(form, /I agree to the/)
  assert.match(form, /intake_submission_id: attempt\.current!\.id/)
  assert.match(form, /intake: \{ \.\.\.values, terms_accepted: values\.acceptance === 'yes' \}/)
  for (const name of ['businessName', 'website', 'city', 'state', 'email', 'category', 'services', 'serviceArea', 'customerName', 'phone', 'competitors', 'googleUrl', 'notes']) {
    assert.match(form, new RegExp(`field\\('${name}'`))
  }
  assert.match(form, /`url\$\{i\}`/)
  assert.match(validation, /export const requiredFields = \['businessName', 'website', 'customerName', 'email', 'category', 'city', 'state', 'services', 'serviceArea', 'acceptance'\]/)
  const posted = parseIntake({
    businessName: 'Pup Buzz Mobile Grooming',
    website: 'https://example.com',
    customerName: 'Alex',
    email: 'alex@example.com',
    category: 'Home services',
    city: 'Austin',
    state: 'Texas',
    services: 'Grooming',
    serviceArea: 'Austin metro',
    phone: '512-555-0100',
    competitors: 'Rival Co',
    googleUrl: 'https://maps.example.com/place',
    notes: 'Call after 2',
    url0: 'https://example.com/about',
    terms_accepted: true,
  })
  assert.deepEqual(Object.keys(posted).sort(), ['acceptance', 'businessName', 'category', 'city', 'competitors', 'customerName', 'email', 'googleUrl', 'notes', 'phone', 'serviceArea', 'services', 'state', 'url0', 'url1', 'url2', 'url3', 'url4', 'website'])
  assert.equal(posted.acceptance, 'yes')
  assert.equal(posted.competitors, 'Rival Co')
})

test('checkout session payload matches the source contract', () => {
  const raw = {
    businessName: 'Pup Buzz Mobile Grooming',
    website: 'https://example.com',
    customerName: 'Alex',
    email: 'alex@example.com',
    category: 'Home services',
    city: 'Austin',
    state: 'Texas',
    services: 'Grooming',
    serviceArea: 'Austin metro',
    terms_accepted: true,
  }
  const now = new Date('2026-10-08T12:00:00Z')
  const submission = '7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
  const record = pending(parseIntake(raw), assessmentBase(raw.businessName, now), submission, now, 'https://example.com', 'price_test')
  const params = sessionParams(record)
  const metadata = {
    assessment_id: 'OR-20261008-PUP-BUZZ-MOBILE-GROOMING',
    business_name: 'Pup Buzz Mobile Grooming',
    website: 'https://example.com',
    customer_email: 'alex@example.com',
    product: 'orangerank_assessment_v1',
    ledger_version: 'ControlLedger-V1.0',
    methodology_version: 'PRODUCTION-v1-LOCKED',
    report_template_version: 'V1.3',
    intake_submission_id: submission,
  }
  assert.deepEqual(params, {
    mode: 'payment',
    currency: 'usd',
    line_items: [{ price: 'price_test', quantity: 1 }],
    allow_promotion_codes: true,
    customer_email: 'alex@example.com',
    client_reference_id: 'OR-20261008-PUP-BUZZ-MOBILE-GROOMING',
    metadata,
    payment_intent_data: { metadata },
    success_url: 'https://example.com/checkout/success',
    cancel_url: 'https://example.com/checkout/cancel',
  })
  assert.equal(params.line_items[0].unit_amount, undefined)
  assert.equal(params.discounts, undefined)
})

test('signed Stripe webhook emits the same Contract C outbound payload', async () => {
  const saved = { ...process.env }
  const submission = '7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
  const assessment = 'OR-20261009-TEST'
  const raw = {
    businessName: 'Private business',
    customerName: 'Private person',
    email: 'private@example.com',
    website: 'https://private.example.com',
    category: 'Home services',
    city: 'Austin',
    state: 'Texas',
    services: 'Service',
    serviceArea: 'Austin metro',
    competitors: 'Rival Co',
    terms_accepted: true,
  }
  try {
    Object.assign(process.env, {
      VERCEL_ENV: 'preview',
      ORANGERANK_STRIPE_MODE: 'test',
      ORANGERANK_CHECKOUT_RELEASE_APPROVED: 'true',
      ORANGERANK_CHECKOUT_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_dummy',
      STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
      STRIPE_ORANGERANK_PRICE_ID: 'price_test',
      UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
      UPSTASH_REDIS_REST_TOKEN: 'dummy',
      ORANGERANK_HANDOFF_ENABLED: 'true',
      ORANGERANK_HANDOFF_URL: 'https://handoff.example.com/contract',
      ORANGERANK_HANDOFF_TOKEN: 'dummy_handoff_token',
    })
    delete process.env.GROK_ROUTINE_WEBHOOK_URL
    delete process.env.GROK_ROUTINE_WEBHOOK_KEY
    const now = new Date()
    const record = pending(parseIntake(raw), assessment, submission, now, 'https://preview.example.com', 'price_test')
    record.stripe_checkout_session_id = 'cs_test_one'
    const metadata = sessionParams(record).metadata
    const session = {
      id: 'cs_test_one',
      object: 'checkout.session',
      livemode: false,
      status: 'complete',
      payment_status: 'paid',
      mode: 'payment',
      customer_details: { email: raw.email },
      currency: 'usd',
      amount_subtotal: 14900,
      amount_total: 14900,
      metadata,
      client_reference_id: assessment,
      line_items: { data: [{ quantity: 1, price: { id: 'price_test' } }] },
      payment_intent: { id: 'pi_test', livemode: false, status: 'succeeded', amount: 14900, amount_received: 14900, currency: 'usd', metadata },
    }
    const event = {
      id: 'evt_parity',
      object: 'event',
      livemode: false,
      type: 'checkout.session.completed',
      created: Math.floor(now.getTime() / 1000),
      data: { object: session },
    }
    const redis = new LuaRedis()
    redis.rows.set(`or:intake:${submission}`, JSON.stringify(record))
    mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions), 'retrieve', async () => session)
    let outbound = null
    mock.method(globalThis, 'fetch', async (url, options) => {
      if (String(url) === 'https://handoff.example.com/contract') {
        outbound = { url: String(url), method: options.method, headers: options.headers, body: JSON.parse(options.body) }
        return new Response('', { status: 200 })
      }
      const body = JSON.parse(options.body)
      const pipeline = Array.isArray(body[0])
      const results = await Promise.all((pipeline ? body : [body]).map(async (command) => ({
        result: String(command[0]).toLowerCase() === 'get'
          ? await redis.get(command[1])
          : await redis.eval(command[1], command.slice(3, 3 + Number(command[2])), command.slice(3 + Number(command[2]))),
      })))
      const encoded = results.map((row) => ({ result: typeof row.result === 'string' ? Buffer.from(row.result).toString('base64') : row.result }))
      return new Response(JSON.stringify(pipeline ? encoded : encoded[0]), { status: 200 })
    })
    const payloadText = JSON.stringify(event)
    const signature = Stripe.webhooks.generateTestHeaderString({ payload: payloadText, secret: 'whsec_dummy' })
    const response = await webhookPost(new Request('https://preview.example.com/api/stripe/webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body: payloadText,
    }))
    assert.equal(response.status, 200)
    assert.ok(outbound)
    assert.equal(outbound.method, 'POST')
    assert.equal(outbound.headers.Authorization, 'Bearer dummy_handoff_token')
    assert.equal(outbound.headers['Content-Type'], 'application/json')
    assert.equal(outbound.headers['Idempotency-Key'], `orangerank-test-${assessment}-${submission}`)
    assert.equal(outbound.body.contract_version, 'orangerank-test-handoff-v1')
    assert.equal(outbound.body.assessment_id, assessment)
    assert.equal(outbound.body.execution_mode, 'TEST_MODE')
    assert.equal(outbound.body.intake.business_name, 'Private business')
    assert.equal(outbound.body.intake.website, 'https://private.example.com')
    assert.equal(outbound.body.intake.business_category, 'Home services')
    assert.deepEqual(outbound.body.intake.primary_location, { city: 'Austin', state: 'Texas' })
    assert.equal(outbound.body.intake.primary_services, 'Service')
    assert.equal(outbound.body.intake.competitors_known, 'Rival Co')
    assert.equal(outbound.body.intake.customer_email, 'private@example.com')
    assert.equal(outbound.body.mode, undefined)
    const route = readFileSync('app/api/stripe/webhook/route.ts', 'utf8')
    assert.match(route, /stripe\.webhooks\.constructEvent/)
    assert.match(route, /checkout\.session\.completed/)
    assert.match(route, /checkout\.session\.async_payment_succeeded/)
    assert.match(route, /dispatchContractC/)
    assert.match(route, /dispatchAssessment/)
  } finally {
    mock.restoreAll()
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
    Object.assign(process.env, saved)
  }
})

test('Grok paid-assessment validation payload keeps the same fields and bearer header', async () => {
  const submission = '7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
  const id = 'OR-20261009-TEST'
  const record = pending(parseIntake({
    businessName: 'Private business',
    website: 'https://private.example.com',
    customerName: 'Private person',
    email: 'private@example.com',
    category: 'Home services',
    city: 'Austin',
    state: 'Texas',
    services: 'Service',
    serviceArea: 'Austin metro',
    competitors: 'Rival Co',
    terms_accepted: true,
  }), id, submission, new Date(), 'https://preview.example.com', 'price_test')
  record.payment_ownership_verified = true
  record.identity_review = 'CLEAR'
  record.current_status = 'PAYMENT_CONFIRMED'
  record.payment_status = 'PAYMENT_CONFIRMED'
  record.verified_payment = {
    event_id: 'evt_one',
    paid_at: new Date().toISOString(),
    assessment_id: id,
    amount: 14900,
    currency: 'usd',
    payment_reference: 'pi_test',
    checkout_session_id: 'cs_test_one',
    confirmed_at: new Date().toISOString(),
  }
  const payload = grokPayload(record)
  assert.equal(payload.mode, 'validation_only')
  assert.equal(payload.assessment_id, id)
  assert.equal(payload.business_name, 'Private business')
  assert.equal(payload.website, 'https://private.example.com')
  assert.equal(payload.business_category, 'Home services')
  assert.equal(payload.primary_city, 'Austin')
  assert.equal(payload.primary_state, 'Texas')
  assert.equal(payload.primary_service_area, 'Austin metro')
  assert.deepEqual(payload.main_services, ['Service'])
  assert.equal(payload.customer_email, 'private@example.com')
  assert.equal(payload.optional_intake.competitors, 'Rival Co')
  assert.equal(payload.payment.provider, 'stripe')
  assert.equal(payload.payment.signature_verified, true)
  let seen = null
  const result = await sendGrokValidation(record, { endpoint: 'https://routine.example.com/webhook', key: 'dummy_grok_key' }, async (url, options) => {
    seen = { url, headers: options.headers, body: JSON.parse(options.body) }
    return new Response('', { status: 200 })
  })
  assert.equal(result, 'VALIDATION_ACCEPTED')
  assert.equal(seen.url, 'https://routine.example.com/webhook')
  assert.equal(seen.headers.Authorization, 'Bearer dummy_grok_key')
  assert.equal(seen.body.assessment_id, id)
  assert.equal(seen.body.customer_email, 'private@example.com')
})

test('homepage still mounts utm tracking, analytics stay production-only, and there are no redirects', () => {
  const layout = readFileSync('app/layout.tsx', 'utf8')
  assert.match(layout, /<OutreachClickBeacon \/>/)
  assert.match(layout, /process\.env\.NODE_ENV === 'production' && <Analytics \/>/)
  assert.match(readFileSync('lib/outreach/code.ts', 'utf8'), /params\.get\('utm_content'\)/)
  assert.match(readFileSync('app/page.tsx', 'utf8'), /href="\/get-your-orange-score"/)
  const config = readFileSync('next.config.mjs', 'utf8')
  assert.equal(config.includes('async redirects'), false)
  assert.equal(config.includes('async rewrites'), false)
  assert.equal(existsSync('middleware.ts'), false)
  assert.equal(existsSync('vercel.json'), false)
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const deps = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies })
  assert.equal(/resend|nodemailer|postmark|mailgun|sendgrid|@sendgrid/i.test(deps), false)
  const responsePromise = checkoutPost(new NextRequest('https://example.com/api/checkout', { method: 'POST' }))
  return responsePromise.then((response) => assert.equal(response.status, 503))
})

test('workforce page keeps confirmed name and email, and the remaining Chris decisions', () => {
  const page = readFileSync('app/ai-workforce-systems/page.tsx', 'utf8')
  assert.equal((page.match(/TODO\(chris\)/g) || []).length, 5)
  assert.match(page, /mailto:hello@getorangerank.com/)
  assert.equal(page.includes('chris@getorangerank.com'), false)
  assert.match(page, /AI Workforce Systems/)
  assert.match(page, /Book a discovery call/)
  assert.match(page, /Scoped after discovery: one-time build plus monthly management/)
  assert.equal(/\$\d/.test(page), false)
  assert.equal(/\bStripe\b|EIP|Experience Improvement|eip360|Salesforce|HubSpot|revolutionary|\b10x\b|fully autonomous/i.test(page), false)
})
