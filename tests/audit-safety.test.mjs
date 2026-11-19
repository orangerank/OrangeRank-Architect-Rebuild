import {test} from 'node:test'
import assert from 'node:assert/strict'
import {auditDiagnostic,logAudit,syntheticRecord} from '../lib/handoff/safety.ts'
import {receiverPayload,dispatchAssessment} from '../lib/handoff/dispatch.ts'
import {grokPayload,routineIssues} from '../lib/handoff/grok.ts'
test('zero and validation issues log fixed diagnostics only, stripping extras',()=>{
 assert.deepEqual(auditDiagnostic({result:'AUDIT_ONLY',issues:[]}),{event:'orangerank_audit',result:'AUDIT_ONLY',issue_count:0,issues:[]})
 const r=auditDiagnostic({result:'AUDIT_ONLY',secret:'not printable',issues:[{field:'primary_service_area',status:'invalid',value:'private'}]})
 assert.equal(r.issue_count,1);assert.ok(!JSON.stringify(r).includes('private'));assert.ok(!JSON.stringify(r).includes('printable'))
})
test('malformed responses fail closed and failures never log exceptions/data',()=>{
 for(const value of [null,'invalid JSON',{}, {result:'AUDIT_ONLY',issues:[{field:'private@example.com',status:'missing'}]}, {result:'AUDIT_ONLY',issues:[{field:'website',status:'secret'}]}])assert.throws(()=>auditDiagnostic(value))
 const old=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview'
 try{const logs=[];logAudit(new Error('secret'),line=>logs.push(line));assert.deepEqual(JSON.parse(logs[0]),{event:'orangerank_audit',result:'AUDIT_UNVERIFIED',issue_count:null,issues:[]});logAudit({},()=>{throw new Error('secret')});process.env.VERCEL_ENV='production';logAudit({result:'AUDIT_ONLY',issues:[]},line=>logs.push(line));assert.equal(logs.length,1)}finally{if(old===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=old}
})
test('synthetic provenance and either service-area copy block all outbound geography',async()=>{
 for(const r of [{service_area_correction:{synthetic_test_value:true}},{service_area_correction:{synthetic_test_value:false}},{service_area:'SYNTHETIC TEST: dummy'},{intake_payload:{serviceArea:' synthetic test: dummy'}}]){
 assert.equal(syntheticRecord(r),true);assert.throws(()=>receiverPayload(r),/SYNTHETIC_QUARANTINE/);assert.throws(()=>grokPayload(r),/SYNTHETIC_QUARANTINE/)
 assert.ok(routineIssues(r).some(i=>i.field==='primary_service_area'))
 let calls=0;const redis={get:async()=>JSON.stringify(r),eval:async()=>{calls++;throw Error('write')}}
 assert.equal(await dispatchAssessment(redis,'9b988777-b758-4893-a464-e357c56198d0',{endpoint:'https://example.com',token:'dummy'},async()=>{calls++;throw Error('send')}),'REVIEW');assert.equal(calls,0)
 }
 assert.equal(syntheticRecord({service_area:'Austin metro'}),false)
})
