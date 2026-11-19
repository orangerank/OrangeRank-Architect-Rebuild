import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {receiverConfigurationCategory,receiverConfiguration} from '../lib/handoff/dispatch.ts'
const valid={ORANGERANK_HANDOFF_ENABLED:'true',ORANGERANK_HANDOFF_URL:'https://example.com/receiver',ORANGERANK_HANDOFF_TOKEN:'dummy'}
test('handoff configuration diagnostics classify every rejection and valid configuration',()=>{
 const cases=[['DISABLED',{ORANGERANK_HANDOFF_ENABLED:'TRUE'}],['URL_EMPTY',{ORANGERANK_HANDOFF_URL:''}],['URL_EMPTY',{ORANGERANK_HANDOFF_URL:'   '}],['URL_PARSE_FAILURE',{ORANGERANK_HANDOFF_URL:'not a URL'}],['NON_HTTPS',{ORANGERANK_HANDOFF_URL:'http://example.com'}],['URL_COMPONENTS_REJECTED',{ORANGERANK_HANDOFF_URL:'https://user:pass@example.com'}],['URL_COMPONENTS_REJECTED',{ORANGERANK_HANDOFF_URL:'https://example.com/?secret=x'}],['URL_COMPONENTS_REJECTED',{ORANGERANK_HANDOFF_URL:'https://example.com/#x'}],['LOCAL_ADDRESS_BLOCKED',{ORANGERANK_HANDOFF_URL:'https://localhost'}],['LOCAL_ADDRESS_BLOCKED',{ORANGERANK_HANDOFF_URL:'https://127.0.0.1'}],['TOKEN_EMPTY',{ORANGERANK_HANDOFF_TOKEN:''}],['TOKEN_EMPTY',{ORANGERANK_HANDOFF_TOKEN:'  '}],['VALID',{}]]
 for(const [category,change] of cases)assert.equal(receiverConfigurationCategory({...valid,...change}),category)
})
test('configuration logging contains only the category in preview and production',()=>{
 const saved={...process.env},logs=[]
 try{Object.assign(process.env,{...valid,VERCEL_ENV:'preview',ORANGERANK_HANDOFF_URL:'https://example.com/?private=secret',ORANGERANK_HANDOFF_TOKEN:'private-token'});mock.method(console,'info',s=>logs.push(JSON.parse(s)));assert.equal(receiverConfiguration(),null);assert.deepEqual(logs,[{event:'orangerank_handoff_configuration',category:'URL_COMPONENTS_REJECTED'}]);process.env.VERCEL_ENV='production';receiverConfiguration();assert.equal(logs.length,2);assert.deepEqual(logs[1],logs[0]);assert.equal(JSON.stringify(logs).includes('private'),false);assert.equal(JSON.stringify(logs).includes('secret'),false)}finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
