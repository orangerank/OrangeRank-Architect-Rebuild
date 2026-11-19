// Preloaded in every test worker. Mocks may replace guards, never delegate to real transport.
import { afterEach } from 'node:test'
import { syncBuiltinESMExports } from 'node:module'
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import tls from 'node:tls'
import dgram from 'node:dgram'
import dns from 'node:dns'
let blocked=0
function deny(){blocked++;throw new Error('OFFLINE_NETWORK_BLOCKED: install an explicit transport mock; no destination or credentials logged')}
globalThis.fetch=deny
for(const module of [http,https]){module.request=deny;module.get=deny}
net.connect=deny;net.createConnection=deny;net.Socket.prototype.connect=deny
tls.connect=deny;dgram.createSocket=deny
dns.lookup=deny;dns.resolve=deny
for(const name of Object.keys(dns.promises))if(typeof dns.promises[name]==='function')dns.promises[name]=deny
syncBuiltinESMExports()
afterEach(()=>{const count=blocked;blocked=0;if(count)throw new Error(`OFFLINE_NETWORK_BLOCKED: ${count} unmocked transport attempt(s), including any caught by application code`)})
