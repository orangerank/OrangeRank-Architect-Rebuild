import { stripeConfiguration } from '@/lib/checkout/config'
import Stripe from 'stripe'
import { dispatchAssessment, receiverConfiguration } from '@/lib/handoff/dispatch'
import { dispatchContractC } from '@/lib/handoff/contract-c'
import { grokConfiguration } from '@/lib/handoff/grok'
import { sanitizedProviderError } from '@/lib/checkout/diagnostics'
import { store } from '@/lib/checkout/store'
import { processPayment } from '@/lib/checkout/payments'
export const runtime = 'nodejs'
const headers = {'Cache-Control':'no-store'}
function response(status: number) { return Response.json({received:status === 200},{status,headers}) }
function log(stage: string, result: string, error?: unknown) {
  try { console.info(JSON.stringify({event:'orangerank_payment_webhook',stage,result,...(error===undefined?{}:sanitizedProviderError(error)),timestamp:new Date().toISOString()})) } catch { /* no payment dependency on logging */ }
}
export async function POST(request: Request) {
  let configuration
  try{configuration=stripeConfiguration();if(!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_'))throw Error('CONFIG')}catch{log('CONFIGURATION','INCOMPLETE_TEST_CONFIGURATION');return response(503)}
  let stripe: Stripe
  try { stripe = new Stripe(configuration.key) } catch { log('CONFIGURATION','FAILED');return response(503) }
  const signature = request.headers.get('stripe-signature')
  if (!signature) { log('SIGNATURE','REJECTED');return response(400) }
  let event: Stripe.Event
  try {
    const raw = Buffer.from(await request.arrayBuffer())
    if (raw.length > 1_000_000) return response(413)
    event = stripe.webhooks.constructEvent(raw,signature,process.env.STRIPE_WEBHOOK_SECRET!)
    if (!/^evt_[A-Za-z0-9]+$/.test(event.id) || event.object !== 'event' || typeof event.livemode !== 'boolean' || !Number.isFinite(event.created) || event.created <= 0 || event.created > 8_640_000_000_000 || typeof event.type !== 'string' || !event.data?.object) return response(400)
  } catch { log('SIGNATURE','REJECTED');return response(400) }
  if (event.livemode!==configuration.live || !['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)) { log('EVENT','IGNORED');return response(200) }
  let stage='REDIS_INITIALIZATION'
  try {
    const result = await processPayment(event,stripe,store(false),configuration.price,new Date(),value=>{stage=value},configuration.live)
    log('DURABLE_PAYMENT',['CONFIRMED','DUPLICATE','DUPLICATE_PAYMENT','OWNERSHIP_REVIEW','REVIEW','RETRY','IGNORED','REJECTED','UNPAID'].includes(String(result)) ? String(result) : 'UNKNOWN')
    if(['CONFIRMED','DUPLICATE','DUPLICATE_PAYMENT'].includes(String(result))){
      const session=event.data.object as Stripe.Checkout.Session
      const submission=session.metadata?.intake_submission_id
      const assessment=session.metadata?.assessment_id
      if(configuration.live===false && event.livemode===false && typeof submission==='string' && typeof assessment==='string'){
        stage='CONTRACT_C_DISPATCH'
        const dispatched=await dispatchContractC(store(false),assessment,submission,receiverConfiguration())
        const safe=['TRANSPORT_ACCEPTED','PENDING_INTEGRATION','IDENTITY_MISMATCH','INCOMPLETE_LOOKUP','PRIOR_USE_OR_UNKNOWN','OUTCOME_UNKNOWN','REVIEW','TEST_MODE_UNVERIFIED','INVALID_SOURCE','SYNTHETIC_QUARANTINE','PAYMENT_REVIEW','INCONSISTENT_INTAKE','UNVERIFIED_RECORD'].includes(dispatched)?dispatched:'OUTCOME_UNKNOWN'
        log(stage,safe)
      }else if(configuration.live===true && event.livemode===true && !grokConfiguration() && typeof submission==='string'){
        stage='CONTRACT_B_DISPATCH'
        const dispatched=await dispatchAssessment(store(false),submission,receiverConfiguration())
        const safe=['TRANSPORT_ACCEPTED','PENDING_INTEGRATION','SYNTHETIC_QUARANTINE','REVIEW','MISSING','OUTCOME_UNKNOWN','INVALID_REFERENCE'].includes(dispatched)?dispatched:'OUTCOME_UNKNOWN'
        log(stage,safe)
      }
    }
    return response(result === 'RETRY' ? 503 : 200)
  } catch (error) { log(stage,'TRANSIENT_FAILURE',error);return response(503) }
}
