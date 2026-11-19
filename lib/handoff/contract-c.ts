import {randomUUID} from 'node:crypto'
import type {Redis} from '@upstash/redis'
import type {PaidRecord} from '../checkout/payments'
import {validatedReceiverPayload} from './dispatch'
import {consistentIntake,syntheticRecord} from './safety'
const assessmentPattern=/^OR-\d{8}-[A-Z0-9-]{1,80}$/
const submissionPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const closed=new Set(['IDENTITY_MISMATCH','TEST_MODE_UNVERIFIED','INVALID_SOURCE','SYNTHETIC_QUARANTINE','PAYMENT_REVIEW','INCONSISTENT_INTAKE','UNVERIFIED_RECORD'])
function validIds(id:string,submission:string){return assessmentPattern.test(id)&&submissionPattern.test(submission)}
function closedResult(error:unknown){return error instanceof Error&&closed.has(error.message)?error.message:'OUTCOME_UNKNOWN'}
/** Two string IDs from the intake/checkout flow. Any other shape fails closed before storage or transport. */
export function contractCRequest(body:unknown){
 if(!body||typeof body!=='object'||Array.isArray(body))return 'INVALID_REQUEST'
 const record=body as Record<string,unknown>
 if(Object.keys(record).sort().join(',')!=='assessment_id,intake_submission_id'||typeof record.assessment_id!=='string'||typeof record.intake_submission_id!=='string')return 'INVALID_REQUEST'
 return validIds(record.assessment_id,record.intake_submission_id)?'READY':'INVALID_REQUEST'
}
/** Pure construction. No sender and no pre-provisioned authorization. Services text is copied as stored, including an HTML entity such as &amp;. */
export function contractCPayload(record:PaidRecord){
 if(!validIds(record.assessment_id,record.intake_submission_id)||record.verified_payment?.assessment_id!==record.assessment_id)throw Error('IDENTITY_MISMATCH')
 if(record.verified_payment?.livemode!==false)throw Error('TEST_MODE_UNVERIFIED')
 if(!record.intake_payload||!consistentIntake(record)||syntheticRecord(record))throw Error('INVALID_SOURCE')
 const original=validatedReceiverPayload(record)
 return {...original,contract_version:'orangerank-test-handoff-v1',intake_submission_id:record.intake_submission_id,execution_mode:'TEST_MODE',assessment_payment_status:'PAYMENT_PENDING',required_artifact_label:'TEST MODE',stop_at:'HUMAN_APPROVAL',business_contact_allowed:false,customer_delivery_allowed:true,delivery_requires_human_approval:true,stripe_source_evidence:{...record.verified_payment}}
}
// One claim per assessment_id. A GET before EVAL does not prove single use, and the
// local marker does not prove the receiver performed the work only once.
// Missing, unreadable, incomplete, duplicate, or ambiguous prior-use evidence stops.
export const contractCClaimScript=`
local intake = redis.call('GET', KEYS[1])
local outbox = redis.call('GET', KEYS[2])
local owner = redis.call('GET', KEYS[3])
if not intake or not outbox or not owner then return 'INCOMPLETE_LOOKUP' end
if intake ~= ARGV[1] or outbox ~= ARGV[2] or owner ~= ARGV[3] or ARGV[3] ~= ARGV[4] then return 'REVIEW' end
local record = cjson.decode(intake)
local j = cjson.decode(outbox)
if record.assessment_id ~= ARGV[4] or record.intake_submission_id ~= ARGV[5] then return 'IDENTITY_MISMATCH' end
if not record.verified_payment or record.verified_payment.livemode ~= false or record.verified_payment.assessment_id ~= ARGV[4] then return 'TEST_MODE_UNVERIFIED' end
if j.status ~= 'PENDING_INTEGRATION' or j.operational_attempt_id or j.send_intent_at or j.validation_status or j.lease_token or j.lease_until or j.attempts or j.transport_result_at or j.claim_id then return 'PRIOR_USE_OR_UNKNOWN' end
if j.assessment_id and j.assessment_id ~= ARGV[4] then return 'IDENTITY_MISMATCH' end
if j.intake_submission_id and j.intake_submission_id ~= ARGV[5] then return 'IDENTITY_MISMATCH' end
if redis.call('GET', KEYS[4]) then return 'PRIOR_USE_OR_UNKNOWN' end
j.status = 'CLAIMED_NO_TRANSPORT'
j.claim_id = ARGV[6]
redis.call('SET', KEYS[2], cjson.encode(j))
redis.call('SET', KEYS[4], ARGV[6])
return 'CLAIMED_NO_TRANSPORT'
`
export async function claimContractC(redis:Redis,id:string,submission:string){
 try{
 if(!validIds(id,submission))return 'IDENTITY_MISMATCH'
 const raw=await redis.get<string>(`or:intake:${submission}`)
 const job=await redis.get<string>(`or:handoff:${id}`)
 if(!raw||!job)return 'INCOMPLETE_LOOKUP'
 const record=JSON.parse(raw) as PaidRecord
 if(!record.verified_payment?.payment_reference)return 'INCOMPLETE_LOOKUP'
 const owner=await redis.get<string>(`or:payment-owner:${record.verified_payment.payment_reference}`)
 if(!owner)return 'INCOMPLETE_LOOKUP'
 contractCPayload(record)
 return String(await redis.eval(contractCClaimScript,[`or:intake:${submission}`,`or:handoff:${id}`,`or:payment-owner:${record.verified_payment.payment_reference}`,`or:test-use:${id}`],[raw,job,owner,id,submission,randomUUID()]))
 }catch(error){return closedResult(error)}
}
export const contractCFinishScript=`
local raw = redis.call('GET', KEYS[1])
if not raw then return 'OUTCOME_UNKNOWN' end
local j = cjson.decode(raw)
if j.claim_id ~= ARGV[1] or j.status ~= 'CLAIMED_NO_TRANSPORT' then return 'OUTCOME_UNKNOWN' end
j.status = ARGV[2]
j.transport_result_at = ARGV[3]
redis.call('SET', KEYS[1], cjson.encode(j))
return j.status
`
export async function dispatchContractC(redis:Redis,id:string,submission:string,config:{endpoint:string;token:string}|null,send:typeof fetch=fetch){
 if(!validIds(id,submission))return 'IDENTITY_MISMATCH'
 try{
 const raw=await redis.get<string>(`or:intake:${submission}`),job=await redis.get<string>(`or:handoff:${id}`)
 if(!raw||!job)return 'INCOMPLETE_LOOKUP'
 const record=JSON.parse(raw) as PaidRecord
 if(record.assessment_id!==id||record.intake_submission_id!==submission||!record.verified_payment?.payment_reference)return 'IDENTITY_MISMATCH'
 if(!config)return 'PENDING_INTEGRATION'
 const ownerKey=`or:payment-owner:${record.verified_payment.payment_reference}`
 const owner=await redis.get<string>(ownerKey)
 if(!owner)return 'INCOMPLETE_LOOKUP'
 const payload=contractCPayload(record),claimId=randomUUID()
 const claim=await redis.eval(contractCClaimScript,[`or:intake:${submission}`,`or:handoff:${id}`,ownerKey,`or:test-use:${id}`],[raw,job,owner,id,submission,claimId])
 if(claim!=='CLAIMED_NO_TRANSPORT')return String(claim)
 let result='OUTCOME_UNKNOWN'
 try{const response=await send(config.endpoint,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.token}`,'Idempotency-Key':`orangerank-test-${id}-${submission}`},body:JSON.stringify(payload)});if(response.status===200)result='TRANSPORT_ACCEPTED'}catch{}
 try{return String(await redis.eval(contractCFinishScript,[`or:handoff:${id}`],[claimId,result,new Date().toISOString()]))}catch{return 'OUTCOME_UNKNOWN'}
 }catch(error){return closedResult(error)}
}
