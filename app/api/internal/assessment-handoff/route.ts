import {handoffFailure,handoffHttpStatus,type HandoffStage} from '@/lib/handoff/diagnostics'
import { logAudit } from '@/lib/handoff/safety'
import { routineIssues } from '@/lib/handoff/grok'
import type { PaidRecord } from '@/lib/checkout/payments'
import { timingSafeEqual } from 'node:crypto'
import { store } from '@/lib/checkout/store'
import { dispatchAssessment, drainOutbox, receiverConfiguration } from '@/lib/handoff/dispatch'
export const runtime='nodejs'
function respond(status:number,result:string){return Response.json({result},{status,headers:{'Cache-Control':'no-store'}})}
export async function POST(request:Request){
  if(process.env.VERCEL_ENV==='production' || !process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))return respond(503,'DISABLED')
  const supplied=request.headers.get('authorization')??''
  function authorized(secret:string|undefined){
    if(!secret || secret.length<32 || supplied.length>1024)return false
    const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(supplied)
    return expected.length===actual.length && timingSafeEqual(expected,actual)
  }
  const auditAuthorized=process.env.VERCEL_ENV==='preview' && authorized(process.env.ORANGERANK_AUDIT_SECRET)
  const dispatchAuthorized=authorized(process.env.ORANGERANK_DISPATCH_SECRET)
  if(!auditAuthorized && !dispatchAuthorized)return respond(401,'UNAUTHORIZED')
  let stage:HandoffStage='REQUEST_READ'
  try {
    const text=await request.text();if(Buffer.byteLength(text)>256)return respond(413,'INVALID_REQUEST')
    stage='REQUEST_PARSE'
    let body
    try{body=JSON.parse(text)}catch(error){handoffFailure(stage,error);return respond(400,'INVALID_REQUEST')}
    const auditRequest=body && Object.keys(body).length===1 && typeof body.audit_submission_id==='string'
    // Audit identity takes precedence even if credentials were misconfigured equal.
    if(auditAuthorized && !auditRequest)return respond(403,'AUDIT_ONLY')
    if(auditRequest){
      if(!auditAuthorized)return respond(403,'AUDIT_AUTH_REQUIRED')
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.audit_submission_id))return respond(400,'INVALID_REQUEST')
      stage='REDIS_INITIALIZATION'
      const redis=store(false)
      stage='AUDIT_READ'
      const raw=await redis.get<string>(`or:intake:${body.audit_submission_id}`)
      if(!raw){logAudit(null);return respond(404,'MISSING')}
      stage='AUDIT_PARSE'
      const record=JSON.parse(raw) as PaidRecord
      const result={result:'AUDIT_ONLY',issues:routineIssues(record)}
      logAudit(result)
      return Response.json(result,{headers:{'Cache-Control':'no-store'}})
    }
    if(body && Object.keys(body).length===1 && Number.isSafeInteger(body.cursor) && body.cursor>=0){
      stage='DRAIN'
      const result=await drainOutbox(store(false),body.cursor,receiverConfiguration())
      return Response.json(result,{headers:{'Cache-Control':'no-store'}})
    }
    if(!body || typeof body.intake_submission_id!=='string' || Object.keys(body).length!==1)return respond(400,'INVALID_REQUEST')
    stage='REDIS_INITIALIZATION'
    const redis=store(false)
    const result=await dispatchAssessment(redis,body.intake_submission_id,receiverConfiguration(),fetch,new Date(),next=>{stage=next})
    const safe=['SYNTHETIC_QUARANTINE','INVALID_REFERENCE','PENDING_INTEGRATION','MISSING','REVIEW','BUSY','BACKOFF','RETRY','ACKNOWLEDGED','RETRY_PENDING','STALE_LEASE','TRANSPORT_ACCEPTED','OUTCOME_UNKNOWN','VALIDATION_ACCEPTED','AUTH_REJECTED','ORIGINAL_INTAKE_UNAVAILABLE','INVALID_ROUTINE_INTAKE'].includes(result)?result:'RETRY'
    try{console.info(JSON.stringify({event:'orangerank_handoff',result:safe,timestamp:new Date().toISOString()}))}catch{}
    return respond(handoffHttpStatus(safe),safe)
  }catch(error){handoffFailure(stage,error);if(auditAuthorized)logAudit(null);return respond(503,'RETRY')}
}
