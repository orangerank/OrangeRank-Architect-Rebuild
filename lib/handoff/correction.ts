import type { Redis } from '@upstash/redis'
export const testAssessment='OR-20261009-ORANGERANK-SANDBOX-BUSINESS'
export const testSubmission='9b988777-b758-4893-a464-e357c56198d0'
export function correctionInput(body:unknown) {
  if(!body || typeof body!=='object' || Array.isArray(body))return null
  const b=body as Record<string,unknown>
  if(Object.keys(b).sort().join(',')!=='assessment_id,service_area,submission_id,synthetic_test_value')return null
  if(b.assessment_id!==testAssessment || b.submission_id!==testSubmission || b.synthetic_test_value!==true)return null
  if(typeof b.service_area!=='string' || b.service_area.length>200 || !b.service_area.startsWith('SYNTHETIC TEST: ') || !b.service_area.slice(16).trim() || /[\u0000-\u001f]/.test(b.service_area))return null
  return b.service_area.trim()
}
export const correctionScript=`
local raw = redis.call('GET', KEYS[1])
if not raw then return 'MISSING' end
local r = cjson.decode(raw)
if r.assessment_id ~= ARGV[1] or r.intake_submission_id ~= ARGV[2] then return 'IDENTITY_MISMATCH' end
if r.customer_email ~= 'orangerank-test@example.com' or r.website ~= 'http://example.com' or r.payment_status ~= 'PAYMENT_CONFIRMED' or r.current_status ~= 'PAYMENT_CONFIRMED' then return 'NOT_TEST_RECORD' end
if not r.verified_payment or not r.verified_payment.checkout_session_id or string.sub(r.verified_payment.checkout_session_id,1,8) ~= 'cs_test_' then return 'NOT_TEST_RECORD' end
if not r.intake_payload then return 'INVALID_RECORD' end
if r.service_area == ARGV[3] and r.intake_payload.serviceArea == ARGV[3] and r.service_area_correction and r.service_area_correction.synthetic_test_value then return 'ALREADY_CORRECTED' end
if r.service_area_correction then return 'INVALID_RECORD' end
if r.service_area ~= '' or r.intake_payload.serviceArea ~= '' then return 'NOT_EMPTY' end
r.service_area = ARGV[3]
r.intake_payload.serviceArea = ARGV[3]
r.service_area_correction = {source='authorized_sandbox_operator', synthetic_test_value=true, corrected_at=ARGV[4]}
redis.call('SET', KEYS[1], cjson.encode(r))
return 'CORRECTED'
`
export async function correctTestServiceArea(redis:Redis,value:string,now=new Date()){
 return redis.eval(correctionScript,[`or:intake:${testSubmission}`],[testAssessment,testSubmission,value,now.toISOString()])
}
