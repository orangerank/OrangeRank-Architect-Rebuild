import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {offlineValidationPayload} from '../lib/handoff/offline-validation.ts'
import {grokPayload,sendGrokValidation} from '../lib/handoff/grok.ts'
import {receiverPayload} from '../lib/handoff/dispatch.ts'
import {pending,parseIntake} from '../lib/checkout/core.ts'
function record(){const r=pending(parseIntake({businessName:'Test',website:'https://example.com',customerName:'Test',email:'test@example.com',category:'Home services',city:'Austin',state:'Texas',services:'Test',serviceArea:'Test region',terms_accepted:true}),'OR-20261009-TEST','7ad23ceb-0f56-4ddd-a524-ecac2ad32700',new Date(),'https://example.com','price_test');r.payment_status='PAYMENT_CONFIRMED';r.payment_ownership_verified=true;r.identity_review='CLEAR';r.current_status='PAYMENT_CONFIRMED';r.verified_payment={assessment_id:r.assessment_id,event_id:'evt_test',checkout_session_id:'cs_test_one',payment_reference:'pi_test',amount:14900,currency:'usd',paid_at:new Date().toISOString(),confirmed_at:new Date().toISOString()};return r}
test('offline test envelope exercises real payload schema and cannot enter any live sender',async()=>{
 const payload=offlineValidationPayload();assert.equal(payload.mode,'validation_only');assert.equal(payload.test_mode,'offline_only');assert.match(payload.test_id,/^offline-/);assert.notEqual(payload.test_id,offlineValidationPayload().test_id)
 for(const key of ['assessment_id','customer_name','customer_email','business_name','website','business_category','primary_city','primary_state','primary_service_area','terms_accepted_at','methodology_version','report_template_version','idempotency_key'])assert.equal(typeof payload[key],'string')
 assert.ok(Array.isArray(payload.main_services));assert.equal(payload.terms_accepted,true);assert.equal(payload.payment.amount,14900);assert.equal(payload.payment.currency,'usd')
 let calls=0;mock.method(globalThis,'fetch',async()=>{calls++;throw Error('forbidden')})
 try{assert.throws(()=>receiverPayload(payload),/SYNTHETIC_QUARANTINE/);assert.throws(()=>grokPayload(payload),/SYNTHETIC_QUARANTINE/);await assert.rejects(sendGrokValidation(payload,{endpoint:'https://example.com',key:'dummy'}),/SYNTHETIC_QUARANTINE/);assert.equal(calls,0)}finally{mock.restoreAll()}
})
test('mock-only request contract handles statuses timeout and network failure without claiming execution',async()=>{
 const r=record(),before=JSON.stringify(r),config={endpoint:'https://example.com/mock',key:'dummy-not-a-secret'}
 for(const [status,result] of [[200,'VALIDATION_ACCEPTED'],[201,'RETRY_PENDING'],[401,'AUTH_REJECTED'],[403,'AUTH_REJECTED'],[500,'RETRY_PENDING']])assert.equal(await sendGrokValidation(r,config,async(_url,o)=>{assert.equal(o.method,'POST');assert.equal(o.headers['Content-Type'],'application/json');assert.equal(o.headers.Authorization,'Bearer '+config.key);assert.equal(JSON.parse(o.body).mode,'validation_only');assert.ok(o.signal instanceof AbortSignal);return new Response('',{status})}),result)
 // Trigger actual abort propagation offline, rather than waiting 15 seconds.
 mock.method(AbortSignal,'timeout',()=>AbortSignal.abort(new DOMException('offline timeout','TimeoutError')))
 try{await assert.rejects(sendGrokValidation(r,config,async(_url,o)=>{o.signal.throwIfAborted()}),{name:'TimeoutError'})}finally{mock.restoreAll()}
 await assert.rejects(sendGrokValidation(r,config,async()=>{throw Error('offline transport failure')}),/offline transport failure/)
 assert.equal(JSON.stringify(r),before);assert.equal(r.current_status,'PAYMENT_CONFIRMED');assert.equal(r.payment_status,'PAYMENT_CONFIRMED')
})
