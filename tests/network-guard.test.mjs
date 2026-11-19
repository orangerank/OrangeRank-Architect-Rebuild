import {test} from 'node:test'
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
// Child probes use the guard, never call an original network function.
test('network guard blocks fetch HTTP HTTPS sockets TLS and DNS even when application catches errors',()=>{
 for(const expression of ["fetch('https://example.com')","http.request('http://example.com')","https.get('https://example.com')","net.connect(443,'example.com')","tls.connect(443,'example.com')","dns.lookup('example.com')"]){
 const source=`import {test} from 'node:test';import http from 'node:http';import https from 'node:https';import net from 'node:net';import tls from 'node:tls';import dns from 'node:dns';test('probe',()=>{try{${expression}}catch{}})`
 const child=spawnSync(process.execPath,['--import','./tests/helpers/network-guard.mjs','--input-type=module','-e',source],{encoding:'utf8'})
 assert.notEqual(child.status,0);assert.match(child.stdout+child.stderr,/OFFLINE_NETWORK_BLOCKED/)
 }
})
test('network guard permits explicitly installed in-memory transport mocks',()=>{
 const source="import {test,mock} from 'node:test';import assert from 'node:assert/strict';test('mock',async()=>{mock.method(globalThis,'fetch',async()=>new Response('offline'));assert.equal(await (await fetch('https://example.com')).text(),'offline');mock.restoreAll()})"
 const child=spawnSync(process.execPath,['--import','./tests/helpers/network-guard.mjs','--input-type=module','-e',source],{encoding:'utf8'})
 assert.equal(child.status,0,child.stdout+child.stderr)
})
