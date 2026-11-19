import {test} from 'node:test'
import assert from 'node:assert/strict'
import {reserve} from '../lib/checkout/store.ts'
import {parseIntake} from '../lib/checkout/core.ts'
import {commitPayment} from '../lib/checkout/payment-store.ts'
import {LuaRedis} from './helpers/lua-redis.mjs'
const sub='7ad23ceb-0f56-4ddd-a524-ecac2ad32700',values=parseIntake({businessName:'Test',customerName:'Test',email:'test@example.com',website:'https://example.com',category:'Home services',city:'Austin',state:'Texas',services:'Test',serviceArea:'Test region',terms_accepted:true})
test('actual reservation Lua concurrent same-order submissions preserve one immutable intake; changed copies fail closed',async()=>{
 const redis=new LuaRedis();const [a,b]=await Promise.all([reserve(redis,values,sub,'https://example.com','price_test'),reserve(redis,values,sub,'https://example.com','price_test')]);assert.deepEqual(a,b);assert.equal(a.intake_submission_id,sub)
 const before=new Map(redis.rows)
 for(const args of [[{...values,businessName:'Other'},'https://example.com','price_test'],[values,'https://other.example.com','price_test'],[values,'https://example.com','price_other']])await assert.rejects(reserve(redis,args[0],sub,args[1],args[2]),/SUBMISSION_CONFLICT/)
 assert.deepEqual(redis.rows,before)
 const other=await reserve(redis,values,sub+'x','https://example.com','price_test');assert.notEqual(other.assessment_id,a.assessment_id)
})
test('same Session with a changed PaymentIntent cannot add ownership or replace a paid record',async()=>{
 const redis=new LuaRedis(),r=await reserve(redis,values,sub,'https://example.com','price_test'),key=`or:intake:${sub}`
 const payment={livemode:true,event_id:'evt_one',assessment_id:r.assessment_id,checkout_session_id:'cs_live_one',payment_reference:'pi_one',amount:14900,currency:'usd',paid_at:new Date().toISOString(),confirmed_at:new Date().toISOString()}
 assert.equal(await commitPayment(redis,sub,'evt_one',r.assessment_id,redis.rows.get(key),{review:false,identity_review:'CLEAR',payment}),'CONFIRMED')
 // A second reference claiming this same Session must never silently transfer ownership.
 redis.rows.set('or:payment-owner:pi_other',r.assessment_id)
 const before=redis.rows.get(key),outbox=redis.rows.get(`or:handoff:${r.assessment_id}`)
 assert.equal(await commitPayment(redis,sub,'evt_other',r.assessment_id,before,{review:false,identity_review:'CLEAR',payment:{...payment,payment_reference:'pi_other'}}),'REVIEW')
 assert.equal(redis.rows.get(key),before);assert.equal(redis.rows.get(`or:handoff:${r.assessment_id}`),outbox);assert.equal(redis.rows.get('or:payment-owner:pi_one'),r.assessment_id)
})
test('concurrent changed confirmation cannot replace original Session or PaymentIntent',async()=>{
 const redis=new LuaRedis(),r=await reserve(redis,values,sub,'https://example.com','price_test'),key=`or:intake:${sub}`
 const payment={livemode:true,event_id:'evt_first',assessment_id:r.assessment_id,checkout_session_id:'cs_live_original',payment_reference:'pi_original',amount:14900,currency:'usd',paid_at:new Date().toISOString(),confirmed_at:new Date().toISOString()}
 await commitPayment(redis,sub,'evt_first',r.assessment_id,redis.rows.get(key),{review:false,identity_review:'CLEAR',payment})
 redis.rows.set('or:payment-owner:pi_changed',r.assessment_id)
 const raw=redis.rows.get(key),job=redis.rows.get(`or:handoff:${r.assessment_id}`)
 const results=await Promise.all([commitPayment(redis,sub,'evt_second',r.assessment_id,raw,{review:false,payment:{...payment,checkout_session_id:'cs_live_changed'}}),commitPayment(redis,sub,'evt_third',r.assessment_id,raw,{review:false,payment:{...payment,payment_reference:'pi_changed'}})])
 assert.deepEqual(results,['REVIEW','REVIEW']);assert.equal(redis.rows.get(key),raw);assert.equal(redis.rows.get(`or:handoff:${r.assessment_id}`),job)
})
