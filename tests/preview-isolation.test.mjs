import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
const Stripe=createRequire(import.meta.url)('stripe')
import {POST} from '../app/api/stripe/webhook/route.ts'
import {grokConfiguration} from '../lib/handoff/grok.ts'
import {receiverConfiguration,dispatchAssessment,drainOutbox} from '../lib/handoff/dispatch.ts'
import {pending,parseIntake,sessionParams} from '../lib/checkout/core.ts'
import {LuaRedis} from './helpers/lua-redis.mjs'
test('branch isolation overrides inherited destinations: signed payment persists eligible outbox with zero processing requests',async()=>{
 const saved={...process.env};const id='OR-20261010-ISOLATION',sub='7ad23ceb-0f56-4ddd-a524-ecac2ad32700',key=`or:intake:${sub}`,job=`or:handoff:${id}`;const redis=new LuaRedis()
 try{
 Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',STRIPE_SECRET_KEY:'sk_test_dummy',STRIPE_ORANGERANK_PRICE_ID:'price_test',STRIPE_WEBHOOK_SECRET:'whsec_dummy',UPSTASH_REDIS_REST_URL:'https://redis.example.com',UPSTASH_REDIS_REST_TOKEN:'dummy',GROK_ROUTINE_WEBHOOK_URL:'DISABLED_FOR_CHECKOUT_ONLY',GROK_ROUTINE_WEBHOOK_KEY:'inherited_dummy',ORANGERANK_HANDOFF_ENABLED:'false',ORANGERANK_HANDOFF_URL:'https://receiver.example.com',ORANGERANK_HANDOFF_TOKEN:'inherited_dummy',ORANGERANK_CHECKOUT_ENABLED:'false',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'false'})
 assert.equal(grokConfiguration(),null);assert.equal(receiverConfiguration(),null)
 const r=pending(parseIntake({businessName:'Test',customerName:'Test',email:'test@example.com',website:'https://example.com',category:'Home services',city:'Austin',state:'Texas',services:'Test',serviceArea:'Austin metro',terms_accepted:true}),id,sub,new Date(),'https://example.com','price_test');redis.rows.set(key,JSON.stringify(r));const metadata=sessionParams(r).metadata
 const session={id:'cs_test_one',object:'checkout.session',livemode:false,status:'complete',payment_status:'paid',mode:'payment',customer_details:{email:'test@example.com'},currency:'usd',amount_subtotal:14900,amount_total:14900,metadata,client_reference_id:id,line_items:{data:[{quantity:1,price:{id:'price_test'}}]},payment_intent:{id:'pi_test',livemode:false,status:'succeeded',amount:14900,amount_received:14900,currency:'usd',metadata}}
 mock.method(Object.getPrototypeOf(new Stripe('sk_test_dummy').checkout.sessions),'retrieve',async()=>session)
 let processing=0,storeCalls=0
 mock.method(globalThis,'fetch',async(url,o)=>{if(!String(url).startsWith('https://redis.example.com/')){processing++;throw Error('prohibited processing transport')}storeCalls++;const b=JSON.parse(o.body),pipeline=Array.isArray(b[0]),rows=[];for(const c of pipeline?b:[b]){const value=String(c[0]).toLowerCase()==='get'?await redis.get(c[1]):await redis.eval(c[1],c.slice(3,3+Number(c[2])),c.slice(3+Number(c[2])));rows.push({result:typeof value==='string'?Buffer.from(value).toString('base64'):value})}return new Response(JSON.stringify(pipeline?rows:rows[0]))})
 const event={id:'evt_isolation',object:'event',livemode:false,type:'checkout.session.completed',created:Math.floor(Date.now()/1000),data:{object:session}},payload=JSON.stringify(event),signature=Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_dummy'})
 assert.equal((await POST(new Request('https://example.com/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}))).status,200)
 const paid=JSON.parse(redis.rows.get(key));assert.equal(paid.payment_status,'PAYMENT_CONFIRMED');assert.equal(paid.identity_review,'CLEAR');assert.equal(paid.payment_ownership_verified,true);assert.equal(JSON.parse(redis.rows.get(job)).status,'PENDING_INTEGRATION')
 const before=new Map(redis.rows);let access=0;const forbidden={get:async()=>{access++;throw Error('no read')},eval:async()=>{access++;throw Error('no claim')},scan:async()=>{access++;throw Error('no scan')}}
 assert.equal(await dispatchAssessment(forbidden,sub,receiverConfiguration()),'PENDING_INTEGRATION');assert.deepEqual(await drainOutbox(forbidden,0,receiverConfiguration()),{cursor:0,processed:0,result:'PENDING_INTEGRATION'});assert.equal(access,0);assert.equal(processing,0);assert.ok(storeCalls>0);assert.deepEqual(redis.rows,before)
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
