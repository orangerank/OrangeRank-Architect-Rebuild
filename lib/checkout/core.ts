import { createHash } from 'node:crypto'
import { validateIntake, type IntakeValues } from '../../components/intake/validation'

export const methodology = 'PRODUCTION-v1-LOCKED'
export const template = 'V1.3'
/** Sessions issued before the V1.3 cutover still carry V1.2 in Stripe metadata. */
export function acceptedTemplate(version: string) {
  return version === template || version === 'V1.2'
}
export function parseIntake(input: unknown): IntakeValues {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID')
  const raw = input as Record<string, unknown>
  const keys = ['businessName','website','customerName','email','category','city','state','services','phone','serviceArea','competitors','googleUrl','notes', ...Array.from({length:5},(_,i)=>`url${i}`)]
  const values: IntakeValues = {}
  for (const key of keys) {
    const value = raw[key] ?? ''
    const max = ['services','notes','competitors'].includes(key) ? 5000 : ['website','googleUrl',...keys.filter(k=>/^url\d$/.test(k))].includes(key) ? 500 : 200
    if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error('INVALID')
    values[key] = value.trim()
  }
  if (raw.terms_accepted !== true) throw new Error('INVALID')
  values.acceptance = 'yes'
  if (Object.keys(validateIntake(values)).length) throw new Error('INVALID')
  return values
}
export function assessmentBase(name: string, now: Date) {
  const date = new Intl.DateTimeFormat('en-US', { timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(now)
  const part = (type:string) => date.find(p=>p.type===type)!.value
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9\s-]/g,'').replace(/[\s-]+/g,'-').replace(/^-|-$/g,'').slice(0,60).replace(/-$/,'') || 'BUSINESS'
  return `OR-${part('year')}${part('month')}${part('day')}-${slug}`
}
export function fingerprint(values: IntakeValues) { return createHash('sha256').update(JSON.stringify(values)).digest('hex') }
export function pending(values: IntakeValues, id: string, submission: string, now: Date, origin: string, price: string) {
  return { assessment_id:id, intake_submission_id:submission, business_name:values.businessName, website:values.website!, customer_name:values.customerName, customer_email:values.email, business_category:values.category, primary_location:{city:values.city,state:values.state}, primary_services:values.services, terms_accepted:true, terms_accepted_at:now.toISOString(),
    phone:values.phone, service_area:values.serviceArea, competitors_known:values.competitors, google_business_url:values.googleUrl, additional_urls:Array.from({length:5},(_,i)=>values[`url${i}`]).filter(Boolean), notes:values.notes, intake_payload:{...values,terms_accepted:true},
    payment_status:'PENDING' as const, current_status:'NEW' as const, created_date:now.toISOString(), stripe_checkout_session_id:null as string|null, methodology_version:methodology, report_template_version:template, origin, price, fingerprint:fingerprint(values) }
}
export type Pending = ReturnType<typeof pending>
export function sessionParams(record: Pending) {
  const metadata = { assessment_id:record.assessment_id, business_name:record.business_name, website:record.website, customer_email:record.customer_email, product:'orangerank_assessment_v1', ledger_version:'ControlLedger-V1.0', methodology_version:methodology, report_template_version:record.report_template_version, intake_submission_id:record.intake_submission_id }
  return { mode:'payment' as const, currency:'usd', line_items:[{price:record.price,quantity:1}], allow_promotion_codes:true, customer_email:record.customer_email, client_reference_id:record.assessment_id, metadata, payment_intent_data:{metadata}, success_url:`${record.origin}/checkout/success`, cancel_url:`${record.origin}/checkout/cancel` }
}
// A persisted ID is reused forever; never recreate after Stripe's idempotency retention window.
export function canCreate(record: Pending, now: Date) { return now.getTime() - Date.parse(record.created_date) < 20 * 60 * 60 * 1000 }

export async function obtainSession(record: Pending, stripe: Pick<import('stripe').default, 'checkout'>, save: (record: Pending)=>Promise<unknown>, now = new Date()) {
  if (record.stripe_checkout_session_id) return stripe.checkout.sessions.retrieve(record.stripe_checkout_session_id)
  if (!canCreate(record,now)) throw new Error('STALE')
  const session = await stripe.checkout.sessions.create(sessionParams(record),{idempotencyKey:`or-checkout-${record.intake_submission_id}`})
  record.stripe_checkout_session_id = session.id
  await save(record)
  return session
}
