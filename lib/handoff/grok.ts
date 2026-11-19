import { syntheticRecord } from './safety'
import { validateIntake } from '../../components/intake/validation'
import type { PaidRecord } from '../checkout/payments'
import { validatedReceiverPayload } from './dispatch'

/** Owner-confirmed Routine contract. Acceptance is never production fulfillment. */
export function grokConfiguration() {
  if (process.env.ORANGERANK_HANDOFF_ENABLED === 'true' || process.env.VERCEL_ENV === 'production') return null
  const endpoint=process.env.GROK_ROUTINE_WEBHOOK_URL
  const key=process.env.GROK_ROUTINE_WEBHOOK_KEY
  if (!endpoint || !key) return null
  try {const url=new URL(endpoint);if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)return null;return {endpoint,key}}
  catch{return null}
}
export function routineIssues(record: PaidRecord) {
  const issues: {field:string;status:'missing'|'wrong_type'|'invalid'}[]=[]
  const intake=record.intake_payload as Record<string,unknown> | undefined
  const fields={customer_name:'customerName',customer_email:'email',business_name:'businessName',website:'website',business_category:'category',primary_city:'city',primary_state:'state',primary_service_area:'serviceArea',main_services:'services'}
  function text(field:string,value:unknown){
    if(value===undefined || value===null || value==='')issues.push({field,status:'missing'})
    else if(typeof value!=='string')issues.push({field,status:'wrong_type'})
    else if(!value.trim())issues.push({field,status:'invalid'})
  }
  for(const [field,key]of Object.entries(fields))text(field,intake?.[key])
  if(intake){
    const values=Object.fromEntries(Object.entries(intake).filter(([,value])=>typeof value==='string')) as Record<string,string>
    const invalid=validateIntake({...values,acceptance:intake.terms_accepted===true?'yes':''})
    for(const [field,key]of Object.entries(fields))if(invalid[key] && !issues.some(i=>i.field===field))issues.push({field,status:'invalid'})
  }
  if(intake?.terms_accepted!==true)issues.push({field:'terms_accepted',status:intake?.terms_accepted===undefined?'missing':typeof intake.terms_accepted!=='boolean'?'wrong_type':'invalid'})
  text('terms_accepted_at',record.terms_accepted_at)
  if(typeof record.terms_accepted_at==='string' && record.terms_accepted_at.trim() && !Number.isFinite(Date.parse(record.terms_accepted_at)))issues.push({field:'terms_accepted_at',status:'invalid'})
  text('assessment_id',record.assessment_id)
  for(const key of ['event_id','checkout_session_id','payment_reference','paid_at'] as const)text(`payment.${key}`,record.verified_payment?.[key])
  if(typeof record.verified_payment?.paid_at==='string' && !Number.isFinite(Date.parse(record.verified_payment.paid_at)))issues.push({field:'payment.paid_at',status:'invalid'})
  if(syntheticRecord(record)){
    const existing=issues.find(i=>i.field==='primary_service_area')
    if(existing)existing.status='invalid'
    else issues.push({field:'primary_service_area',status:'invalid'})
  }
  return issues
}
export function grokPayload(record: PaidRecord) {
  validatedReceiverPayload(record)
  const intake=record.intake_payload as (Record<string, string | boolean | undefined> & {terms_accepted:boolean}) | undefined
  const payment=record.verified_payment!
  if(!intake)throw new Error('ORIGINAL_INTAKE_UNAVAILABLE')
  // A submission's creation time does not prove when terms were accepted.
  if(routineIssues(record).length)throw new Error('INVALID_ROUTINE_INTAKE')
  const optional=Object.fromEntries(['phone','competitors','googleUrl','notes','url0','url1','url2','url3','url4'].filter(key=>typeof intake[key]==='string' && String(intake[key]).trim()).map(key=>[key,intake[key]]))
  return {mode:'validation_only',idempotency_key:`orangerank-validation-${record.assessment_id}`,assessment_id:record.assessment_id,
    methodology_version:record.methodology_version,report_template_version:record.report_template_version,
    customer_name:intake.customerName,customer_email:intake.email,business_name:intake.businessName,website:intake.website,business_category:intake.category,
    primary_city:intake.city,primary_state:intake.state,...(intake.serviceArea?{primary_service_area:intake.serviceArea}:{}),main_services:[intake.services],
    terms_accepted:true,terms_accepted_at:record.terms_accepted_at,optional_intake:optional,
    payment:{provider:'stripe',status:'paid',stripe_event_id:payment.event_id,checkout_session_id:payment.checkout_session_id,payment_intent_id:payment.payment_reference,amount:payment.amount,currency:payment.currency,paid_at:payment.paid_at,signature_verified:true}}
}
export async function sendGrokValidation(record: PaidRecord, config: NonNullable<ReturnType<typeof grokConfiguration>>, send:typeof fetch=fetch) {
  if(syntheticRecord(record))throw new Error('SYNTHETIC_QUARANTINE')
  const response=await send(config.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.key}`},body:JSON.stringify(grokPayload(record))})
  return response.status===200 ? 'VALIDATION_ACCEPTED' : response.status===401 || response.status===403 ? 'AUTH_REJECTED' : 'RETRY_PENDING'
}
