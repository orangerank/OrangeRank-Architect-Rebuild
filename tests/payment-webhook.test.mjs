import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createRequire } from 'node:module'
const Stripe=createRequire(import.meta.url)('stripe')
import { POST } from '../app/api/stripe/webhook/route.ts'
import { processPayment } from '../lib/checkout/payments.ts'
import { pending,parseIntake,sessionParams } from '../lib/checkout/core.ts'
import { saveSession } from '../lib/checkout/payment-store.ts'
import { LuaRedis } from './helpers/lua-redis.mjs'
const submission='7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
const key=`or:intake:${submission}`
const assessment='OR-20261009-TEST'
const now=new Date()
const raw={businessName:'Private business',customerName:'Private person',email:'private@example.com',website:'https://private.example.com',category:'Home services',city:'Austin',state:'Texas',services:'Service',serviceArea:'Austin metro',terms_accepted:true}
const fixture=()=>{
 const record=pending(parseIntake(raw),assessment,submission,now,'https://preview.example.com','price_test');record.stripe_checkout_session_id='cs_test_one'
 const metadata=sessionParams(record).metadata
 const session={id:'cs_test_one',object:'checkout.session',livemode:false,status:'complete',payment_status:'paid',mode:'payment',customer_details:{email:raw.email},currency:'usd',amount_subtotal:14900,amount_total:14900,metadata,client_reference_id:assessment,line_items:{data:[{quantity:1,price:{id:'price_test'}}]},payment_intent:{id:'pi_test',livemode:false,status:'succeeded',amount:14900,amount_received:14900,currency:'usd',metadata}}
 const event={id:'evt_one',object:'event',livemode:false,type:'checkout.session.completed',created:Math.floor(now.getTime()/1000),data:{object:session}}
 const redis=new LuaRedis();redis.rows.set(key,JSON.stringify(record))
 const stripe={checkout:{sessions:{retrieve:async()=>session}}}
 return {record,session,event,redis,stripe}
}
const run=f=>processPayment(f.event,f.stripe,f.redis,'price_test',now)
test('verified payment atomically confirms and leaves handoff pending; concurrent events create one outbox',async()=>{
 const f=fixture();const results=await Promise.all([run(f),run(f)])
 assert.ok(results.includes('CONFIRMED'));assert.ok(results.includes('DUPLICATE'))
 const paid=JSON.parse(f.redis.rows.get(key));assert.equal(paid.current_status,'PAYMENT_CONFIRMED');assert.equal(paid.handoff_status,'PENDING_INTEGRATION');assert.equal(paid.transition_history.length,1)
 assert.equal(paid.verified_payment.amount,14900);assert.equal(paid.verified_payment.payment_reference,'pi_test')
 assert.equal([...f.redis.rows.keys()].filter(k=>k.startsWith('or:handoff:')).length,1)
 f.event.id='evt_two';assert.equal(await run(f),'DUPLICATE_PAYMENT');assert.equal(JSON.parse(f.redis.rows.get(key)).transition_history.length,1)
})
test('unpaid completion waits for delayed success; incomplete paid sessions go to review',async()=>{
 const f=fixture();f.session.payment_status='unpaid';assert.equal(await run(f),'UNPAID');assert.equal(JSON.parse(f.redis.rows.get(key)).current_status,'NEW')
 f.session.payment_status='paid';f.event.type='checkout.session.async_payment_succeeded';assert.equal(await run(f),'CONFIRMED')
 const g=fixture();g.session.status='open';assert.equal(await run(g),'REVIEW');assert.equal(JSON.parse(g.redis.rows.get(key)).current_status,'NEW')
})
test('wrong amount currency mode product metadata versions line item or payment intent go to review',async()=>{
 const changes=[s=>s.amount_total=14800,s=>s.currency='eur',s=>s.mode='subscription',s=>s.metadata={...s.metadata,product:'other'},s=>s.metadata={...s.metadata,methodology_version:'other'},s=>s.client_reference_id='other',s=>s.line_items.data[0].price.id='other',s=>s.payment_intent.amount_received=100,s=>s.payment_intent.metadata={...s.metadata,customer_email:'other'},s=>s.payment_intent.status='processing']
 for(const change of changes){const f=fixture();change(f.session);assert.equal(await run(f),'REVIEW');assert.equal(JSON.parse(f.redis.rows.get(key)).current_status,'NEW');assert.ok(!f.redis.rows.has(`or:handoff:${assessment}`))}
})
test('unknown assessment, malformed references, unexpected state and double payment are held safely',async()=>{
 const f=fixture();f.redis.rows.delete(key);assert.equal(await run(f),'REVIEW')
 const g=fixture();g.session.metadata={...g.session.metadata,intake_submission_id:'bad'};assert.equal(await run(g),'REVIEW')
 const h=fixture();h.record.current_status='APPROVED';h.redis.rows.set(key,JSON.stringify(h.record));assert.equal(await run(h),'REVIEW');assert.equal(JSON.parse(h.redis.rows.get(key)).current_status,'APPROVED')
 const i=fixture();await run(i);i.event.id='evt_double';i.session.id='cs_test_two';assert.equal(await run(i),'REVIEW');assert.equal(JSON.parse(i.redis.rows.get(key)).verified_payment.checkout_session_id,'cs_test_one')
})
test('interrupted processing and lost acknowledgements recover without duplicate transitions; missing outbox is repairable',async()=>{
 const f=fixture();f.redis.failBefore=true;await assert.rejects(run(f));assert.ok(!f.redis.rows.has('or:stripe:event:evt_one'));assert.equal(await run(f),'CONFIRMED')
 const g=fixture();g.redis.failAfter=true;await assert.rejects(run(g));assert.equal(await run(g),'DUPLICATE');assert.equal(JSON.parse(g.redis.rows.get(key)).transition_history.length,1)
 g.redis.rows.delete(`or:handoff:${assessment}`);g.event.id='evt_recovery';assert.equal(await run(g),'DUPLICATE_PAYMENT');assert.ok(g.redis.rows.has(`or:handoff:${assessment}`))
})
test('checkout session persistence cannot downgrade confirmed records; conflict retries do not acknowledge early',async()=>{
 const f=fixture();await run(f);await saveSession(f.redis,submission,'cs_test_one');assert.equal(JSON.parse(f.redis.rows.get(key)).current_status,'PAYMENT_CONFIRMED')
 await assert.rejects(saveSession(f.redis,submission,'cs_test_other'))
 const g=fixture();const get=g.redis.get.bind(g.redis);g.redis.get=async k=>{const result=await get(k);g.record.current_status='APPROVED';g.redis.rows.set(k,JSON.stringify(g.record));return result}
 assert.equal(await run(g),'RETRY');assert.ok(!g.redis.rows.has('or:stripe:event:evt_one'))
})
test('missing handoff integration never starts bots; pending outbox survives and is not replaced on retry',async()=>{
 const f=fixture();await run(f);const outbox=f.redis.rows.get(`or:handoff:${assessment}`);assert.equal(JSON.parse(outbox).status,'PENDING_INTEGRATION')
 f.event.id='evt_retry';await run(f);assert.equal(f.redis.rows.get(`or:handoff:${assessment}`),outbox)
 // No receiver exists: external handoff failure/recovery cannot be honestly tested.
})
async function env(fn){const saved={...process.env};Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'true',ORANGERANK_CHECKOUT_ENABLED:'true',STRIPE_SECRET_KEY:'sk_test_dummy',STRIPE_WEBHOOK_SECRET:'whsec_dummy',STRIPE_ORANGERANK_PRICE_ID:'price_test',UPSTASH_REDIS_REST_URL:'https://redis.example.com',UPSTASH_REDIS_REST_TOKEN:'dummy'});try{await fn()}finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}}
function signed(event,secret='whsec_dummy'){const payload=JSON.stringify(event);const signature=Stripe.webhooks.generateTestHeaderString({payload,secret});return new Request('https://preview.example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload})}
test('raw-body Stripe signatures: valid paid event, missing invalid tampered and malformed signatures',async()=>env(async()=>{
 const f=fixture();mock.method(Stripe.resources.Checkout.Sessions?.prototype??Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session)
 mock.method(globalThis,'fetch',async(_url,options)=>{const body=JSON.parse(options.body);const pipeline=Array.isArray(body[0]);const results=await Promise.all((pipeline?body:[body]).map(async command=>({result:String(command[0]).toLowerCase()==='get'?await f.redis.get(command[1]):await f.redis.eval(command[1],command.slice(3,3+Number(command[2])),command.slice(3+Number(command[2])))})));return new Response(JSON.stringify(pipeline?results:results[0]),{status:200})})
 assert.equal((await POST(signed(f.event))).status,200);assert.equal(JSON.parse(f.redis.rows.get(key)).payment_status,'PAYMENT_CONFIRMED')
 assert.equal((await POST(new Request('https://preview.example.com/api/stripe/webhook',{method:'POST',body:'{}'}))).status,400)
 assert.equal((await POST(signed(f.event,'whsec_wrong'))).status,400)
 assert.equal((await POST(signed({}))).status,400)
 const request=signed(f.event);const signature=request.headers.get('stripe-signature');assert.equal((await POST(new Request(request.url,{method:'POST',headers:{'stripe-signature':signature},body:JSON.stringify({...f.event,id:'evt_tampered'})}))).status,400)
}))
test('production webhook logs the stage and result without the customer email',async()=>env(async()=>{
 const f=fixture();f.session.amount_total=0;f.session.payment_status='no_payment_required';f.session.payment_intent={id:'pi_zero'}
 process.env.VERCEL_ENV='production'
 const logs=[];mock.method(console,'info',s=>logs.push(String(s)))
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session)
 mock.method(globalThis,'fetch',async(_url,options)=>{const body=JSON.parse(options.body);const pipeline=Array.isArray(body[0]);const results=await Promise.all((pipeline?body:[body]).map(async command=>({result:String(command[0]).toLowerCase()==='get'?await f.redis.get(command[1]):await f.redis.eval(command[1],command.slice(3,3+Number(command[2])),command.slice(3+Number(command[2])))})));const encoded=results.map(row=>({result:typeof row.result==='string'?Buffer.from(row.result).toString('base64'):row.result}));return new Response(JSON.stringify(pipeline?encoded:encoded[0]),{status:200})})
 assert.equal((await POST(signed(f.event))).status,200)
 const line=logs.map(item=>JSON.parse(item)).find(item=>item.event==='orangerank_payment_webhook'&&item.stage==='DURABLE_PAYMENT')
 assert.equal(line.result,'REVIEW')
 assert.equal(logs.join('').includes(raw.email),false)
 assert.equal(logs.join('').includes('sk_test_dummy'),false)
}))
test('webhook production/live guard remains blocked and transient errors request retries without leaking objects',async()=>env(async()=>{
 const f=fixture();process.env.VERCEL_ENV='production';process.env.STRIPE_SECRET_KEY='sk_live_dummy';assert.equal((await POST(signed(f.event))).status,503);process.env.VERCEL_ENV='preview';assert.equal((await POST(signed(f.event))).status,503)
 process.env.STRIPE_SECRET_KEY='sk_test_dummy';mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>{throw new Error(JSON.stringify(raw))})
 const logs=[];mock.method(console,'info',s=>logs.push(s));assert.equal((await POST(signed(f.event))).status,503);assert.ok(!logs.join('').includes(raw.email));assert.ok(!logs.join('').includes(raw.businessName))
}))

test('irrelevant/live events do not touch providers; permanently unknown Stripe Session is reviewed',async()=>{
 const f=fixture();f.stripe.checkout.sessions.retrieve=async()=>{throw new Error('must not call')}
 f.event.type='payment_intent.succeeded';assert.equal(await run(f),'IGNORED')
 f.event.type='checkout.session.completed';f.event.livemode=true;assert.equal(await run(f),'REJECTED')
 f.event.livemode=false;f.stripe.checkout.sessions.retrieve=async()=>{throw Object.assign(new Error('missing'),{code:'resource_missing'})};assert.equal(await run(f),'REVIEW');assert.equal(f.redis.rows.get('or:stripe:event:evt_one'),'REVIEW')
})
test('paid record is linked even before Session-ID save; approved records are not downgraded by duplicates',async()=>{
 const f=fixture();f.record.stripe_checkout_session_id=null;f.redis.rows.set(key,JSON.stringify(f.record));assert.equal(await run(f),'CONFIRMED')
 let paid=JSON.parse(f.redis.rows.get(key));assert.equal(paid.stripe_checkout_session_id,'cs_test_one');paid.current_status='APPROVED';f.redis.rows.set(key,JSON.stringify(paid));f.event.id='evt_later';assert.equal(await run(f),'DUPLICATE_PAYMENT');assert.equal(JSON.parse(f.redis.rows.get(key)).current_status,'APPROVED')
})
test('signed sandbox payment automatically sends Contract C once and does not call validation_only',async()=>env(async()=>{
 const f=fixture();f.record.intake_payload.services='Heating &amp; Cooling';f.record.primary_services='Heating &amp; Cooling';f.redis.rows.set(key,JSON.stringify(f.record))
 Object.assign(process.env,{GROK_ROUTINE_WEBHOOK_URL:'https://routine.example.com/webhook',GROK_ROUTINE_WEBHOOK_KEY:'dummy_grok_key',ORANGERANK_HANDOFF_ENABLED:'true',ORANGERANK_HANDOFF_URL:'https://handoff.example.com/contract',ORANGERANK_HANDOFF_TOKEN:'dummy_handoff_token'})
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session)
 let calls=0,routine=0
 mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url)==='https://routine.example.com/webhook'){routine++;throw Error('validation_only must stay blocked')}
  if(String(url)==='https://handoff.example.com/contract'){calls++;assert.equal(options.headers.Authorization,'Bearer dummy_handoff_token');assert.equal(options.method,'POST');const payload=JSON.parse(options.body);assert.equal(payload.contract_version,'orangerank-test-handoff-v1');assert.equal(payload.assessment_id,assessment);assert.equal(payload.intake_submission_id,submission);assert.equal(payload.execution_mode,'TEST_MODE');assert.equal(payload.assessment_payment_status,'PAYMENT_PENDING');assert.equal(payload.stop_at,'HUMAN_APPROVAL');assert.equal(payload.business_contact_allowed,false);assert.equal(payload.customer_delivery_allowed,true);assert.equal(payload.delivery_requires_human_approval,true);assert.equal(payload.intake.primary_services,'Heating &amp; Cooling');assert.equal(payload.stripe_source_evidence.livemode,false);assert.equal(payload.mode,undefined);return new Response('',{status:200})}
  const body=JSON.parse(options.body); const pipeline=Array.isArray(body[0]);const results=await Promise.all((pipeline?body:[body]).map(async c=>({result:String(c[0]).toLowerCase()==='get'?await f.redis.get(c[1]):await f.redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])))})));const encoded=results.map(row=>({result:typeof row.result==='string'?Buffer.from(row.result).toString('base64'):row.result}));return new Response(JSON.stringify(pipeline?encoded:encoded[0]),{status:200})
 })
 assert.equal((await POST(signed(f.event))).status,200);assert.equal((await POST(signed(f.event))).status,200);assert.equal(calls,1);assert.equal(routine,0);assert.equal(JSON.parse(f.redis.rows.get(`or:handoff:${assessment}`)).status,'TRANSPORT_ACCEPTED');assert.equal(JSON.parse(f.redis.rows.get(key)).current_status,'PAYMENT_CONFIRMED');assert.equal(JSON.parse(f.redis.rows.get(key)).verified_payment.livemode,false)
}))
test('production sandbox checkout sends Contract C and a live payment sends Contract B',async()=>env(async()=>{
 const {grokConfiguration}=await import('../lib/handoff/grok.ts')
 const sandbox=fixture();sandbox.record.intake_payload.services='Heating &amp; Cooling';sandbox.record.primary_services='Heating &amp; Cooling';sandbox.redis.rows.set(key,JSON.stringify(sandbox.record))
 Object.assign(process.env,{VERCEL_ENV:'production',ORANGERANK_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_dummy',GROK_ROUTINE_WEBHOOK_URL:'https://routine.example.com/webhook',GROK_ROUTINE_WEBHOOK_KEY:'dummy_grok_key',ORANGERANK_HANDOFF_ENABLED:'true',ORANGERANK_HANDOFF_URL:'https://handoff.example.com/contract',ORANGERANK_HANDOFF_TOKEN:'dummy_handoff_token'})
 assert.equal(grokConfiguration(),null)
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>sandbox.session)
 let contract=''
 mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url)==='https://routine.example.com/webhook')throw Error('validation_only must stay blocked')
  if(String(url)==='https://handoff.example.com/contract'){const payload=JSON.parse(options.body);contract=payload.contract_version;assert.equal(payload.execution_mode,'TEST_MODE');assert.equal(payload.stripe_source_evidence.livemode,false);assert.equal(payload.mode,undefined);return new Response('',{status:200})}
  const body=JSON.parse(options.body); const pipeline=Array.isArray(body[0]);const results=await Promise.all((pipeline?body:[body]).map(async c=>({result:String(c[0]).toLowerCase()==='get'?await sandbox.redis.get(c[1]):await sandbox.redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])))})));const encoded=results.map(row=>({result:typeof row.result==='string'?Buffer.from(row.result).toString('base64'):row.result}));return new Response(JSON.stringify(pipeline?encoded:encoded[0]),{status:200})
 })
 assert.equal((await POST(signed(sandbox.event))).status,200);assert.equal(contract,'orangerank-test-handoff-v1')
 const live=fixture();live.event.livemode=true;live.session.id='cs_live_one';live.session.livemode=true;live.session.payment_intent.livemode=true;live.record.stripe_checkout_session_id='cs_live_one';live.redis=new (await import('./helpers/lua-redis.mjs')).LuaRedis();live.redis.rows.set(key,JSON.stringify(live.record))
 Object.assign(process.env,{ORANGERANK_STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_dummy',ORANGERANK_LIVE_APPROVED:'true'})
 contract=''
 mock.restoreAll()
 mock.method(Object.getPrototypeOf(new Stripe('sk_live_dummy').checkout.sessions),'retrieve',async()=>live.session)
 mock.method(globalThis,'fetch',async(url,options)=>{
  if(String(url)==='https://routine.example.com/webhook')throw Error('validation_only must stay blocked')
  if(String(url)==='https://handoff.example.com/contract'){const payload=JSON.parse(options.body);contract=payload.contract_version;assert.equal(payload.execution_mode,undefined);assert.equal(payload.mode,undefined);return new Response('',{status:200})}
  const body=JSON.parse(options.body); const pipeline=Array.isArray(body[0]);const results=await Promise.all((pipeline?body:[body]).map(async c=>({result:String(c[0]).toLowerCase()==='get'?await live.redis.get(c[1]):await live.redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])))})));const encoded=results.map(row=>({result:typeof row.result==='string'?Buffer.from(row.result).toString('base64'):row.result}));return new Response(JSON.stringify(pipeline?encoded:encoded[0]),{status:200})
 })
 const liveResponse=await POST(signed(live.event));assert.equal(liveResponse.status,200);assert.equal(contract,'orangerank-handoff-v1')
}))
