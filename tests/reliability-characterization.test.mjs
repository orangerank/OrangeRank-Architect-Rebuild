import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const Stripe=createRequire(import.meta.url)('stripe')
import {pending,parseIntake,sessionParams} from '../lib/checkout/core.ts'
import {processPayment} from '../lib/checkout/payments.ts'
import {dispatchAssessment,receiverPayload,finishScript} from '../lib/handoff/dispatch.ts'
import {grokPayload} from '../lib/handoff/grok.ts'
import {POST} from '../app/api/stripe/webhook/route.ts'
import {LuaRedis} from './helpers/lua-redis.mjs'
const now=new Date(),submission='7ad23ceb-0f56-4ddd-a524-ecac2ad32700',assessment='OR-20261009-TEST',key=`or:intake:${submission}`,job=`or:handoff:${assessment}`
function fixture(sub=submission,id=assessment,sessionId='cs_test_one'){
 const record=pending(parseIntake({businessName:'Test Business',customerName:'Test',email:'test@example.com',website:'https://example.com',category:'Home services',city:'Austin',state:'Texas',services:'Test',serviceArea:'Austin metro',terms_accepted:true}),id,sub,now,'https://preview.example.com','price_test')
 record.stripe_checkout_session_id=sessionId
 const metadata=sessionParams(record).metadata
 const session={id:sessionId,object:'checkout.session',livemode:false,status:'complete',payment_status:'paid',mode:'payment',customer_details:{email:'test@example.com'},currency:'usd',amount_subtotal:14900,amount_total:14900,metadata,client_reference_id:id,line_items:{data:[{quantity:1,price:{id:'price_test'}}]},payment_intent:{id:'pi_shared',livemode:false,status:'succeeded',amount:14900,amount_received:14900,currency:'usd',metadata}}
 const event={id:sessionId==='cs_test_one'?'evt_one':'evt_two',object:'event',livemode:false,type:'checkout.session.completed',created:Math.floor(now.getTime()/1000),data:{object:session}}
 const redis=new LuaRedis();redis.rows.set(`or:intake:${sub}`,JSON.stringify(record))
 return {record,session,event,redis}
}
async function confirm(f){return processPayment(f.event,{checkout:{sessions:{retrieve:async()=>f.session}}},f.redis,'price_test',now)}
async function env(fn){const saved={...process.env};try{Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'true',ORANGERANK_CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_dummy',STRIPE_WEBHOOK_SECRET:'whsec_dummy',STRIPE_ORANGERANK_PRICE_ID:'price_test',UPSTASH_REDIS_REST_URL:'https://redis.example.com',UPSTASH_REDIS_REST_TOKEN:'dummy',GROK_ROUTINE_WEBHOOK_URL:'https://routine.example.com/webhook',GROK_ROUTINE_WEBHOOK_KEY:'dummy',ORANGERANK_HANDOFF_ENABLED:'false'});await fn()}finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}}
function signed(event){const payload=JSON.stringify(event);return new Request('https://preview.example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_dummy'})},body:payload})}
function transport(f,send){mock.method(globalThis,'fetch',async(url,o)=>{
 if(String(url)==='https://routine.example.com/webhook')return send(o)
 assert.ok(String(url).startsWith('https://redis.example.com/'),'only explicit in-memory Redis transport allowed')
 const body=JSON.parse(o.body),pipeline=Array.isArray(body[0]);const results=[]
 for(const c of pipeline?body:[body]){let value;if(String(c[0]).toLowerCase()==='get')value=await f.redis.get(c[1]);else {assert.equal(String(c[0]).toLowerCase(),'eval');value=await f.redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])))}results.push({result:typeof value==='string'?Buffer.from(value).toString('base64'):value})}
 return new Response(JSON.stringify(pipeline?results:results[0]))
})}
test('characterization: distinct valid mocked assessments can confirm the same PaymentIntent reference',async()=>{
 const a=fixture(),b=fixture('7ad23ceb-0f56-4ddd-a524-ecac2ad32701','OR-20261009-SECOND','cs_test_two');b.redis=a.redis;b.redis.rows.set(`or:intake:${b.record.intake_submission_id}`,JSON.stringify(b.record))
 assert.equal(await confirm(a),'CONFIRMED');assert.equal(await confirm(b),'REVIEW')
 for(const r of [a.record]){const paid=JSON.parse(a.redis.rows.get(`or:intake:${r.intake_submission_id}`));assert.equal(paid.verified_payment.payment_reference,'pi_shared');assert.equal(paid.transition_history.length,1)}
 // Local uniqueness is absent; this mocked combination makes no claim about Stripe feasibility.
})
test('lost sandbox handoff receipt does not resend or call validation_only; payment transition stays single',async()=>env(async()=>{
 const f=fixture();const requests=[];let routine=0
 Object.assign(process.env,{ORANGERANK_HANDOFF_ENABLED:'true',ORANGERANK_HANDOFF_URL:'https://handoff.example.com/contract',ORANGERANK_HANDOFF_TOKEN:'dummy'})
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session)
 mock.method(globalThis,'fetch',async(url,o)=>{
  if(String(url)==='https://routine.example.com/webhook'){routine++;throw Error('validation_only must stay blocked')}
  if(String(url)==='https://handoff.example.com/contract'){requests.push(JSON.parse(o.body));throw Error('simulated lost remote response')}
  assert.ok(String(url).startsWith('https://redis.example.com/'),'only explicit in-memory Redis transport allowed')
  const body=JSON.parse(o.body),pipeline=Array.isArray(body[0]);const results=[]
  for(const c of pipeline?body:[body]){let value;if(String(c[0]).toLowerCase()==='get')value=await f.redis.get(c[1]);else {assert.equal(String(c[0]).toLowerCase(),'eval');value=await f.redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])))}results.push({result:typeof value==='string'?Buffer.from(value).toString('base64'):value})}
  return new Response(JSON.stringify(pipeline?results:results[0]))
 })
 assert.equal((await POST(signed(f.event))).status,200);assert.equal(requests.length,1);assert.equal(requests[0].contract_version,'orangerank-test-handoff-v1');assert.equal(requests[0].execution_mode,'TEST_MODE');assert.equal(requests[0].stop_at,'HUMAN_APPROVAL');assert.equal(requests[0].customer_delivery_allowed,true);assert.equal(requests[0].delivery_requires_human_approval,true);assert.equal(requests[0].business_contact_allowed,false);assert.equal(requests[0].mode,undefined)
 assert.equal((await POST(signed(f.event))).status,200);assert.equal(requests.length,1);assert.equal(routine,0)
 assert.equal(JSON.parse(f.redis.rows.get(key)).transition_history.length,1);assert.notEqual(JSON.parse(f.redis.rows.get(job)).status,'PENDING_INTEGRATION')
}))
test('corrupt assessment/outbox JSON fails closed without outbound transport',async()=>env(async()=>{
 for(const corrupt of [key,job]){const f=fixture();await confirm(f);f.redis.rows.set(corrupt,'{broken');let sends=0;const before=new Map(f.redis.rows)
 await assert.rejects(dispatchAssessment(f.redis,submission,null,async()=>{sends++;throw Error('forbidden')},now));assert.equal(sends,0);assert.deepEqual(f.redis.rows,before)
 }
 const f=fixture();f.redis.rows.set(key,'{broken');let sends=0
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session);transport(f,async()=>{sends++;throw Error('forbidden')})
 assert.equal((await POST(signed(f.event))).status,503);assert.equal(sends,0);assert.ok(!f.redis.rows.has(job))
}))
test('Grok finish persistence before/after execution controls repeated sends and committed acceptance suppression',async()=>env(async()=>{
 for(const failure of ['before','after']){const f=fixture();await confirm(f);const requests=[];const evaluate=f.redis.eval.bind(f.redis);let inject=true
 f.redis.eval=async(script,...args)=>{if(script===finishScript&&inject){inject=false;if(failure==='before')throw Error('before completion commit');const result=await evaluate(script,...args);throw Error('lost completion acknowledgement')}return evaluate(script,...args)}
 const send=async(_url,o)=>{requests.push(JSON.parse(o.body));return new Response('',{status:200})}
 await assert.rejects(dispatchAssessment(f.redis,submission,null,send,now));const interim=JSON.parse(f.redis.rows.get(job))
 if(failure==='before'){assert.equal(interim.status,'DISPATCHING');assert.ok(interim.lease_until);assert.equal(await dispatchAssessment(f.redis,submission,null,send,now),'BUSY')}
 else{assert.equal(interim.validation_status,'VALIDATION_ACCEPTED');assert.equal(interim.status,'PENDING_INTEGRATION')}
 assert.equal(await dispatchAssessment(f.redis,submission,null,send,new Date(now.getTime()+61000)),'VALIDATION_ACCEPTED');assert.equal(requests.length,failure==='before'?2:1)
 if(requests.length===2)assert.deepEqual(requests[0],requests[1]);const final=JSON.parse(f.redis.rows.get(job));assert.equal(final.validation_status,'VALIDATION_ACCEPTED');assert.equal(final.lease_token,undefined);const paid=JSON.parse(f.redis.rows.get(key));assert.equal(paid.current_status,'PAYMENT_CONFIRMED');assert.equal(paid.transition_history.length,1)
 }
}))
