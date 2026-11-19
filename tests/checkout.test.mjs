import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseIntake, assessmentBase, pending, fingerprint, sessionParams, obtainSession } from '../lib/checkout/core.ts'
import { reserve, reserveScript } from '../lib/checkout/store.ts'
import { POST } from '../app/api/checkout/route.ts'
import { NextRequest } from 'next/server'
const raw = { businessName:'Pup Buzz Mobile Grooming',website:'https://example.com',customerName:'Alex',email:'alex@example.com',category:'Home services',city:'Austin',state:'Texas',services:'Grooming',serviceArea:'Austin metro',terms_accepted:true }
const now=new Date('2026-10-08T12:00:00Z')
const record=()=>pending(parseIntake(raw),assessmentBase(raw.businessName,now),'7ad23ceb-0f56-4ddd-a524-ecac2ad32700',now,'https://example.com','price_test')
test('server required fields and strict terms boolean',()=>{
 for(const key of ['businessName','website','customerName','email','category','city','state','services']) for(const value of ['',null,123])assert.throws(()=>parseIntake({...raw,[key]:value}))
 for(const value of [false,'yes','true',null,undefined]) assert.throws(()=>parseIntake({...raw,terms_accepted:value}))
 assert.equal(parseIntake(raw).acceptance,'yes')
})
test('server rejects malformed emails, URLs, optional field types and oversized input',()=>{
 for(const email of ['a','a@b','a @example.com'])assert.throws(()=>parseIntake({...raw,email}))
 for(const website of ['example.com','javascript:alert(1)','https://user:pass@example.com'])assert.throws(()=>parseIntake({...raw,website}))
 for(const key of ['googleUrl','url0','url1','url2','url3','url4'])assert.throws(()=>parseIntake({...raw,[key]:'bad'}))
 assert.throws(()=>parseIntake({...raw,notes:{}})); assert.throws(()=>parseIntake({...raw,website:'https://example.com/'+ 'a'.repeat(500)}))
 assert.equal(parseIntake({...raw,payment_status:'PAYMENT_CONFIRMED'}).payment_status,undefined)
})
test('Assessment ID Chicago date boundary, normalization, limit and fallback',()=>{
 assert.equal(assessmentBase(raw.businessName,now),'OR-20261008-PUP-BUZZ-MOBILE-GROOMING')
 assert.equal(assessmentBase(' Café & Co. -- Grooming ',new Date('2026-10-08T02:00:00Z')),'OR-20261007-CAFE-CO-GROOMING')
 assert.equal(assessmentBase('🐶',now),'OR-20261008-BUSINESS')
 assert.ok(assessmentBase('a'.repeat(200),now).length<=72)
})
test('atomic reservation adapter reuses submission and suffixes collisions',async()=>{
 const rows=new Map();let count=0
 const redis={eval:async(script,keys,args)=>{
 assert.equal(script,reserveScript);assert.ok(script.indexOf("if old then")<script.indexOf("redis.call('INCR'"))
 if(rows.has(keys[0]))return rows.get(keys[0]);const r=JSON.parse(args[0]);count++;if(count>1)r.assessment_id+=`-${count}`;rows.set(keys[0],JSON.stringify(r));return rows.get(keys[0])
 }}
 const values=parseIntake(raw)
 const [a,b]=await Promise.all([reserve(redis,values,'same','https://example.com','price_test'),reserve(redis,values,'same','https://example.com','price_test')])
 assert.equal(a.assessment_id,b.assessment_id)
 const c=await reserve(redis,values,'different','https://example.com','price_test');assert.equal(c.assessment_id,a.assessment_id+'-2')
 assert.notEqual(fingerprint(values),fingerprint({...values,services:'Other'}))
})
test('checkout uses existing price, email, metadata and no sensitive optional data',()=>{
 const params=sessionParams(record());assert.equal(params.mode,'payment');assert.equal(params.currency,'usd');assert.deepEqual(params.line_items,[{price:'price_test',quantity:1}]);assert.equal(params.customer_email,raw.email)
 assert.deepEqual(Object.keys(params.metadata).sort(),['assessment_id','business_name','website','customer_email','product','ledger_version','methodology_version','report_template_version','intake_submission_id'].sort())
  assert.equal(params.metadata.product,'orangerank_assessment_v1');assert.equal(params.metadata.ledger_version,'ControlLedger-V1.0');assert.equal(params.metadata.methodology_version,'PRODUCTION-v1-LOCKED');assert.equal(params.metadata.report_template_version,'V1.3')
 assert.deepEqual(params.payment_intent_data.metadata,params.metadata)
 assert.equal(params.success_url,'https://example.com/checkout/success');assert.equal(params.cancel_url,'https://example.com/checkout/cancel')
 assert.equal(params.allow_promotion_codes,true);assert.equal(params.line_items[0].unit_amount,undefined);assert.equal(params.discounts,undefined)
})
test('Stripe retry key stays stable even if persistence fails; saved session retrieves instead of recreating',async()=>{
 const calls=[];const stripe={checkout:{sessions:{create:async(p,o)=>{calls.push({p,o});return {id:'cs_test_one'}},retrieve:async id=>({id})}}}
 await assert.rejects(obtainSession(record(),stripe,async()=>{throw new Error('store failure')},now))
 const r=record();await obtainSession(r,stripe,async()=>{},now)
 assert.deepEqual(calls[0],calls[1]);assert.equal(calls[0].o.idempotencyKey,'or-checkout-'+r.intake_submission_id);assert.equal(calls[0].p.allow_promotion_codes,true);assert.equal(calls[0].p.line_items[0].price,'price_test');assert.equal(calls[0].p.line_items[0].unit_amount,undefined)
 await obtainSession(r,stripe,async()=>{},now);assert.equal(calls.length,2)
 assert.equal(r.payment_status,'PENDING');assert.equal(r.current_status,'NEW')
 await assert.rejects(obtainSession(record(),stripe,async()=>{},new Date('2026-10-10T12:00:00Z')))
 assert.equal(calls.length,2)
})
test('production checkout is fail-closed without any Stripe or store calls',async()=>{
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production'
 try {const r=await POST(new NextRequest('https://example.com/api/checkout',{method:'POST'}));assert.equal(r.status,503)}finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old}
})
test('no confirmation or fulfillment from browser return or endpoint',()=>{
 for(const file of ['app/checkout/success/page.tsx','app/checkout/cancel/page.tsx','app/api/checkout/route.ts']) {
 const s=readFileSync(file,'utf8');assert.ok(!s.includes('PAYMENT_CONFIRMED'));assert.ok(!s.includes("current_status = 'APPROVED'"))
 }
 const status=readFileSync('components/intake/payment-status.tsx','utf8');assert.ok(!status.includes('PAYMENT_CONFIRMED'));assert.ok(!status.toLowerCase().includes('pending'));assert.ok(readFileSync('app/checkout/success/page.tsx','utf8').includes('Payment complete'))
})
