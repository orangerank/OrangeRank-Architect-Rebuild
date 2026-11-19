import { syntheticRecord,consistentIntake } from '../handoff/safety'
export function customerStatus(r:Record<string,unknown>,job?:Record<string,unknown>|null){
 if(r.payment_status!=='PAYMENT_CONFIRMED')return {payment:'PENDING',processing:'NOT_STARTED',message:'Payment confirmation is pending.'}
 if(syntheticRecord(r)||!consistentIntake(r)||r.identity_review!=='CLEAR'||r.payment_ownership_verified!==true)return {payment:'VERIFIED',processing:'REVIEW',message:'Payment received. Your request needs review.'}
 if(job?.validation_status==='VALIDATION_ACCEPTED'||job?.status==='ACKNOWLEDGED'||job?.status==='TRANSPORT_ACCEPTED')return {payment:'VERIFIED',processing:'ACCEPTED',message:'Payment received. Assessment information accepted. Further processing is handled separately.'}
 return {payment:'VERIFIED',processing:['RETRY_PENDING','OUTCOME_UNKNOWN','SEND_INTENT_RECORDED'].includes(String(job?.status))?'REVIEW':'AWAITING',message:'Payment received. Your assessment is awaiting processing.'}
}
