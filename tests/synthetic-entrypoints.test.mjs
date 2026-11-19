import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const Stripe=createRequire(import.meta.url)('stripe')
import {POST as webhook} from '../app/api/stripe/webhook/route.ts'
import {POST as internal} from '../app/api/internal/assessment-handoff/route.ts'
import {drainOutbox} from '../lib/handoff/dispatch.ts'
import {pending,parseIntake,sessionParams} from '../lib/checkout/core.ts'
import {LuaRedis} from './helpers/lua-redis.mjs'
const submission='9b988777-b758-4893-a464-e357c56198d0',assessment='OR-20261009-ORANGERANK-SANDBOX-BUSINESS',key=`or:intake:${submission}`,job=`or:handoff:${assessment}`
function fixture(){
 const r=pending(parseIntake({businessName:'Sandbox',customerName:'Test',email:'test@example.com',website:'https://example.com',category:'Home services',city:'Austin',state:'Texas',services:'Test',serviceArea:'SYNTHETIC TEST: not geography',terms_accepted:true}),assessment,submission,new Date(),'https://preview.example.com','price_test')
 r.service_area_correction={synthetic_test_value:true,source:'authorized_sandbox_operator'}
 r.stripe_checkout_session_id='cs_test_one';r.payment_status='PAYMENT_CONFIRMED';r.payment_ownership_verified=true;r.identity_review='CLEAR';r.current_status='PAYMENT_CONFIRMED';r.handoff_status='PENDING_INTEGRATION'
 r.verified_payment={assessment_id:assessment,event_id:'evt_original',checkout_session_id:'cs_test_one',payment_reference:'pi_test',amount:14900,currency:'usd',paid_at:new Date().toISOString(),confirmed_at:new Date().toISOString()};r.transition_history=[{to:'PAYMENT_CONFIRMED'}]
 const metadata=sessionParams(r).metadata
 const session={id:'cs_test_one',object:'checkout.session',livemode:false,status:'complete',payment_status:'paid',mode:'payment',customer_details:{email:'test@example.com'},currency:'usd',amount_subtotal:14900,amount_total:14900,metadata,client_reference_id:assessment,line_items:{data:[{quantity:1,price:{id:'price_test'}}]},payment_intent:{id:'pi_test',livemode:false,status:'succeeded',amount:14900,amount_received:14900,currency:'usd',metadata}}
 const redis=new LuaRedis();redis.rows.set(key,JSON.stringify(r));redis.rows.set(job,JSON.stringify({assessment_id:assessment,intake_submission_id:submission,status:'PENDING_INTEGRATION'}))
 return {redis,session,before:new Map(redis.rows)}
}
async function isolated(fn){const saved={...process.env};try{
 Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'true',ORANGERANK_CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_dummy',STRIPE_WEBHOOK_SECRET:'whsec_dummy',STRIPE_ORANGERANK_PRICE_ID:'price_test',UPSTASH_REDIS_REST_URL:'https://redis.example.com',UPSTASH_REDIS_REST_TOKEN:'dummy',GROK_ROUTINE_WEBHOOK_URL:'https://grok.example.com/validation',GROK_ROUTINE_WEBHOOK_KEY:'dummy',ORANGERANK_HANDOFF_ENABLED:'false',ORANGERANK_DISPATCH_SECRET:'d'.repeat(32),ORANGERANK_AUDIT_SECRET:'a'.repeat(32)})
 await fn()
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}}
function redisTransport(f,allowEval=false){let outbound=0,evals=0
 mock.method(globalThis,'fetch',async(url,o)=>{
 if(!String(url).startsWith('https://redis.example.com/')){outbound++;throw Error('unexpected external transport')}
 const body=JSON.parse(o.body),pipeline=Array.isArray(body[0]);const results=[]
 for(const c of pipeline?body:[body]){
 const command=String(c[0]).toLowerCase();let value
 if(command==='get')value=await f.redis.get(c[1])
 else if(command==='eval'&&allowEval){evals++;value=await f.redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])))}
 else throw Error('prohibited store operation')
 results.push({result:value})
 }
 return new Response(JSON.stringify(pipeline?results:results[0]))
 });return ()=>({outbound,evals})
}
test('synthetic signed Stripe webhook keeps confirmed payment and pending outbox; zero outbound handoff',async()=>isolated(async()=>{
 const f=fixture(),counts=redisTransport(f,true)
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session)
 const event={id:'evt_quarantineRetry',object:'event',livemode:false,type:'checkout.session.completed',created:Math.floor(Date.now()/1000),data:{object:f.session}}
 const payload=JSON.stringify(event),signature=Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_dummy'})
 assert.equal((await webhook(new Request('https://preview.example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}))).status,200)
 assert.equal(f.redis.rows.get(key),f.before.get(key));assert.equal(f.redis.rows.get(job),f.before.get(job));assert.equal(f.redis.rows.get('or:stripe:event:evt_quarantineRetry'),undefined);assert.deepEqual(counts(),{outbound:0,evals:1})
}))
test('synthetic authenticated internal dispatch returns REVIEW with no writes or outbound actions',async()=>isolated(async()=>{
 const f=fixture(),counts=redisTransport(f)
 const response=await internal(new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'d'.repeat(32)},body:JSON.stringify({intake_submission_id:submission})}))
 assert.equal(response.status,409);assert.deepEqual(await response.json(),{result:'REVIEW'});assert.deepEqual(f.redis.rows,f.before);assert.deepEqual(counts(),{outbound:0,evals:0})
}))
test('synthetic outbox drain scans locally but never claims writes dispatches or delivers',async()=>isolated(async()=>{
 const f=fixture();let mutations=0,scans=0
 f.redis.scan=async()=>{scans++;return [0,[job]]}
 f.redis.eval=async()=>{mutations++;throw Error('forbidden claim')};f.redis.set=async()=>{mutations++;throw Error('forbidden write')}
 const counts=redisTransport(f)
 assert.deepEqual(await drainOutbox(f.redis,0,null),{cursor:0,processed:1,result:'DRAINED'})
 assert.equal(scans,1);assert.equal(mutations,0);assert.deepEqual(counts(),{outbound:0,evals:0});assert.deepEqual(f.redis.rows,f.before)
 // processed counts inspected jobs, not dispatched/accepted assessments.
}))

for(const [field,value] of [['businessName','Different Business'],['email','other@example.com'],['website','https://other.example.com'],['city','Miami'],['state','Florida'],['serviceArea','Miami metro']]){
 test(`inconsistent ${field}: signed webhook, internal dispatch and drain reject before claim/transport`,async()=>isolated(async()=>{
  const f=fixture();const r=JSON.parse(f.redis.rows.get(key));delete r.service_area_correction;r.service_area='Austin metro';r.intake_payload.serviceArea='Austin metro';r.intake_payload[field]=value;f.redis.rows.set(key,JSON.stringify(r));const before=new Map(f.redis.rows)
  const {receiverPayload}=await import('../lib/handoff/dispatch.ts');const {grokPayload}=await import('../lib/handoff/grok.ts')
  assert.throws(()=>receiverPayload(r),/INCONSISTENT_INTAKE/);assert.throws(()=>grokPayload(r),/INCONSISTENT_INTAKE/)
  const counts=redisTransport(f,true)
  mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session)
  const event={id:'evt_consistencyRetry',object:'event',livemode:false,type:'checkout.session.completed',created:Math.floor(Date.now()/1000),data:{object:f.session}}
  const payload=JSON.stringify(event),signature=Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_dummy'})
  assert.equal((await webhook(new Request('https://preview.example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}))).status,200)
  const response=await internal(new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'d'.repeat(32)},body:JSON.stringify({intake_submission_id:submission})}))
  assert.deepEqual(await response.json(),{result:'REVIEW'})
  let writes=0;f.redis.scan=async()=>[0,[job]];f.redis.eval=async()=>{writes++;throw Error('no claim')}
  await drainOutbox(f.redis,0,null);assert.equal(writes,0)
  assert.equal(f.redis.rows.get(key),before.get(key));assert.equal(f.redis.rows.get(job),before.get(job));assert.deepEqual(counts(),{outbound:0,evals:1})
 }))
}

test('Preview REVIEW diagnostics distinguish synthetic quarantine from inconsistent intake without values',async()=>isolated(async()=>{
 const logs=[];mock.method(console,'info',line=>logs.push(JSON.parse(line)))
 const f=fixture();redisTransport(f)
 const request=()=>new Request('https://preview.example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'d'.repeat(32)},body:JSON.stringify({intake_submission_id:submission})})
 await internal(request())
 assert.deepEqual(logs.find(l=>l.event==='orangerank_handoff_review'),{event:'orangerank_handoff_review',result:'REVIEW',reason:'SYNTHETIC_QUARANTINE'})
 logs.length=0;const r=JSON.parse(f.redis.rows.get(key));delete r.service_area_correction;r.service_area='Austin metro';r.intake_payload.serviceArea='Miami metro';f.redis.rows.set(key,JSON.stringify(r))
 await internal(request())
 assert.deepEqual(logs.find(l=>l.event==='orangerank_handoff_review'),{event:'orangerank_handoff_review',result:'REVIEW',reason:'INCONSISTENT_INTAKE'})
 assert.ok(!JSON.stringify(logs).includes('Miami'));assert.ok(!JSON.stringify(logs).includes(submission))
}))
