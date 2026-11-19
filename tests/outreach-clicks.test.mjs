import test, { mock } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { POST } from '../app/api/outreach-click/route.ts'
import { GET } from '../app/api/internal/outreach-clicks/route.ts'
import { CLICK_READ_LIMIT, CLICK_TTL_SECONDS, beaconBody, clickSpan, outreachCode, outreachPath, parseClick, shouldSendClick } from '../lib/outreach/code.ts'
import { CLICK_CODE_DAY_CAP, CLICK_DAY_CAP, CLICK_IP_LIMIT, CLICK_IP_WINDOW_SECONDS, clientAddressKey } from '../lib/outreach/clicks.ts'
import { LuaRedis } from './helpers/lua-redis.mjs'

const clicksSecret = 'c'.repeat(32)
const redisEnv = {
  UPSTASH_REDIS_REST_URL: 'https://redis.example.com',
  UPSTASH_REDIS_REST_TOKEN: 'dummy-redis-token',
  ORANGERANK_OUTREACH_CLICKS_SECRET: clicksSecret,
  ORANGERANK_AUDIT_SECRET: 'a'.repeat(32),
  ORANGERANK_DISPATCH_SECRET: 'd'.repeat(32),
  ORANGERANK_REVIEW_REPLAY_SECRET: 'r'.repeat(32),
  ORANGERANK_SANDBOX_CORRECTION_SECRET: 's'.repeat(32),
  ORANGERANK_CHECKOUT_ORIGIN: 'https://www.getorangerank.com',
}

function restore(saved) {
  mock.restoreAll()
  for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]
  Object.assign(process.env, saved)
}

function authorizationOf(headers) {
  if (!headers) return ''
  if (typeof headers.get === 'function') return headers.get('authorization') ?? ''
  return headers.authorization ?? headers.Authorization ?? ''
}

function memory() {
  const redis = new LuaRedis()
  const commands = []
  let calls = 0
  mock.method(globalThis, 'fetch', async (url, options) => {
    calls++
    const parsed = new URL(url)
    assert.equal(parsed.hostname, 'redis.example.com')
    assert.equal(options.method, 'POST')
    assert.equal(authorizationOf(options.headers), 'Bearer dummy-redis-token')
    const body = JSON.parse(options.body)
    const pipeline = Array.isArray(body[0])
    assert.equal(parsed.pathname, pipeline ? '/pipeline' : '/')
    const results = []
    for (const command of pipeline ? body : [body]) {
      commands.push(command)
      const op = String(command[0])
      if (op === 'eval') {
        const count = Number(command[2])
        const keys = command.slice(3, 3 + count).map(String)
        const args = command.slice(3 + count).map(String)
        results.push({ result: await redis.eval(String(command[1]), keys, args) })
      } else if (op === 'lrange') {
        const list = redis.lists.get(command[1]) ?? []
        const start = Number(command[2])
        const stop = Number(command[3])
        results.push({ result: list.slice(start, stop + 1).map(item => Buffer.from(item).toString('base64')) })
      } else throw new Error(`unexpected command ${op}`)
    }
    return new Response(JSON.stringify(pipeline ? results : results[0]), { status: 200 })
  })
  return { redis, lists: redis.lists, commands, calls: () => calls }
}

function clickRequest(body, headers = {}) {
  return new Request('https://www.getorangerank.com/api/outreach-click', {
    method: 'POST',
    headers: { origin: 'https://www.getorangerank.com', 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function readRequest(query, authorization = `Bearer ${clicksSecret}`) {
  return new Request(`https://www.getorangerank.com/api/internal/outreach-clicks${query}`, {
    headers: authorization ? { authorization } : {},
  })
}

test('codes stay short and the beacon sends one click per session', () => {
  assert.equal(outreachCode('b18-0001'), 'b18-0001')
  assert.equal(outreachCode(' B18-0001 '), 'b18-0001')
  assert.equal(outreachCode('b18-0001-f2'), 'b18-0001-f2')
  assert.equal(outreachCode('fu2-0001'), 'fu2-0001')
  assert.equal(outreachCode('b18-0001-followup'), 'b18-0001-followup')
  for (const bad of ['', 'b-0001', 'b18-00001', 'person@example.com', 'Chris Demko', 'b18-0001-followups', 'https://getorangerank.com', 'b'.repeat(30), null, 18]) {
    assert.equal(outreachCode(bad), null, String(bad))
  }
  assert.equal(outreachPath('/'), '/')
  assert.equal(outreachPath('/Get-Your-Orange-Score/'), '/get-your-orange-score')
  assert.equal(outreachPath('/checkout/success'), '/checkout/success')
  assert.equal(outreachPath('/files/guide.pdf'), '/files/guide.pdf')
  assert.equal(outreachPath('/a.b/c.d'), '/a.b/c.d')
  assert.equal(outreachPath('/foo/../bar'), null)
  assert.equal(outreachPath('/./secret'), null)
  assert.equal(outreachPath('https://getorangerank.com/'), null)
  assert.equal(outreachPath('/foo?x=1'), null)
  assert.equal(outreachPath('//'), null)
  assert.deepEqual(beaconBody('?utm_source=outreach&utm_medium=email&utm_campaign=fall&utm_content=b18-0001', '/'), { code: 'b18-0001', path: '/' })
  assert.equal(beaconBody('?utm_source=outreach', '/'), null)
  assert.equal(beaconBody('?utm_content=person@example.com', '/'), null)
  const seen = new Map()
  const inflight = new Set()
  assert.equal(shouldSendClick('b18-0001', key => seen.get(key) ?? null, key => seen.set(key, '1'), inflight), true)
  assert.equal(seen.get('or:click:b18-0001'), '1')
  assert.equal(shouldSendClick('b18-0001', key => seen.get(key) ?? null, key => seen.set(key, '1'), inflight), false)
  assert.equal(shouldSendClick('c3-0042', () => '1', () => { throw new Error('marked') }, new Set()), false)
  let marks = 0
  const flaky = new Set()
  assert.equal(shouldSendClick('c3-0042', () => { throw new Error('storage') }, () => { marks++; throw new Error('storage') }, flaky), true)
  assert.equal(shouldSendClick('c3-0042', () => { throw new Error('storage') }, () => { marks++ }, flaky), false)
  assert.equal(marks, 1)
  assert.deepEqual(clickSpan('2026-10-24', '2026-10-24'), ['2026-10-24'])
  assert.equal(clickSpan('2026-01-01', '2026-03-31')?.length, 90)
  assert.equal(clickSpan('2026-01-01', '2026-04-01'), null)
  assert.equal(clickSpan('2026-02-31', '2026-02-31'), null)
  assert.equal(clickSpan('2024-02-29', '2024-02-29')?.[0], '2024-02-29')
  assert.equal(clickSpan('2026-02-29', '2026-02-29'), null)
  assert.equal(clickSpan('2026-10-24', '2026-10-01'), null)
  assert.equal(parseClick(JSON.stringify({ code: 'b18-0001', path: '/', at: '2026-10-24T00:00:00.000Z', note: 'person@example.com' }), '2026-10-24'), null)
  assert.equal(parseClick({ code: 'b18-0001', path: '/', at: '2026-10-25T00:00:00.000Z' }, '2026-10-24'), null)
})

test('a same-origin click stores only the code, page, and time', async () => {
  const saved = { ...process.env }
  try {
    Object.assign(process.env, redisEnv)
    const state = memory()
    const logs = []
    mock.method(console, 'info', line => logs.push(String(line)))
    const headers = {
      'user-agent': 'Mozilla/5.0 (person@example.com)',
      'x-forwarded-for': '203.0.113.9',
      referer: 'https://www.getorangerank.com/?email=person@example.com',
      cookie: 'or_checkout=secret-cookie',
    }
    const before = Date.now()
    const first = await POST(clickRequest({ code: 'b18-0001', path: '/' }, headers))
    const second = await POST(clickRequest({ code: '  B18-0002-F2 ', path: '/Get-Your-Orange-Score/' }, headers))
    const after = Date.now()
    assert.equal(first.status, 204)
    assert.equal(first.headers.get('cache-control'), 'no-store')
    assert.equal(await first.text(), '')
    assert.equal(second.status, 204)
    assert.equal(logs.length, 0)
    const writes = state.commands.filter(command => command[0] === 'eval')
    assert.equal(writes.length, 2)
    assert.equal(writes[0][3], writes[1][3])
    assert.equal(state.redis.ttls.get(writes[0][3]), CLICK_TTL_SECONDS)
    assert.equal(String(writes[0][5]).startsWith('or:clicks:rl:'), true)
    assert.equal(String(writes[0][5]).includes('203.0.113.9'), false)
    assert.equal(state.redis.ttls.get(writes[0][5]), CLICK_IP_WINDOW_SECONDS)
    const day = writes[0][3].slice('or:clicks:'.length)
    const read = await GET(readRequest(`?date=${day}`))
    assert.equal(read.status, 200)
    assert.equal(read.headers.get('cache-control'), 'no-store')
    const body = await read.json()
    assert.equal(body.from, day)
    assert.equal(body.to, day)
    assert.equal(body.truncated, false)
    assert.deepEqual(Object.keys(body.clicks[0]).sort(), ['at', 'code', 'path'])
    assert.equal(body.clicks[0].code, 'b18-0001')
    assert.equal(body.clicks[0].path, '/')
    assert.equal(body.clicks[1].code, 'b18-0002-f2')
    assert.equal(body.clicks[1].path, '/get-your-orange-score')
    for (const click of body.clicks) {
      const at = Date.parse(click.at)
      assert.ok(at >= before && at <= after)
    }
    const stored = JSON.stringify([...state.lists.entries(), ...state.redis.rows.entries(), ...state.redis.ttls.entries(), ...state.commands, body])
    for (const secret of ['person@example.com', '203.0.113.9', 'Mozilla', 'or_checkout', 'dummy-redis-token', clicksSecret]) {
      assert.equal(stored.includes(secret), false, secret)
    }
  } finally { restore(saved) }
})

test('invalid, absent, and cross-site clicks do not touch Redis', async () => {
  const saved = { ...process.env }
  try {
    Object.assign(process.env, redisEnv)
    const state = memory()
    const attempts = [
      clickRequest({ code: '', path: '/' }),
      clickRequest({ code: 'person@example.com', path: '/' }),
      clickRequest({ code: 'Chris Demko', path: '/' }),
      clickRequest({ code: 'b-0001', path: '/' }),
      clickRequest({ code: 'b18-0001', path: 'https://evil.example/phish' }),
      clickRequest({ code: 'b18-0001', path: '/', email: 'person@example.com' }),
      clickRequest({ path: '/' }),
      clickRequest({ code: 18, path: '/' }),
      clickRequest('{' + 'x'.repeat(600)),
      clickRequest({ code: 'b18-0001', path: '/' }, { 'content-type': 'text/plain' }),
      clickRequest({ code: 'b18-0001', path: '/' }, { origin: 'https://evil.example' }),
      new Request('https://www.getorangerank.com/api/outreach-click', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: 'b18-0001', path: '/' }) }),
      new Request('http://localhost:3000/api/outreach-click', { method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ code: 'b18-0001', path: '/' }) }),
    ]
    for (const request of attempts) {
      const response = await POST(request)
      assert.equal(response.status, 204)
      assert.equal(await response.text(), '')
    }
    assert.equal(state.calls(), 0)
    const fallback = new Request('https://internal.local/api/outreach-click', {
      method: 'POST',
      headers: { origin: 'https://www.getorangerank.com', 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'c3-0042', path: '/privacy' }),
    })
    assert.equal((await POST(fallback)).status, 204)
    const browserHost = new Request('http://localhost:3000/api/outreach-click', {
      method: 'POST',
      headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000', 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'fu2-0001', path: '/' }),
    })
    assert.equal((await POST(browserHost)).status, 204)
    const stored = JSON.stringify(state.commands)
    assert.equal(stored.includes('c3-0042'), true)
    assert.equal(stored.includes('fu2-0001'), true)
    assert.equal(stored.includes('b18-0001'), false)
  } finally { restore(saved) }
})

test('a Redis failure stays silent and does not echo the failure', async () => {
  const saved = { ...process.env }
  const logs = []
  try {
    Object.assign(process.env, redisEnv)
    mock.method(console, 'info', line => logs.push(String(line)))
    mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'NOAUTH person@example.com dummy-redis-token' }), { status: 500 }))
    const response = await POST(clickRequest({ code: 'b18-0001', path: '/' }))
    assert.equal(response.status, 204)
    assert.equal(await response.text(), '')
    assert.equal(logs.join(''), JSON.stringify({ event: 'outreach_click', result: 'UNAVAILABLE' }))
    delete process.env.UPSTASH_REDIS_REST_URL
    logs.length = 0
    assert.equal((await POST(clickRequest({ code: 'not-a-code', path: '/' }))).status, 204)
    assert.equal(logs.length, 0)
    assert.equal((await POST(clickRequest({ code: 'b18-0001', path: '/' }))).status, 204)
    assert.match(logs.join(''), /UNAVAILABLE/)
    assert.equal(logs.join('').includes('person@example.com'), false)
    assert.equal(logs.join('').includes('b18-0001'), false)
  } finally { restore(saved) }
})

test('the internal read route requires its own secret and a real date range', async () => {
  const saved = { ...process.env }
  const logs = []
  try {
    Object.assign(process.env, redisEnv)
    mock.method(console, 'info', line => logs.push(String(line)))
    assert.equal((await GET(readRequest('?date=2026-10-24', ''))).status, 401)
    assert.equal((await GET(readRequest('?date=2026-10-24', `Bearer ${'d'.repeat(32)}`))).status, 401)
    assert.equal((await GET(readRequest('?date=2026-10-24', `Bearer ${'a'.repeat(32)}`))).status, 401)
    assert.equal((await GET(readRequest('?date=2026-10-24', `Bearer ${'c'.repeat(31)}`))).status, 401)
    assert.equal((await GET(readRequest('?date=2026-10-24', `Bearer person@example.com ${clicksSecret}`))).status, 401)
    process.env.ORANGERANK_OUTREACH_CLICKS_SECRET = 'd'.repeat(32)
    assert.equal((await GET(readRequest('?date=2026-10-24', `Bearer ${'d'.repeat(32)}`))).status, 401)
    process.env.ORANGERANK_OUTREACH_CLICKS_SECRET = clicksSecret
    for (const query of ['', '?date=2026-02-31', '?date=2026-10-24&from=2026-10-01', '?from=2026-10-24&to=2026-10-01', '?from=2026-01-01&to=2026-04-01', '?date=2026-10-24&date=2026-10-25']) {
      assert.equal((await GET(readRequest(query))).status, 400, query)
    }
    assert.equal(logs.join('').includes(clicksSecret), false)
    assert.equal(logs.join('').includes('person@example.com'), false)
  } finally { restore(saved) }
})

test('a date range returns stored clicks, skips poisoned rows, and caps a day', async () => {
  const saved = { ...process.env }
  try {
    Object.assign(process.env, redisEnv)
    const state = memory()
    state.lists.set('or:clicks:2026-10-24', [
      JSON.stringify({ code: 'b18-0001', path: '/', at: '2026-10-24T12:00:00.000Z' }),
      JSON.stringify({ code: 'b18-0001', path: '/', at: '2026-10-24T12:00:00.000Z', email: 'person@example.com' }),
      'not-json',
      JSON.stringify({ code: 'person@example.com', path: '/', at: '2026-10-24T12:00:00.000Z' }),
    ])
    state.lists.set('or:clicks:2026-10-25', [
      JSON.stringify({ code: 'b18-0001-f2', path: '/get-your-orange-score', at: '2026-10-25T01:02:03.004Z' }),
    ])
    const response = await GET(readRequest('?from=2026-10-24&to=2026-10-25'))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      from: '2026-10-24',
      to: '2026-10-25',
      truncated: false,
      clicks: [
        { code: 'b18-0001', path: '/', at: '2026-10-24T12:00:00.000Z' },
        { code: 'b18-0001-f2', path: '/get-your-orange-score', at: '2026-10-25T01:02:03.004Z' },
      ],
    })
    assert.equal(state.calls(), 1)
    assert.deepEqual(state.commands.map(command => command[0]), ['lrange', 'lrange'])
    const crowded = Array.from({ length: CLICK_READ_LIMIT + 1 }, () => JSON.stringify({ code: 'b7-0001', path: '/', at: '2026-10-26T00:00:00.000Z' }))
    state.lists.set('or:clicks:2026-10-26', crowded)
    const capped = await GET(readRequest('?date=2026-10-26'))
    const cappedBody = await capped.json()
    assert.equal(cappedBody.truncated, true)
    assert.equal(cappedBody.clicks.length, CLICK_READ_LIMIT)
    assert.equal(JSON.stringify(cappedBody).includes('person@example.com'), false)
    mock.restoreAll()
    const logs = []
    mock.method(console, 'info', line => logs.push(String(line)))
    mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'NOAUTH person@example.com dummy-redis-token' }), { status: 500 }))
    const failed = await GET(readRequest('?date=2026-10-24'))
    assert.equal(failed.status, 503)
    assert.deepEqual(await failed.json(), { result: 'UNAVAILABLE' })
    assert.equal(logs.join('').includes('person@example.com'), false)
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    assert.equal((await GET(readRequest('?date=2026-10-24'))).status, 503)
  } finally { restore(saved) }
})

test('daily, per-code, and short-lived address limits skip writes and keep no address', async () => {
  const saved = { ...process.env }
  try {
    Object.assign(process.env, redisEnv)
    const state = memory()
    const address = '203.0.113.44'
    const other = '203.0.113.45'
    await POST(clickRequest({ code: 'b18-0001', path: '/files/guide.pdf' }, { 'x-forwarded-for': `${address}, 10.0.0.1` }))
    const listKey = state.commands.find(command => command[0] === 'eval')[3]
    const day = listKey.slice('or:clicks:'.length)
    const codeKey = `or:clicks:n:${day}:b18-0001`
    assert.equal(JSON.parse(state.lists.get(listKey)[0]).path, '/files/guide.pdf')
    assert.equal(state.redis.ttls.get(codeKey), CLICK_TTL_SECONDS)
    state.redis.rows.set(codeKey, String(CLICK_CODE_DAY_CAP))
    await POST(clickRequest({ code: 'b18-0001', path: '/' }, { 'x-forwarded-for': address }))
    assert.equal(state.lists.get(listKey).length, 1)
    await POST(clickRequest({ code: 'b18-0002', path: '/' }, { 'x-forwarded-for': address }))
    assert.equal(state.lists.get(listKey).length, 2)
    const addressKey = clientAddressKey(address)
    state.redis.rows.set(addressKey, String(CLICK_IP_LIMIT))
    await POST(clickRequest({ code: 'b18-0003', path: '/' }, { 'x-forwarded-for': address }))
    assert.equal(state.lists.get(listKey).length, 2)
    await POST(clickRequest({ code: 'b18-0003', path: '/' }, { 'x-forwarded-for': other }))
    assert.equal(state.lists.get(listKey).length, 3)
    state.lists.set(listKey, Array.from({ length: CLICK_DAY_CAP }, () => state.lists.get(listKey)[0]))
    const keysBeforeCap = state.redis.rows.size
    await POST(clickRequest({ code: 'b18-0099', path: '/' }, { 'x-forwarded-for': '198.51.100.20' }))
    assert.equal(state.lists.get(listKey).length, CLICK_DAY_CAP)
    assert.equal(state.redis.rows.size, keysBeforeCap)
    const dumped = JSON.stringify([...state.lists.values(), ...state.redis.rows.keys(), ...state.commands])
    assert.equal(dumped.includes(address), false)
    assert.equal(dumped.includes(other), false)
    assert.equal(state.redis.ttls.get(addressKey), CLICK_IP_WINDOW_SECONDS)
    assert.equal(addressKey.startsWith('or:clicks:rl:'), true)
    assert.equal(clientAddressKey('not-an-address'), null)
    assert.equal(clientAddressKey(address), clientAddressKey(` ${address}, 198.51.100.1`))
  } finally { restore(saved) }
})

test('privacy copy, beacon wiring, and the read secret are documented without touching checkout or handoff', () => {
  const privacy = readFileSync('app/privacy/page.tsx', 'utf8')
  assert.match(privacy, /Campaign-link clicks record an opaque code, the page path, and the time for about 90 days, and do not include a name, email, IP address, or user agent\./)
  assert.match(readFileSync('app/layout.tsx', 'utf8'), /OutreachClickBeacon/)
  const beacon = readFileSync('components/site/outreach-click.tsx', 'utf8')
  assert.match(beacon, /sessionStorage/)
  assert.match(beacon, /credentials: 'omit'/)
  assert.match(beacon, /beaconBody/)
  assert.doesNotMatch(beacon, /@upstash\/redis|store\(/)
  const server = ['app/api/outreach-click/route.ts', 'app/api/internal/outreach-clicks/route.ts', 'lib/outreach/clicks.ts', 'lib/outreach/code.ts'].map(path => readFileSync(path, 'utf8')).join('\n')
  assert.match(server, /ORANGERANK_OUTREACH_CLICKS_SECRET/)
  assert.match(server, /x-forwarded-for/)
  assert.match(server, /sha256/)
  assert.doesNotMatch(server, /user-agent|remoteAddress|headers\.get\('cookie'\)/i)
  for (const path of ['app/api/stripe/webhook/route.ts', 'app/api/checkout/route.ts', 'app/api/checkout/status/route.ts', 'app/api/internal/assessment-handoff/route.ts']) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /outreach/)
  }
  assert.match(readFileSync('.env.example', 'utf8'), /ORANGERANK_OUTREACH_CLICKS_SECRET=/)
  const doc = readFileSync('docs/outreach-clicks.md', 'utf8')
  assert.match(doc, /ORANGERANK_OUTREACH_CLICKS_SECRET/)
  assert.match(doc, /\/api\/internal\/outreach-clicks\?date=/)
  assert.match(readFileSync('docs/production-launch.md', 'utf8'), /ORANGERANK_OUTREACH_CLICKS_SECRET/)
})
