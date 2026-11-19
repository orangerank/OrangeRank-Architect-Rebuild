import {handoffFailure,type HandoffStage} from './diagnostics'
import { syntheticRecord, consistentIntake } from './safety'
import { grokConfiguration, grokPayload, routineIssues, sendGrokValidation } from './grok'
import { randomUUID } from 'node:crypto'
import type { Redis } from '@upstash/redis'
import { methodology, template } from '../checkout/core'
import { paymentFacts, type PaidRecord } from '../checkout/payments'

export const claimScript = `
local raw = redis.call('GET', KEYS[1])
local assessmentRaw = redis.call('GET', KEYS[2])
if not raw or not assessmentRaw then return 'MISSING' end
if assessmentRaw ~= ARGV[1] then return 'RETRY' end
local job = cjson.decode(raw)
if job.validation_status == 'VALIDATION_ACCEPTED' then return 'VALIDATION_ACCEPTED' end
if job.status == 'ACKNOWLEDGED' then return 'ACKNOWLEDGED' end
local now = tonumber(ARGV[2])
if job.lease_until and job.lease_until > now then return 'BUSY' end
if job.next_retry_at and job.next_retry_at > now then return 'BACKOFF' end
job.status = 'DISPATCHING'
job.lease_token = ARGV[3]
job.lease_until = now + 60000
job.attempts = (job.attempts or 0) + 1
redis.call('SET', KEYS[1], cjson.encode(job))
return 'CLAIMED'
`
export const finishScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'MISSING' end
local job = cjson.decode(raw)
if job.lease_token ~= ARGV[1] then return 'STALE_LEASE' end
if ARGV[2] == 'VALIDATION_ACCEPTED' then
  job.validation_status = 'VALIDATION_ACCEPTED'
  job.status = 'PENDING_INTEGRATION'
  job.validation_accepted_at = ARGV[3]
elseif ARGV[2] == 'ACKNOWLEDGED' then
  local assessmentRaw = redis.call('GET', KEYS[2])
  if not assessmentRaw then return 'MISSING' end
  local assessment = cjson.decode(assessmentRaw)
  if assessment.payment_status ~= 'PAYMENT_CONFIRMED' then return 'REVIEW' end
  job.status = 'ACKNOWLEDGED'
  job.acknowledged_at = ARGV[3]
  assessment.handoff_status = 'ACKNOWLEDGED'
  redis.call('SET', KEYS[2], cjson.encode(assessment))
else
  job.status = 'RETRY_PENDING'
  job.next_retry_at = tonumber(ARGV[4])
end
job.lease_token = nil
job.lease_until = nil
redis.call('SET', KEYS[1], cjson.encode(job))
if ARGV[2] == 'VALIDATION_ACCEPTED' then return 'VALIDATION_ACCEPTED' end
return job.status
`
// Operational one-way attempts are never automatically reclaimed for retransmission.
export const operationalClaimScript = `
local raw = redis.call('GET', KEYS[1])
local assessmentRaw = redis.call('GET', KEYS[2])
if not raw or not assessmentRaw then return 'MISSING' end
if assessmentRaw ~= ARGV[1] then return 'REVIEW' end
local job = cjson.decode(raw)
if job.status == 'TRANSPORT_ACCEPTED' then return 'TRANSPORT_ACCEPTED' end
if job.operational_attempt_id or job.status ~= 'PENDING_INTEGRATION' then
  if job.status == 'SEND_INTENT_RECORDED' and job.lease_until and job.lease_until <= tonumber(ARGV[2]) then
    job.status = 'OUTCOME_UNKNOWN'
    redis.call('SET', KEYS[1], cjson.encode(job))
  end
  return 'OUTCOME_UNKNOWN'
end
job.status = 'SEND_INTENT_RECORDED'
job.operational_attempt_id = ARGV[3]
job.send_intent_at = ARGV[4]
job.lease_until = tonumber(ARGV[2]) + 60000
redis.call('SET', KEYS[1], cjson.encode(job))
return 'CLAIMED'
`
export const operationalFinishScript = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 'MISSING' end
local job = cjson.decode(raw)
if job.operational_attempt_id ~= ARGV[1] then return 'OUTCOME_UNKNOWN' end
if job.status == 'TRANSPORT_ACCEPTED' then return 'TRANSPORT_ACCEPTED' end
job.status = ARGV[2]
job.transport_result_at = ARGV[3]
job.lease_until = nil
redis.call('SET', KEYS[1], cjson.encode(job))
return job.status
`
export function receiverPayload(record: PaidRecord) {
  const payload=validatedReceiverPayload(record)
  if(record.verified_payment?.livemode!==true)throw new Error('SYNTHETIC_QUARANTINE')
  return payload
}
export function validatedReceiverPayload(record: PaidRecord) {
  if(syntheticRecord(record))throw new Error('SYNTHETIC_QUARANTINE')
  if((record as unknown as Record<string,unknown>).payment_ownership_verified!==true || (record as unknown as Record<string,unknown>).identity_review!=='CLEAR')throw new Error('PAYMENT_REVIEW')
  if(!consistentIntake(record))throw new Error('INCONSISTENT_INTAKE')
  if (record.current_status !== 'PAYMENT_CONFIRMED' || record.payment_status !== 'PAYMENT_CONFIRMED' || !record.verified_payment || record.verified_payment.assessment_id !== record.assessment_id || record.methodology_version !== methodology || record.report_template_version !== template) throw new Error('UNVERIFIED_RECORD')
  const facts=paymentFacts(record.verified_payment)
  if (!facts) throw new Error('UNVERIFIED_RECORD')
  // Explicit approved-intake allowlist; never forward whole Redis records/Stripe objects.
  return {contract_version:'orangerank-handoff-v1',assessment_id:record.assessment_id,
    methodology_version:methodology,report_template_version:template,
    payment:{reference:record.verified_payment.payment_reference,checkout_session_id:record.verified_payment.checkout_session_id,amount:facts.amount,list_amount:facts.list_amount,discount_amount:facts.discount_amount,promotion_code:facts.promotion_code,currency:'usd',confirmed_at:record.verified_payment.confirmed_at},
    intake:{business_name:record.business_name,website:record.website,customer_name:record.customer_name,customer_email:record.customer_email,business_category:record.business_category,primary_location:record.primary_location,primary_services:record.primary_services,terms_accepted:record.terms_accepted,phone:record.phone,service_area:record.service_area,competitors_known:record.competitors_known,google_business_url:record.google_business_url,additional_urls:record.additional_urls,notes:record.notes}}
}
export function receiverConfigurationCategory(env:NodeJS.ProcessEnv=process.env) {
  if(env.ORANGERANK_HANDOFF_ENABLED!=='true')return 'DISABLED'
  const endpoint=env.ORANGERANK_HANDOFF_URL,token=env.ORANGERANK_HANDOFF_TOKEN
  if(!endpoint || !endpoint.trim())return 'URL_EMPTY'
  let url:URL
  try{url=new URL(endpoint)}catch{return 'URL_PARSE_FAILURE'}
  if(url.protocol!=='https:')return 'NON_HTTPS'
  if(url.username || url.password || url.search || url.hash)return 'URL_COMPONENTS_REJECTED'
  if(/^(localhost|127\.|0\.|\[::1\])/.test(url.hostname))return 'LOCAL_ADDRESS_BLOCKED'
  if(!token || !token.trim())return 'TOKEN_EMPTY'
  return 'VALID'
}
export function receiverConfiguration() {
  const category=receiverConfigurationCategory()
  try{console.info(JSON.stringify({event:'orangerank_handoff_configuration',category}))}catch{}
  if(category!=='VALID')return null
  return {endpoint:process.env.ORANGERANK_HANDOFF_URL!,token:process.env.ORANGERANK_HANDOFF_TOKEN!}
}

function logReview(reason:'SYNTHETIC_QUARANTINE'|'INCONSISTENT_INTAKE') {
  try{console.info(JSON.stringify({event:'orangerank_handoff_review',result:'REVIEW',reason}))}catch{}
}
export async function dispatchAssessment(redis: Redis, submission: string, config: {endpoint:string;token:string} | null, send: typeof fetch = fetch, now = new Date(), stage:(stage:HandoffStage)=>void=()=>{}) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submission)) return 'INVALID_REFERENCE'
  const grok=grokConfiguration()
  if (grok && config) return 'REVIEW'
  if (!config && !grok) return 'PENDING_INTEGRATION'
  stage('ASSESSMENT_READ')
  const raw=await redis.get<string>(`or:intake:${submission}`)
  if (!raw) return 'MISSING'
  stage('ASSESSMENT_PARSE')
  const record: PaidRecord=JSON.parse(raw)
  stage('ELIGIBILITY')
  if(syntheticRecord(record)){logReview('SYNTHETIC_QUARANTINE');return 'REVIEW'}
  if(!consistentIntake(record)){logReview('INCONSISTENT_INTAKE');return 'REVIEW'}
  if((record as unknown as Record<string,unknown>).payment_ownership_verified!==true || (record as unknown as Record<string,unknown>).identity_review!=='CLEAR')return 'REVIEW'
  if(grok && !record.intake_payload)return 'ORIGINAL_INTAKE_UNAVAILABLE'
  if(!grok && record.verified_payment?.livemode!==true)return 'SYNTHETIC_QUARANTINE'
  if(grok){
    const issues=routineIssues(record)
    if(issues.length){
      try{console.info(JSON.stringify({event:'orangerank_routine_validation',issues,timestamp:new Date().toISOString()}))}catch{}
      return 'INVALID_ROUTINE_INTAKE'
    }
    try{grokPayload(record)}catch{return 'INVALID_ROUTINE_INTAKE'}
  }
  let payload: ReturnType<typeof receiverPayload>
  try {payload=grok?validatedReceiverPayload(record):receiverPayload(record)} catch {return 'REVIEW'}
  const keys=[`or:handoff:${record.assessment_id}`,`or:intake:${submission}`]
  const lease=randomUUID()
  stage('OUTBOX_CLAIM')
  const claim=await redis.eval(grok?claimScript:operationalClaimScript,keys,grok?[raw,now.getTime(),lease]:[raw,now.getTime(),lease,now.toISOString()])
  if (claim!=='CLAIMED') return String(claim)
  if(grok){
    let result='RETRY_PENDING'
    try { result=await sendGrokValidation(record,grok,send) } catch {}
    const saved=await redis.eval(finishScript,keys,[lease,result==='VALIDATION_ACCEPTED'?'VALIDATION_ACCEPTED':'RETRY_PENDING',new Date().toISOString(),now.getTime()+60000])
    if(saved==='STALE_LEASE' || saved==='MISSING')return String(saved)
    return result
  }
  if(!config)return 'PENDING_INTEGRATION'
  stage('TRANSPORT')
  let result='OUTCOME_UNKNOWN'
  try {
    const response=await send(config.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.token}`,'Idempotency-Key':`orangerank-assessment-${record.assessment_id}`},body:JSON.stringify(payload)})
    if(response.status===200)result='TRANSPORT_ACCEPTED'
  } catch(error) {handoffFailure('TRANSPORT',error)}
  stage('RECEIPT_PERSIST')
  try{return String(await redis.eval(operationalFinishScript,[keys[0]],[lease,result,new Date().toISOString()]))}
  catch(error){handoffFailure('RECEIPT_PERSIST',error);return 'OUTCOME_UNKNOWN'} // Persisted intent still prevents another send.

}

/** Bounded drain for an owner-operated authenticated scheduler. Redis SCAN may repeat keys;
 * leases and receiver idempotency handle duplicates. Cursor is not an assessment identifier. */
export async function drainOutbox(redis: Redis, cursor: number, config: {endpoint:string;token:string} | null) {
  if (!config && !grokConfiguration()) return {cursor:0,processed:0,result:'PENDING_INTEGRATION'}
  const [next,keys]=await redis.scan(cursor,{match:'or:handoff:*',count:1})
  let processed=0
  const started=Date.now()
  for(const key of keys){
    if(Date.now()-started>20000)return {cursor,processed,result:'CONTINUE'}
    const raw=await redis.get<string>(key)
    if(!raw)continue
    const job=JSON.parse(raw)
    if(['ACKNOWLEDGED','TRANSPORT_ACCEPTED','SEND_INTENT_RECORDED','OUTCOME_UNKNOWN'].includes(job.status) || typeof job.intake_submission_id!=='string')continue
    await dispatchAssessment(redis,job.intake_submission_id,config)
    processed++
  }
  return {cursor:Number(next),processed,result:'DRAINED'}
}
