import {test,mock} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {GET} from '../app/api/internal/handoff-configuration/route.ts'
test('configuration-only GET returns one sanitized category with no network or Redis access',async()=>{
 const saved={...process.env};let calls=0
 try{Object.assign(process.env,{VERCEL_ENV:'preview',ORANGERANK_AUDIT_SECRET:'a'.repeat(32),ORANGERANK_HANDOFF_ENABLED:'true',ORANGERANK_HANDOFF_URL:'https://example.com/?sensitive=x',ORANGERANK_HANDOFF_TOKEN:'sensitive-token'})
 mock.method(globalThis,'fetch',async()=>{calls++;throw Error('no network')})
 const source=readFileSync('app/api/internal/handoff-configuration/route.ts','utf8');assert.ok(!/store\(|Redis|dispatchAssessment|drainOutbox/.test(source))
 const request=()=>new Request('https://example.com/api/internal/handoff-configuration',{headers:{authorization:'Bearer '+'a'.repeat(32)}})
 const response=await GET(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{category:'URL_COMPONENTS_REJECTED'});assert.equal(calls,0)
 process.env.ORANGERANK_HANDOFF_URL='https://example.com/receiver';assert.deepEqual(await (await GET(request())).json(),{category:'VALID'});assert.equal(calls,0)
 process.env.VERCEL_ENV='production';assert.equal((await GET(request())).status,404);process.env.VERCEL_ENV='development';assert.equal((await GET(request())).status,404)
 process.env.VERCEL_ENV='preview';assert.equal((await GET(new Request(request().url))).status,401);assert.equal(calls,0)
 }finally{mock.restoreAll();for(const k of Object.keys(process.env))if(!(k in saved))delete process.env[k];Object.assign(process.env,saved)}
})
