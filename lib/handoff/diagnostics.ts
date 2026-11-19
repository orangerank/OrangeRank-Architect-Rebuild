import {sanitizedProviderError} from '../checkout/diagnostics'
export type HandoffStage='REQUEST_READ'|'REQUEST_PARSE'|'REDIS_INITIALIZATION'|'AUDIT_READ'|'AUDIT_PARSE'|'ASSESSMENT_READ'|'ASSESSMENT_PARSE'|'ELIGIBILITY'|'OUTBOX_CLAIM'|'TRANSPORT'|'RECEIPT_PERSIST'|'DRAIN'
export function handoffFailure(stage:HandoffStage,error:unknown){
 if(process.env.VERCEL_ENV!=='preview')return
 try{console.info(JSON.stringify({event:'orangerank_handoff_failure',stage,...sanitizedProviderError(error)}))}catch{}
}
export function handoffHttpStatus(result:string){
 if(['TRANSPORT_ACCEPTED','VALIDATION_ACCEPTED','ACKNOWLEDGED','PENDING_INTEGRATION'].includes(result))return 200
 if(result==='INVALID_REFERENCE')return 400
 if(result==='MISSING')return 404
 if(result==='AUTH_REJECTED')return 502
 if(['SYNTHETIC_QUARANTINE','REVIEW','ORIGINAL_INTAKE_UNAVAILABLE','INVALID_ROUTINE_INTAKE','OUTCOME_UNKNOWN','STALE_LEASE','BUSY','BACKOFF'].includes(result))return 409
 return 503
}
