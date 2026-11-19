import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {handoffHttpStatus,handoffFailure} from '../lib/handoff/diagnostics.ts'
import {dispatchAssessment} from '../lib/handoff/dispatch.ts'
import {pending,parseIntake} from '../lib/checkout/core.ts'
import {LuaRedis} from './helpers/lua-redis.mjs'
import {POST} from '../app/api/internal/assessment-handoff/route.ts'
test('handoff HTTP semantics distinguish accepted rejected held and retryable outcomes',()=>{
 for(const result of ['TRANSPORT_ACCEPTED','VALIDATION_ACCEPTED','PENDING_INTEGRATION'])assert.equal(handoffHttpStatus(result),200)
 assert.equal(handoffHttpStatus('RETRY'),503);assert.equal(handoffHttpStatus('OUTCOME_UNKNOWN'),409);assert.equal(handoffHttpStatus('REVIEW'),409);assert.equal(handoffHttpStatus('INVALID_REFERENCE'),400);assert.equal(handoffHttpStatus('MISSING'),404)
})
test('pre-send initialization and parse failures report fixed stage/type without leaking errors',async()=>{
 const saved={...process.env};const logs=[]
 try{Object.assign(process.env,{VERCEL_ENV:'preview',STRIPE_SECRET_KEY:'sk_test_dummy',ORANGERANK_DISPATCH_SECRET:'d'.repeat(32),ORANGERANK_HANDOFF_ENABLED:'true',ORANGERANK_HANDOFF_URL:'https://example.com',ORANGERANK_HANDOFF_TOKEN:'dummy'});delete process.env.UPSTASH_REDIS_REST_URL;mock.method(console,'info',s=>logs.push(JSON.parse(s)))
 const request=body=>new Request('https://example.com/api/internal/assessment-handoff',{method:'POST',headers:{authorization:'Bearer '+'d'.repeat(32)},body})
 assert.equal((await POST(request('{bad'))).status,400)
 assert.equal((await POST(request(JSON.stringify({intake_submission_id:'014bf6ac-20c7-4478-a6e5-e89975534434'})))).status,503)
 assert.ok(logs.some(l=>l.stage==='REQUEST_PARSE'));assert.ok(logs.some(l=>l.stage==='REDIS_INITIALIZATION'))
 handoffFailure('OUTBOX_CLAIM',Object.assign(new Error('private secret customer'),{code:'secret',name:'private@example.com'}));assert.ok(!JSON.stringify(logs).includes('private'));assert.ok(!JSON.stringify(logs).includes('secret'))
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
test('production handoff review logs the reason without intake values',async()=>{
 const saved={...process.env};const logs=[]
 try{Object.assign(process.env,{VERCEL_ENV:'production',ORANGERANK_HANDOFF_ENABLED:'true',ORANGERANK_HANDOFF_URL:'https://example.com/receiver',ORANGERANK_HANDOFF_TOKEN:'dummy'});mock.method(console,'info',line=>logs.push(JSON.parse(line)))
  const submission='9b988777-b758-4893-a464-e357c56198d0',id='OR-20261009-TEST'
  const redis=new LuaRedis()
  const record=pending(parseIntake({businessName:'Private business',customerName:'Private person',email:'private@example.com',website:'https://private.example.com',category:'Home services',city:'Austin',state:'Texas',services:'Service',serviceArea:'SYNTHETIC TEST: secret place',terms_accepted:true}),id,submission,new Date(),'https://example.com','price_test')
  record.payment_ownership_verified=true;record.identity_review='CLEAR';record.current_status='PAYMENT_CONFIRMED';record.payment_status='PAYMENT_CONFIRMED'
  record.verified_payment={livemode:true,event_id:'evt_one',assessment_id:id,checkout_session_id:'cs_live_one',payment_reference:'pi_one',amount:14900,list_amount:14900,discount_amount:0,promotion_code:null,currency:'usd',paid_at:new Date().toISOString(),confirmed_at:new Date().toISOString()}
  redis.rows.set(`or:intake:${submission}`,JSON.stringify(record))
  assert.equal(await dispatchAssessment(redis,submission,{endpoint:'https://example.com/receiver',token:'dummy'}), 'REVIEW')
  assert.deepEqual(logs.find(line=>line.event==='orangerank_handoff_review'),{event:'orangerank_handoff_review',result:'REVIEW',reason:'SYNTHETIC_QUARANTINE'})
  assert.equal(JSON.stringify(logs).includes('private@example.com'),false)
  assert.equal(JSON.stringify(logs).includes('secret place'),false)
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
