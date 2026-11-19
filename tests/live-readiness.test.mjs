import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {NextRequest} from 'next/server'
import {stripeConfiguration,validPrice} from '../lib/checkout/config.ts'
import {processPayment} from '../lib/checkout/payments.ts'
import {pending,parseIntake,sessionParams} from '../lib/checkout/core.ts'
import {LuaRedis} from './helpers/lua-redis.mjs'
import {customerStatus} from '../lib/checkout/status.ts'
import {GET} from '../app/api/checkout/status/route.ts'
import {POST as checkout} from '../app/api/checkout/route.ts'
import {receiverPayload} from '../lib/handoff/dispatch.ts'
const now=new Date(),sub='7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
function fixture(id='OR-20261010-TEST',submission=sub,live=false){const r=pending(parseIntake({businessName:'Test',customerName:'Test',email:'Test@example.com',website:'https://example.com',category:'Home services',city:'Austin',state:'Texas',services:'Test',serviceArea:'Austin metro',terms_accepted:true}),id,submission,now,'https://example.com','price_test');const metadata=sessionParams(r).metadata;const session={id:live?'cs_live_one':'cs_test_one',object:'checkout.session',livemode:live,status:'complete',payment_status:'paid',mode:'payment',customer_details:{email:' test@EXAMPLE.com '},currency:'usd',amount_subtotal:14900,amount_total:14900,metadata,client_reference_id:id,line_items:{data:[{quantity:1,price:{id:'price_test'}}]},payment_intent:{id:'pi_shared',livemode:live,status:'succeeded',amount:14900,amount_received:14900,currency:'usd',metadata}};const event={id:id.endsWith('TEST')?'evt_one':'evt_two',object:'event',livemode:live,type:'checkout.session.completed',created:Math.floor(now.getTime()/1000),data:{object:session}};const redis=new LuaRedis();redis.rows.set(`or:intake:${submission}`,JSON.stringify(r));return {r,redis,session,event}}
const run=f=>processPayment(f.event,{checkout:{sessions:{retrieve:async()=>f.session}}},f.redis,'price_test',now,()=>{},f.event.livemode)
test('explicit environment mode configuration rejects missing mismatched credentials and unapproved live mode',()=>{
 const e={VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_dummy',STRIPE_ORANGERANK_PRICE_ID:'price_test'};assert.equal(stripeConfiguration(e).live,false)
 assert.equal(stripeConfiguration({...e,VERCEL_ENV:'production'}).live,false)
 for(const change of [{ORANGERANK_STRIPE_MODE:undefined},{STRIPE_SECRET_KEY:'sk_live_dummy'},{STRIPE_ORANGERANK_PRICE_ID:undefined},{ORANGERANK_STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_dummy'},{VERCEL_ENV:'production',ORANGERANK_STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_dummy'}])assert.throws(()=>stripeConfiguration({...e,...change}))
 assert.equal(stripeConfiguration({...e,VERCEL_ENV:'production',ORANGERANK_STRIPE_MODE:'live',STRIPE_SECRET_KEY:'sk_live_dummy',ORANGERANK_LIVE_APPROVED:'true'}).live,true)
 const price={active:true,livemode:false,currency:'usd',unit_amount:14900,type:'one_time'};assert.equal(validPrice(price,false),true)
 for(const change of [{active:false},{currency:'eur'},{unit_amount:14800},{type:'recurring'},{livemode:true}])assert.equal(validPrice({...price,...change},false),false)
})
test('checkout remains disabled without release approval even with old enabled configuration',async()=>{const saved={...process.env};try{process.env.ORANGERANK_CHECKOUT_ENABLED='true';delete process.env.ORANGERANK_CHECKOUT_RELEASE_APPROVED;assert.equal((await checkout(new NextRequest('https://example.com/api/checkout',{method:'POST'}))).status,503)}finally{for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}})
test('matching missing mismatched identity preserve financial confirmation but hold processing; live verification works',async()=>{
 for(const [email,state] of [[' test@EXAMPLE.com ','CLEAR'],[undefined,'MISSING'],['other@example.com','MISMATCH']]){const f=fixture();f.session.customer_details={email};assert.equal(await run(f),'CONFIRMED');const r=JSON.parse(f.redis.rows.get(`or:intake:${sub}`));assert.equal(r.identity_review,state);assert.equal(r.customer_email,'Test@example.com');assert.equal(r.payment_status,'PAYMENT_CONFIRMED');if(state!=='CLEAR')assert.throws(()=>receiverPayload(r),/PAYMENT_REVIEW/)}
 const live=fixture('OR-20261010-TEST',sub,true);assert.equal(await run(live),'CONFIRMED')
})
test('concurrent PaymentIntent ownership has one winner; same owner retries and persistence loss recover',async()=>{
 const a=fixture(),b=fixture('OR-20261010-OTHER','7ad23ceb-0f56-4ddd-a524-ecac2ad32701');b.redis=a.redis;b.redis.rows.set(`or:intake:${b.r.intake_submission_id}`,JSON.stringify(b.r));const results=await Promise.all([run(a),run(b)]);assert.equal(results.filter(r=>r==='CONFIRMED').length,1);assert.equal(results.filter(r=>r==='REVIEW').length,1);assert.equal(await run(a),'DUPLICATE');assert.equal(a.redis.rows.get('or:payment-owner:pi_shared'),a.r.assessment_id)
 const f=fixture();f.redis.failAfter=true;await assert.rejects(run(f));assert.equal(await run(f),'DUPLICATE');assert.equal(JSON.parse(f.redis.rows.get(`or:intake:${sub}`)).transition_history.length,1)
})
test('legacy paid records without ownership stay blocked and unchanged',async()=>{const f=fixture();await run(f);f.redis.rows.delete('or:payment-owner:pi_shared');f.redis.rows.delete('or:stripe:event:evt_one');const before=f.redis.rows.get(`or:intake:${sub}`);assert.equal(await run(f),'OWNERSHIP_REVIEW');assert.equal(f.redis.rows.get(`or:intake:${sub}`),before)})
test('status needs browser capability cookie; IDs in query are not authorization; unimplemented stages never claimed',async()=>{
 assert.equal((await GET(new NextRequest('https://example.com/api/checkout/status?assessment_id=OR-TEST'))).status,401)
 const f=fixture();assert.equal(customerStatus(f.r).payment,'PENDING');await run(f);const paid=JSON.parse(f.redis.rows.get(`or:intake:${sub}`));assert.equal(customerStatus(paid).processing,'AWAITING');assert.equal(customerStatus(paid,{validation_status:'VALIDATION_ACCEPTED'}).processing,'ACCEPTED');assert.equal(customerStatus({...paid,current_status:'DELIVERED'}).processing,'AWAITING')
})

test('disabled new checkout still reconciles a signed paid webhook; authorized status returns sanitized state',async()=>{
 const {POST}=await import('../app/api/stripe/webhook/route.ts');const {createRequire}=await import('node:module');const Stripe=createRequire(import.meta.url)('stripe');const saved={...process.env};const f=fixture()
 try{Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_dummy',STRIPE_ORANGERANK_PRICE_ID:'price_test',STRIPE_WEBHOOK_SECRET:'whsec_dummy',ORANGERANK_CHECKOUT_ENABLED:'false',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'false',UPSTASH_REDIS_REST_URL:'https://redis.example.com',UPSTASH_REDIS_REST_TOKEN:'dummy'});delete process.env.GROK_ROUTINE_WEBHOOK_URL
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>f.session)
 mock.method(globalThis,'fetch',async(url,o)=>{assert.ok(String(url).startsWith('https://redis.example.com/'));const body=JSON.parse(o.body),pipeline=Array.isArray(body[0]);const rows=[];for(const c of pipeline?body:[body]){const result=String(c[0]).toLowerCase()==='get'?await f.redis.get(c[1]):await f.redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])));rows.push({result:typeof result==='string'?Buffer.from(result).toString('base64'):result})}return new Response(JSON.stringify(pipeline?rows:rows[0]))})
 const payload=JSON.stringify(f.event),signature=Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_dummy'})
 assert.equal((await POST(new Request('https://example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}))).status,200)
 const status=await GET(new NextRequest('https://example.com/api/checkout/status',{headers:{cookie:`or_checkout=${sub}`}}));assert.equal(status.status,200);const data=await status.json();assert.equal(data.payment,'VERIFIED');assert.equal(data.processing,'AWAITING');assert.ok(!JSON.stringify(data).includes('example.com'))
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
