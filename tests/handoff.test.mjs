import test from 'node:test'
import assert from 'node:assert/strict'
import { LuaRedis } from './helpers/lua-redis.mjs'
import { pending,parseIntake } from '../lib/checkout/core.ts'
import { dispatchAssessment,receiverPayload,receiverConfiguration,drainOutbox } from '../lib/handoff/dispatch.ts'
import { POST } from '../app/api/internal/assessment-handoff/route.ts'
const id='OR-20261009-TEST',submission='7ad23ceb-0f56-4ddd-a524-ecac2ad32700',key=`or:intake:${submission}`,job=`or:handoff:${id}`
const now=new Date('2026-10-09T05:30:00Z')
function fixture(){const redis=new LuaRedis();const r=pending(parseIntake({businessName:'Private business',customerName:'Private person',email:'private@example.com',website:'https://private.example.com',category:'Home services',city:'Austin',state:'Texas',services:'Service',serviceArea:'Austin metro',terms_accepted:true}),id,submission,now,'https://preview.example.com','price_test');r.payment_ownership_verified=true;r.identity_review='CLEAR';r.current_status='PAYMENT_CONFIRMED';r.payment_status='PAYMENT_CONFIRMED';r.verified_payment={livemode:true,event_id:'evt_one',assessment_id:id,checkout_session_id:'cs_test_one',payment_reference:'pi_one',amount:14900,currency:'usd',confirmed_at:now.toISOString()};r.secret='DO_NOT_FORWARD';redis.rows.set(key,JSON.stringify(r));redis.rows.set(job,JSON.stringify({assessment_id:id,intake_submission_id:submission,status:'PENDING_INTEGRATION'}));return {redis,r}}
const config={endpoint:'https://receiver.example.com/approved-contract',token:'private_test_token'}
const ack=()=>new Response(JSON.stringify({contract_version:'orangerank-handoff-v1',assessment_id:id,accepted:true,ledger_recorded:true}),{status:200})
test('configured receiver contract only sends allowlisted fields and accepts durable ledger acknowledgement',async()=>{
 const {redis}=fixture();let count=0
 const send=async(url,options)=>{count++;assert.equal(url,config.endpoint);assert.equal(options.redirect,'error');assert.equal(options.headers['Idempotency-Key'],`orangerank-assessment-${id}`);const body=JSON.parse(options.body);assert.equal(body.intake.customer_email,'private@example.com');assert.equal(body.payment.reference,'pi_one');assert.equal(body.payment.amount,14900);assert.equal(body.payment.list_amount,14900);assert.equal(body.payment.discount_amount,0);assert.equal(body.payment.promotion_code,null);assert.ok(!options.body.includes('DO_NOT_FORWARD'));assert.ok(!options.body.includes('fingerprint'));return ack()}
 assert.equal(await dispatchAssessment(redis,submission,config,send,now),'TRANSPORT_ACCEPTED');assert.equal(await dispatchAssessment(redis,submission,config,send,now),'TRANSPORT_ACCEPTED');assert.equal(count,1);assert.equal(JSON.parse(redis.rows.get(key)).current_status,'PAYMENT_CONFIRMED');assert.equal(JSON.parse(redis.rows.get(key)).handoff_status,undefined)
})
test('operational failure holds without resend; concurrent attempts transmit once',async()=>{
 const f=fixture();let calls=0;const send=async()=>{calls++;throw Error('timeout')}
 assert.equal(await dispatchAssessment(f.redis,submission,config,send,now),'OUTCOME_UNKNOWN')
 assert.equal(await dispatchAssessment(f.redis,submission,config,send,new Date(now.getTime()+61000)),'OUTCOME_UNKNOWN');assert.equal(calls,1)
 const g=fixture();let sent=0;const results=await Promise.all([dispatchAssessment(g.redis,submission,config,async()=>{sent++;return new Response('',{status:200})},now),dispatchAssessment(g.redis,submission,config,async()=>{sent++;return new Response('',{status:200})},now)])
 assert.ok(results.includes('TRANSPORT_ACCEPTED'));assert.equal(sent,1)
})
test('unconfigured integration and unverified records cannot send; batch drain resumes cursor',async()=>{
 const {redis,r}=fixture();assert.equal(await dispatchAssessment(redis,submission,null),'PENDING_INTEGRATION');r.payment_status='PENDING';assert.throws(()=>receiverPayload(r));redis.rows.set(key,JSON.stringify(r));assert.equal(await dispatchAssessment(redis,submission,config),'REVIEW')
 redis.scan=async cursor=>{assert.equal(cursor,0);return [12,[job]]};const result=await drainOutbox(redis,0,config);assert.equal(result.cursor,12)
})
test('internal dispatch is authenticated, bounded and Production remains blocked',async()=>{
 const old={...process.env};try{Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'true',STRIPE_SECRET_KEY:'sk_test_dummy',ORANGERANK_DISPATCH_SECRET:'x'.repeat(32)})
 const req=()=>new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',body:'{}'})
 assert.equal((await POST(req())).status,401);process.env.VERCEL_ENV='production';assert.equal((await POST(req())).status,503)
 process.env.ORANGERANK_HANDOFF_ENABLED='false';assert.equal(receiverConfiguration(),null);process.env.ORANGERANK_HANDOFF_ENABLED='true';process.env.ORANGERANK_HANDOFF_URL='https://user:pass@host.example.com';process.env.ORANGERANK_HANDOFF_TOKEN='test';assert.equal(receiverConfiguration(),null)
 }finally{for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old)}
})

test('missing outbox or mismatched versions/payment cannot hand off',async()=>{
 const f=fixture();f.redis.rows.delete(job);assert.equal(await dispatchAssessment(f.redis,submission,config,async()=>{throw new Error('must not send')},now),'MISSING')
 for(const change of [r=>r.methodology_version='changed',r=>r.report_template_version='changed',r=>r.verified_payment.amount=100,r=>r.verified_payment.assessment_id='other',r=>r.current_status='APPROVED']){const g=fixture();change(g.r);g.redis.rows.set(key,JSON.stringify(g.r));assert.equal(await dispatchAssessment(g.redis,submission,config,async()=>{throw new Error('must not send')},now),'REVIEW')}
})
test('authenticated audit reads only and returns no original values; no dispatch or Redis writes',async()=>{
 const {mock}=await import('node:test');const saved={...process.env};const {r}=fixture();delete r.terms_accepted_at
 try{Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'true',STRIPE_SECRET_KEY:'sk_test_dummy',ORANGERANK_AUDIT_SECRET:'x'.repeat(32),UPSTASH_REDIS_REST_URL:'https://redis.example.com',UPSTASH_REDIS_REST_TOKEN:'dummy'})
 let calls=0;mock.method(globalThis,'fetch',async(_url,o)=>{calls++;const body=JSON.parse(o.body);const pipeline=Array.isArray(body[0]);for(const c of pipeline?body:[body])assert.equal(String(c[0]).toLowerCase(),'get');const value={result:Buffer.from(JSON.stringify(r)).toString('base64')};return new Response(JSON.stringify(pipeline?[value]:value),{status:200})})
 const response=await POST(new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'x'.repeat(32)},body:JSON.stringify({audit_submission_id:submission})}));assert.equal(response.status,200);const body=await response.json();assert.equal(body.result,'AUDIT_ONLY');assert.ok(body.issues.some(i=>i.field==='terms_accepted_at'&&i.status==='missing'));assert.ok(!JSON.stringify(body).includes('private@example.com'));assert.equal(calls,1)
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})

test('audit credential cannot dispatch/drain/write even when secrets are accidentally equal',async()=>{
 const {mock}=await import('node:test');const saved={...process.env}
 try{Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'true',STRIPE_SECRET_KEY:'sk_test_dummy',ORANGERANK_AUDIT_SECRET:'a'.repeat(32),ORANGERANK_DISPATCH_SECRET:'a'.repeat(32)})
 let calls=0;mock.method(globalThis,'fetch',async()=>{calls++;throw new Error('no network allowed')})
 for(const body of [{intake_submission_id:submission},{cursor:0},{audit_submission_id:submission,cursor:0},{audit_submission_id:submission,intake_submission_id:submission}]){
  const response=await POST(new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'a'.repeat(32)},body:JSON.stringify(body)}));assert.equal(response.status,403)
 }
 assert.equal(calls,0)
 process.env.ORANGERANK_DISPATCH_SECRET='b'.repeat(32)
 const response=await POST(new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'b'.repeat(32)},body:JSON.stringify({audit_submission_id:submission})}));assert.equal(response.status,403);assert.equal(calls,0)
 process.env.VERCEL_ENV='development';const dev=await POST(new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'a'.repeat(32)},body:JSON.stringify({audit_submission_id:submission})}));assert.equal(dev.status,401)
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})

test('one-way receipt failures before and after persistence never retransmit; expired intent stays held',async()=>{
 const {operationalFinishScript,operationalClaimScript}=await import('../lib/handoff/dispatch.ts')
 for(const when of ['before','after']){const f=fixture();const base=f.redis.eval.bind(f.redis);let inject=true,calls=0
 f.redis.eval=async(script,...args)=>{if(script===operationalFinishScript&&inject){inject=false;if(when==='before')throw Error('receipt write failed');await base(script,...args);throw Error('receipt acknowledgement lost')}return base(script,...args)}
 const send=async()=>{calls++;return new Response('',{status:200})}
 assert.equal(await dispatchAssessment(f.redis,submission,config,send,now),'OUTCOME_UNKNOWN')
 assert.equal(await dispatchAssessment(f.redis,submission,config,send,new Date(now.getTime()+61000)),when==='after'?'TRANSPORT_ACCEPTED':'OUTCOME_UNKNOWN');assert.equal(calls,1)
 assert.equal(JSON.parse(f.redis.rows.get(key)).current_status,'PAYMENT_CONFIRMED')
 }
 const f=fixture();await f.redis.eval(operationalClaimScript,[job,key],[f.redis.rows.get(key),now.getTime(),'crashed-attempt',now.toISOString()]);let calls=0
 assert.equal(await dispatchAssessment(f.redis,submission,config,async()=>{calls++;return ack()},new Date(now.getTime()+61000)),'OUTCOME_UNKNOWN');assert.equal(calls,0)
 f.redis.scan=async()=>[0,[job]];await drainOutbox(f.redis,0,config);assert.equal(calls,0)
})
test('one-way non200 and timeout outcomes hold; response body never required or trusted',async()=>{
 for(const status of [201,401,403,500]){const f=fixture();let sends=0;const send=async()=>{sends++;return new Response('{}',{status})};assert.equal(await dispatchAssessment(f.redis,submission,config,send,now),'OUTCOME_UNKNOWN');await dispatchAssessment(f.redis,submission,config,send,new Date(now.getTime()+61000));assert.equal(sends,1)}
 const f=fixture();assert.equal(await dispatchAssessment(f.redis,submission,config,async()=>{throw new DOMException('offline timeout','TimeoutError')},now),'OUTCOME_UNKNOWN')
})
