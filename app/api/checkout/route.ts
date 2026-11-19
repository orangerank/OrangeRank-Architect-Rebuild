import { stripeConfiguration, validPrice } from '@/lib/checkout/config'
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { parseIntake, fingerprint, obtainSession, canCreate, type Pending } from '@/lib/checkout/core'
import { store, reserve } from '@/lib/checkout/store'
import { saveSession } from '@/lib/checkout/payment-store'
import { checkoutDiagnostics } from '@/lib/checkout/diagnostics'
export const runtime = 'nodejs'
const headers = {'Cache-Control':'no-store'}
export async function POST(request: NextRequest) {
  const diagnostic = checkoutDiagnostics()
  function fail(message:string,status:number) { diagnostic.failure(); return NextResponse.json({error:message},{status,headers}) }
  if(process.env.ORANGERANK_CHECKOUT_ENABLED!=='true' || process.env.ORANGERANK_CHECKOUT_RELEASE_APPROVED!=='true')return fail('Checkout is not available yet.',503)
  let configuration
  try{configuration=stripeConfiguration()}catch{return fail('Checkout is not available yet.',503)}
  diagnostic.success()
  diagnostic.start('ORIGIN_VERIFICATION')
  const origin = process.env.ORANGERANK_CHECKOUT_ORIGIN
  if (!origin || request.headers.get('origin') !== origin || request.nextUrl.origin !== origin) {
    if(process.env.VERCEL_ENV==='preview') { try { console.info(JSON.stringify({event:'orangerank_origin_check',configured:Boolean(origin),header_matches:request.headers.get('origin')===origin,url_matches:request.nextUrl.origin===origin,timestamp:new Date().toISOString()})) } catch {} }
    return fail('Checkout request could not be verified.',403)
  }
  diagnostic.success()
  diagnostic.start('REQUEST_VALIDATION')
  if (!request.headers.get('content-type')?.startsWith('application/json')) return fail('Invalid request.',400)
  try {
    const bodyText = await request.text()
    if (Buffer.byteLength(bodyText)>20000) return fail('Intake is too large.',413)
    let body: Record<string,unknown>
    try { body = JSON.parse(bodyText) } catch { return fail('Invalid intake.',400) }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Invalid intake.',400)
    const cookie = request.cookies.get('or_checkout')?.value
    const submission = body.resume === true ? cookie : body.intake_submission_id
    if (typeof submission !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submission)) return fail('Invalid submission reference.',400)
    diagnostic.success()
    diagnostic.start('INTAKE_VALIDATION')
    let values
    if (body.resume !== true) {
      try { values = parseIntake(body.intake) } catch { return fail('Please check all required fields, email, website, URLs and terms acceptance.',400) }
    }
    diagnostic.success()
    diagnostic.start('REDIS_INITIALIZATION')
    const redis = store()
    diagnostic.success()
    diagnostic.start('REDIS_RATE_LIMIT')
    // Limit attempts and new records. Diagnostics never log intake or provider messages.
    const bucket = Math.floor(Date.now()/60000)
    const ip = request.headers.get('x-vercel-forwarded-for') ?? 'local'
    const { createHash } = await import('node:crypto')
    const rateKey = `or:rate:${createHash('sha256').update(ip).digest('hex')}:${bucket}`
    const rate = await redis.incr(rateKey); await redis.expire(rateKey,120)
    if (rate>10) return fail('Too many attempts. Please wait a minute.',429)
    diagnostic.success()
    diagnostic.start('STRIPE_INITIALIZATION')
    const stripe = new Stripe(configuration.key)
    diagnostic.success()
    diagnostic.start('STRIPE_PRICE_RETRIEVAL')
    const priceId = configuration.price
    if (!priceId) return fail('Checkout is not configured yet.',503)
    const price = await stripe.prices.retrieve(priceId)
    if (!validPrice(price,configuration.live)) return fail('Checkout is not configured yet.',503)
    diagnostic.success()
    diagnostic.start('REDIS_ASSESSMENT_RESERVATION')
    let record = await redis.get<Pending>(`or:intake:${submission}`)
    if (!record && values) {
      record = await reserve(redis,values,submission,origin,priceId)
      diagnostic.success('PENDING_ASSESSMENT_WRITE')
    }
    if (!record) return fail('No pending assessment was found. Please return to intake.',404)
    diagnostic.success()
    // reserve() atomically reserves the ID and writes the pending record.
    if (values && record.fingerprint !== fingerprint(values)) return fail('This attempt already has different details. Return to the original details or start a new attempt.',409)
    if (record.origin !== origin || record.price !== priceId) return fail('This assessment needs support before retrying.',409)
    if (!record.stripe_checkout_session_id && !canCreate(record,new Date())) return fail('This pending assessment needs support before retrying. No new checkout was created.',409)
    diagnostic.start('STRIPE_CHECKOUT_SESSION_CREATE')
    const reusingSession = Boolean(record.stripe_checkout_session_id)
    const session = await obtainSession(record,stripe,async record=>{
      diagnostic.success()
      diagnostic.start('PENDING_ASSESSMENT_WRITE')
      const result = await saveSession(redis,submission,record.stripe_checkout_session_id!)
      diagnostic.success()
      return result
    })
    if (reusingSession) diagnostic.success('STRIPE_CHECKOUT_SESSION_CREATE')
    // This stage also covers retrieval of an existing session on resume.
    diagnostic.start('CHECKOUT_RESPONSE')
    if (session.livemode!==configuration.live || session.status !== 'open' || !session.url || new URL(session.url).hostname !== 'checkout.stripe.com') return fail('This checkout is no longer open. Contact hello@getorangerank.com with your assessment reference.',409)
    const response = NextResponse.json({url:session.url,assessment_id:record.assessment_id},{headers})
    response.cookies.set('or_checkout',submission,{httpOnly:true,secure:request.nextUrl.protocol==='https:',sameSite:'lax',path:'/',maxAge:86400})
    diagnostic.success()
    return response
  } catch (error) {
    diagnostic.failure(error)
    return NextResponse.json({error:'We could not start checkout. Please retry. No payment has been confirmed.'},{status:503,headers})
  }
}
