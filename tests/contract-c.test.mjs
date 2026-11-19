import {test} from 'node:test'
import assert from 'node:assert/strict'
import {pending,parseIntake} from '../lib/checkout/core.ts'
import {receiverPayload,dispatchAssessment} from '../lib/handoff/dispatch.ts'
import {contractCPayload,claimContractC,contractCRequest} from '../lib/handoff/contract-c.ts'
import {LuaRedis} from './helpers/lua-redis.mjs'
const businesses=[
 {id:'OR-20261009-HOFFMAN-BROTHERS',sub:'014bf6ac-20c7-4478-a6e5-e89975534434',reference:'pi_hoffman'},
 {id:'OR-20261010-UNIQUE-HEATING-AND-COOLING',sub:'9ac0a074-ddca-4b3e-83da-3a461861b621',reference:'pi_unique'},
]
function fixture(business=businesses[0]){
 const {id,sub,reference}=business
 const r=pending(parseIntake({businessName:'Test',customerName:'Test',email:'test@example.com',website:'https://example.com',category:'Home services',city:'Austin',state:'Texas',services:'Heating &amp; Cooling',serviceArea:'Test region',terms_accepted:true}),id,sub,new Date(),'https://example.com','price_test')
 Object.assign(r,{payment_status:'PAYMENT_CONFIRMED',current_status:'PAYMENT_CONFIRMED',payment_ownership_verified:true,identity_review:'CLEAR',verified_payment:{livemode:false,assessment_id:id,event_id:'evt_test',checkout_session_id:'cs_test_one',payment_reference:reference,amount:14900,currency:'usd',paid_at:new Date().toISOString(),confirmed_at:new Date().toISOString()}})
 const redis=new LuaRedis()
 redis.rows.set(`or:intake:${sub}`,JSON.stringify(r))
 redis.rows.set(`or:handoff:${id}`,JSON.stringify({assessment_id:id,intake_submission_id:sub,status:'PENDING_INTEGRATION'}))
 redis.rows.set(`or:payment-owner:${reference}`,id)
 return {r,redis,id,sub}
}
test('any sandbox business builds Contract C; live B is unchanged and test mode cannot use B',()=>{
 for(const business of businesses){
  const {r}=fixture(business),source=JSON.stringify(r)
  assert.throws(()=>receiverPayload(r),/SYNTHETIC_QUARANTINE/)
  const c=contractCPayload(r)
  assert.equal(c.contract_version,'orangerank-test-handoff-v1')
  assert.equal(c.assessment_id,business.id)
  assert.equal(c.intake_submission_id,business.sub)
  assert.equal(c.execution_mode,'TEST_MODE')
  assert.equal(c.mode,undefined)
  assert.equal(c.assessment_payment_status,'PAYMENT_PENDING')
  assert.equal(c.stop_at,'HUMAN_APPROVAL')
  assert.equal(c.business_contact_allowed,false)
  assert.equal(c.customer_delivery_allowed,true)
  assert.equal(c.delivery_requires_human_approval,true)
  assert.equal(c.intake.primary_services,'Heating &amp; Cooling')
  assert.equal(c.payment.amount,14900);assert.equal(c.payment.list_amount,14900);assert.equal(c.payment.discount_amount,0);assert.equal(c.payment.promotion_code,null)
  assert.equal(c.stripe_source_evidence.livemode,false)
  assert.deepEqual(c.stripe_source_evidence,r.verified_payment)
  assert.equal(JSON.stringify(r),source)
  assert.equal(contractCRequest({assessment_id:business.id,intake_submission_id:business.sub}),'READY')
 }
 const {r}=fixture()
 r.verified_payment.livemode=true
 const live=receiverPayload(r)
 assert.equal(live.contract_version,'orangerank-handoff-v1')
 assert.equal(live.payment.amount,14900);assert.equal(live.payment.list_amount,14900);assert.equal(live.payment.discount_amount,0);assert.equal(live.payment.promotion_code,null)
 assert.equal(live.execution_mode,undefined)
 assert.equal(live.assessment_payment_status,undefined)
 assert.throws(()=>contractCPayload(r),/TEST_MODE_UNVERIFIED/)
 delete r.verified_payment.livemode
 assert.throws(()=>receiverPayload(r),/SYNTHETIC_QUARANTINE/)
 assert.throws(()=>contractCPayload(r),/TEST_MODE_UNVERIFIED/)
 for(const key of ['assessment_id','intake_submission_id']){
  const f=fixture();delete f.r[key];assert.throws(()=>contractCPayload(f.r),/IDENTITY_MISMATCH/)
 }
 assert.equal(contractCRequest({}),'INVALID_REQUEST')
 assert.equal(contractCRequest({assessment_id:'not-an-id',intake_submission_id:businesses[0].sub}),'INVALID_REQUEST')
 assert.equal(contractCRequest({assessment_id:businesses[0].id,intake_submission_id:businesses[0].sub,extra:true}),'INVALID_REQUEST')
})
test('C claim is one per assessment; missing, unreadable, duplicate and ambiguous prior use stop',async()=>{
 const f=fixture()
 const results=await Promise.all([claimContractC(f.redis,f.id,f.sub),claimContractC(f.redis,f.id,f.sub)])
 assert.equal(results.filter(r=>r==='CLAIMED_NO_TRANSPORT').length,1)
 assert.notEqual(await claimContractC(f.redis,f.id,f.sub),'CLAIMED_NO_TRANSPORT')
 for(const key of [`or:intake:${f.sub}`,`or:handoff:${f.id}`,`or:payment-owner:${f.r.verified_payment.payment_reference}`]){
  const g=fixture();g.redis.rows.delete(key);assert.equal(await claimContractC(g.redis,g.id,g.sub),'INCOMPLETE_LOOKUP')
 }
 const prior=fixture();prior.redis.rows.set(`or:handoff:${prior.id}`,JSON.stringify({status:'OUTCOME_UNKNOWN',operational_attempt_id:'prior'}))
 assert.equal(await claimContractC(prior.redis,prior.id,prior.sub),'PRIOR_USE_OR_UNKNOWN')
 const ambiguous=fixture();ambiguous.redis.rows.set(`or:handoff:${ambiguous.id}`,'{')
 assert.equal(await claimContractC(ambiguous.redis,ambiguous.id,ambiguous.sub),'OUTCOME_UNKNOWN')
 assert.ok(!ambiguous.redis.rows.has(`or:test-use:${ambiguous.id}`))
 const lost=fixture();lost.redis.failAfter=true
 assert.equal(await claimContractC(lost.redis,lost.id,lost.sub),'OUTCOME_UNKNOWN')
 assert.notEqual(await claimContractC(lost.redis,lost.id,lost.sub),'CLAIMED_NO_TRANSPORT')
 const unread=fixture();const before=new Map(unread.redis.rows);unread.redis.failBefore=true
 assert.equal(await claimContractC(unread.redis,unread.id,unread.sub),'OUTCOME_UNKNOWN');assert.deepEqual(unread.redis.rows,before)
 const thrown=fixture();thrown.redis.get=async()=>{throw Error('read failed')};assert.equal(await claimContractC(thrown.redis,thrown.id,thrown.sub),'OUTCOME_UNKNOWN')
 const used=fixture();used.redis.rows.set(`or:test-use:${used.id}`,'prior');assert.equal(await claimContractC(used.redis,used.id,used.sub),'PRIOR_USE_OR_UNKNOWN')
})
test('snapshot changes and a partial claim block another dispatch',async()=>{
 const f=fixture(),base=f.redis.eval.bind(f.redis)
 f.redis.eval=async(script,keys,args)=>{f.redis.rows.set(`or:handoff:${f.id}`,JSON.stringify({status:'OUTCOME_UNKNOWN'}));return base(script,keys,args)}
 assert.equal(await claimContractC(f.redis,f.id,f.sub),'REVIEW')
 const g=fixture();const job=JSON.parse(g.redis.rows.get(`or:handoff:${g.id}`));job.status='CLAIMED_NO_TRANSPORT';job.claim_id='partial';g.redis.rows.set(`or:handoff:${g.id}`,JSON.stringify(job))
 assert.equal(await claimContractC(g.redis,g.id,g.sub),'PRIOR_USE_OR_UNKNOWN')
})
test('each sandbox assessment is sent once; a lost receipt does not resend',async()=>{
 const {dispatchContractC,contractCFinishScript}=await import('../lib/handoff/contract-c.ts')
 const config={endpoint:'https://example.com',token:'dummy'}
 let calls=0
 const send=async(_url,o)=>{calls++;const payload=JSON.parse(o.body);assert.equal(payload.contract_version,'orangerank-test-handoff-v1');assert.equal(payload.execution_mode,'TEST_MODE');assert.equal(payload.assessment_payment_status,'PAYMENT_PENDING');assert.equal(payload.stop_at,'HUMAN_APPROVAL');assert.equal(payload.business_contact_allowed,false);assert.equal(payload.customer_delivery_allowed,true);assert.equal(payload.delivery_requires_human_approval,true);assert.equal(payload.intake.primary_services,'Heating &amp; Cooling');assert.equal(payload.stripe_source_evidence.livemode,false);assert.equal(payload.mode,undefined);assert.equal(o.method,'POST');assert.equal(o.redirect,'error');return new Response('',{status:200})}
 for(const business of businesses){
  const f=fixture(business)
  const results=await Promise.all([dispatchContractC(f.redis,f.id,f.sub,config,send),dispatchContractC(f.redis,f.id,f.sub,config,send)])
  assert.ok(results.includes('TRANSPORT_ACCEPTED'))
  await dispatchContractC(f.redis,f.id,f.sub,config,send)
 }
 assert.equal(calls,businesses.length)
 const lost=fixture();const original=lost.redis.eval.bind(lost.redis);let lostCalls=0
 lost.redis.eval=async(script,...args)=>{if(script===contractCFinishScript)throw Error('lost write');return original(script,...args)}
 await dispatchContractC(lost.redis,lost.id,lost.sub,config,async()=>{lostCalls++;throw Error('timeout')})
 await dispatchContractC(lost.redis,lost.id,lost.sub,config,async()=>{lostCalls++;throw Error('timeout')})
 assert.equal(lostCalls,1)
})
test('mismatched identities never send and do not require a pre-authorization record',async()=>{
 const {dispatchContractC}=await import('../lib/handoff/contract-c.ts')
 let calls=0
 const send=async()=>{calls++;throw Error('must not send')}
 const config={endpoint:'https://example.com',token:'dummy'}
 const f=fixture(),before=new Map(f.redis.rows)
 assert.equal(await dispatchContractC(f.redis,'not-an-id',f.sub,config,send),'IDENTITY_MISMATCH')
 assert.equal(await dispatchContractC(f.redis,f.id,'7ad23ceb-0f56-4ddd-a524-ecac2ad32700',null,send),'INCOMPLETE_LOOKUP')
 const mismatch=fixture();mismatch.r.assessment_id='OR-20261010-OTHER-BUSINESS';mismatch.redis.rows.set(`or:intake:${mismatch.sub}`,JSON.stringify(mismatch.r))
 assert.equal(await dispatchContractC(mismatch.redis,mismatch.id,mismatch.sub,null,send),'IDENTITY_MISMATCH')
 assert.deepEqual(f.redis.rows,before)
 assert.equal(f.redis.rows.has(`or:test-auth:${f.id}`),false)
 const other=fixture(businesses[1])
 assert.equal(await dispatchContractC(f.redis,other.id,other.sub,config,send),'INCOMPLETE_LOOKUP')
 assert.equal(calls,0)
})
test('B test-mode payment stops with SYNTHETIC_QUARANTINE and does not write or hand off; live B payload stays unchanged',async()=>{
 const saved={...process.env}
 try{delete process.env.GROK_ROUTINE_WEBHOOK_URL;delete process.env.GROK_ROUTINE_WEBHOOK_KEY
  const f=fixture(),before=JSON.stringify([...f.redis.rows]);let calls=0
  assert.equal(await dispatchAssessment(f.redis,f.sub,{endpoint:'https://example.com',token:'dummy'},async()=>{calls++;throw Error('must not send')}),'SYNTHETIC_QUARANTINE')
  assert.equal(calls,0);assert.equal(JSON.stringify([...f.redis.rows]),before)
  f.r.verified_payment.livemode=true;f.redis.rows.set(`or:intake:${f.sub}`,JSON.stringify(f.r));let body
  assert.equal(await dispatchAssessment(f.redis,f.sub,{endpoint:'https://example.com',token:'dummy'},async(_url,options)=>{body=JSON.parse(options.body);return new Response('',{status:200})}),'TRANSPORT_ACCEPTED')
  assert.equal(body.contract_version,'orangerank-handoff-v1');assert.equal(body.execution_mode,undefined);assert.equal(body.mode,undefined);assert.equal(body.intake.primary_services,'Heating &amp; Cooling')
 }finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
test('C endpoint rejects Production, unauthenticated, and malformed requests before transport',async()=>{
 const {POST}=await import('../app/api/internal/test-handoff/route.ts');const {mock}=await import('node:test');const saved={...process.env}
 try{let calls=0;mock.method(globalThis,'fetch',async()=>{calls++;throw Error('no network')});process.env.VERCEL_ENV='production';assert.equal((await POST(new Request('https://example.com',{method:'POST'}))).status,503)
  Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_dummy',ORANGERANK_DISPATCH_SECRET:'d'.repeat(32),ORANGERANK_AUDIT_SECRET:'a'.repeat(32)})
  assert.equal((await POST(new Request('https://example.com',{method:'POST'}))).status,401)
  const headers={authorization:'Bearer '+'d'.repeat(32)}
  for(const body of ['{}','{','',JSON.stringify({assessment_id:businesses[0].id}),JSON.stringify({assessment_id:businesses[0].id,intake_submission_id:businesses[0].sub,extra:true}),JSON.stringify({assessment_id:1,intake_submission_id:businesses[0].sub}),JSON.stringify({assessment_id:'OR-not-valid',intake_submission_id:businesses[0].sub})]){
   const response=await POST(new Request('https://example.com',{method:'POST',headers,body}))
   assert.equal(response.status,400);assert.equal((await response.json()).result,'INVALID_REQUEST')
  }
  assert.equal(calls,0)
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
