import {test} from 'node:test'
import assert from 'node:assert/strict'
import {sandboxValidationFixture,validateSandboxFixture} from '../lib/handoff/sandbox-fixture.ts'
import {receiverPayload,dispatchAssessment} from '../lib/handoff/dispatch.ts'
import {grokPayload,routineIssues} from '../lib/handoff/grok.ts'
test('explicit local fixture validates only locally; cannot become audit/assessment acceptance',()=>{
 const fixture=sandboxValidationFixture()
 assert.ok(Object.isFrozen(fixture));assert.ok(Object.isFrozen(fixture.service_area_correction))
 assert.deepEqual(validateSandboxFixture(fixture),{result:'LOCAL_FIXTURE_VALIDATED',real_assessment_eligible:false,outbound_eligible:false})
 for(const input of [null,{}, {...fixture,assessment_id:'invented'},{...fixture,service_area:'Austin metro'},{...fixture,fixture_kind:'AUDIT_ONLY'},{...fixture,permitted_operations:['dispatch']},{...fixture,service_area_correction:{synthetic_test_value:false,source:'local_unit_fixture'}}])assert.throws(()=>validateSandboxFixture(input))
})
test('fixture rejected by both real outbound builders and all dispatch modes without writes or sends',async()=>{
 const fixture=sandboxValidationFixture()
 assert.throws(()=>receiverPayload(fixture),/SYNTHETIC_QUARANTINE/)
 assert.throws(()=>grokPayload(fixture),/SYNTHETIC_QUARANTINE/)
 assert.ok(routineIssues(fixture).some(i=>i.field==='primary_service_area' && i.status==='invalid'))
 const saved={...process.env}
 try{
  process.env.VERCEL_ENV='preview';process.env.GROK_ROUTINE_WEBHOOK_URL='https://example.com/validation';process.env.GROK_ROUTINE_WEBHOOK_KEY='dummy'
  delete process.env.ORANGERANK_HANDOFF_ENABLED
  for(const config of [null,{endpoint:'https://example.com/real',token:'dummy'}]){
   let writes=0,sends=0
   const redis={get:async()=>JSON.stringify(fixture),eval:async()=>{writes++;throw Error('forbidden')},set:async()=>{writes++;throw Error('forbidden')}}
   assert.equal(await dispatchAssessment(redis,'9b988777-b758-4893-a464-e357c56198d0',config,async()=>{sends++;throw Error('forbidden')}),'REVIEW')
   assert.equal(writes,0);assert.equal(sends,0)
  }
 }finally{for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved)}
})
