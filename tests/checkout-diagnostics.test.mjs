import test from 'node:test'
import assert from 'node:assert/strict'
import { mock } from 'node:test'
import { createRequire } from 'node:module'
const Stripe = createRequire(import.meta.url)('stripe')
import { NextRequest } from 'next/server'
import { POST } from '../app/api/checkout/route.ts'
import { checkoutDiagnostics, stages } from '../lib/checkout/diagnostics.ts'

const origin = 'https://preview.example.com'
const intake = { businessName:'PRIVATE BUSINESS', customerName:'PRIVATE NAME', email:'private@example.com', website:'https://private.example.com', category:'Home services',city:'Austin',state:'Texas',services:'PRIVATE SERVICES',serviceArea:'Austin metro',terms_accepted:true }
const submission = '7ad23ceb-0f56-4ddd-a524-ecac2ad32700'
const secret = 'sk_test_PRIVATE_SECRET'
const token = 'PRIVATE_REDIS_TOKEN'
async function environment(run) {
 const saved = {...process.env}; const events=[]; const original=console.info
 Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_STRIPE_MODE:'test',ORANGERANK_CHECKOUT_RELEASE_APPROVED:'true',ORANGERANK_CHECKOUT_ENABLED:'true',ORANGERANK_CHECKOUT_ORIGIN:origin,STRIPE_SECRET_KEY:secret,STRIPE_ORANGERANK_PRICE_ID:'price_test',UPSTASH_REDIS_REST_URL:'https://redis.example.com',UPSTASH_REDIS_REST_TOKEN:token})
 console.info = text=>events.push(JSON.parse(text))
 try { await run(events) } finally { console.info=original; mock.restoreAll(); for(const key of Object.keys(process.env)) if(!(key in saved))delete process.env[key];Object.assign(process.env,saved) }
}
function request(body={intake_submission_id:submission,intake}, headers={}) {
 return new NextRequest(`${origin}/api/checkout`,{method:'POST',headers:{origin,'content-type':'application/json',...headers},body:JSON.stringify(body)})
}
function failure(events,stage) {
 const failures=events.filter(event=>event.event==='orangerank_checkout_failure')
 assert.equal(failures.length,1);assert.equal(failures[0].stage,stage)
 const serialized=JSON.stringify(events)
 for(const value of [secret,token,...Object.values(intake).filter(v=>typeof v==='string'),submission,'https://redis.example.com']) assert.ok(!serialized.includes(value),value)
 for(const event of events) {
  const allowed=event.event==='orangerank_origin_check'?['event','configured','header_matches','url_matches','timestamp']:['event','stage','error_type','error_code','timestamp']
  assert.ok(Object.keys(event).every(key=>allowed.includes(key)))
  if(event.event==='orangerank_origin_check')for(const key of ['configured','header_matches','url_matches'])assert.equal(typeof event[key],'boolean')
 }
}
test('diagnostics allowlist rejects secret/PII-bearing type, code and messages at every stage',async()=>environment(async events=>{
 const diagnostic=checkoutDiagnostics()
 for(const stage of stages) {
 diagnostic.start(stage);diagnostic.success();diagnostic.failure({name:secret,type:intake.email,code:token,message:JSON.stringify(intake),requestId:secret})
 assert.equal(events.at(-1).stage,stage);assert.equal(events.at(-1).error_type,'UnknownError');assert.equal(events.at(-1).error_code,undefined)
 }
 diagnostic.failure({type:'StripeInvalidRequestError',code:'resource_missing',message:secret})
 assert.equal(events.at(-1).error_code,'resource_missing')
 assert.ok(!JSON.stringify(events).includes(secret));assert.ok(!JSON.stringify(events).includes(token));assert.ok(!JSON.stringify(events).includes(intake.email))
}))
test('production sandbox mode is allowed and unapproved live mode stays blocked without logs',async()=>environment(async events=>{
 process.env.VERCEL_ENV='production'
 const {stripeConfiguration}=await import('../lib/checkout/config.ts')
 assert.equal(stripeConfiguration().live,false)
 process.env.ORANGERANK_STRIPE_MODE='live';process.env.STRIPE_SECRET_KEY='sk_live_dummy';delete process.env.ORANGERANK_LIVE_APPROVED
 assert.throws(()=>stripeConfiguration())
 const response=await POST(request());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'Checkout is not available yet.'});assert.deepEqual(events,[])
 process.env.VERCEL_ENV='development';const d=checkoutDiagnostics();d.success();d.failure(new Error(secret));assert.deepEqual(events,[])
}))
test('validation and initialization failures preserve responses and identify stages',async()=>environment(async events=>{
 const cases=[
 ['CHECKOUT_ENABLED_GUARD',()=>{process.env.ORANGERANK_CHECKOUT_ENABLED='false';return request()},503],
 ['CHECKOUT_ENABLED_GUARD',()=>{process.env.ORANGERANK_CHECKOUT_ENABLED='true';process.env.STRIPE_SECRET_KEY='sk_live_not_allowed';return request()},503],
 ['ORIGIN_VERIFICATION',()=>{process.env.STRIPE_SECRET_KEY=secret;return request(undefined,{origin:'https://wrong.example.com'})},403],
 ['REQUEST_VALIDATION',()=>request({}),400],
 ['INTAKE_VALIDATION',()=>request({intake_submission_id:submission,intake:{...intake,terms_accepted:false}}),400],
 ['REDIS_INITIALIZATION',()=>{delete process.env.UPSTASH_REDIS_REST_TOKEN;return request()},503],
 ]
 for(const [stage,make,status]of cases){events.length=0;const response=await POST(make());assert.equal(response.status,status);failure(events,stage)}
 assert.equal(events.at(-1).error_type,'Error')
}))
test('mocked provider failures identify rate limit, price, reservation, session and pending write without leaking data',async()=>environment(async events=>{
 const sessionPrototype = Object.getPrototypeOf(new Stripe(secret).checkout.sessions)
 let failing='';let operations=[]
 mock.method(Stripe.resources.Prices.prototype,'retrieve',async()=>{
 operations.push('price')
 if(failing==='STRIPE_PRICE_RETRIEVAL')throw Object.assign(new Error(secret),{type:'StripeInvalidRequestError',code:'resource_missing'})
 return {livemode:false,active:true,currency:'usd',unit_amount:14900,type:'one_time'}
 })
 mock.method(sessionPrototype,'create',async()=>{
 operations.push('session')
 if(failing==='STRIPE_CHECKOUT_SESSION_CREATE')throw Object.assign(new Error(intake.email),{type:'StripeAuthenticationError'})
 return {id:'cs_test_safe',livemode:false,status:'open',url:'https://checkout.stripe.com/test'}
 })
 mock.method(globalThis,'fetch',async(_url, options)=>{
 const commands=JSON.parse(options.body);const pipeline=Array.isArray(commands[0]);const list=pipeline?commands:[commands]
 const results=list.map(command=>{
 const op=String(command[0]).toLowerCase();operations.push(op)
 if((failing==='REDIS_RATE_LIMIT'&&op==='incr')||(failing==='REDIS_ASSESSMENT_RESERVATION'&&op==='eval')||(failing==='PENDING_ASSESSMENT_WRITE'&&op==='eval'&&String(command[1]).includes("return 'SAVED'")))return {error:'ERR provider failed'}
 if(op==='get')return {result:null}
 if(op==='eval')return {result:String(command[1]).includes("return 'SAVED'") ? 'SAVED' : command.at(-1)}
 return {result:1}
 })
 return new Response(JSON.stringify(pipeline?results:results[0]),{status:200,headers:{'content-type':'application/json'}})
 })
 for(const stage of ['REDIS_RATE_LIMIT','STRIPE_PRICE_RETRIEVAL','REDIS_ASSESSMENT_RESERVATION','STRIPE_CHECKOUT_SESSION_CREATE','PENDING_ASSESSMENT_WRITE']){
 failing=stage;events.length=0;operations=[]
 const response=await POST(request());assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'We could not start checkout. Please retry. No payment has been confirmed.'});failure(events,stage)
 }
 failing='';events.length=0;operations=[]
 const response=await POST(request());assert.equal(response.status,200)
 assert.deepEqual(operations,['incr','expire','price','get','eval','session','eval'])
 assert.equal(events.at(-1).stage,'CHECKOUT_RESPONSE');assert.equal(events.at(-1).event,'orangerank_checkout_stage')
 assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(response.headers.get('set-cookie').includes('HttpOnly'))
}))
