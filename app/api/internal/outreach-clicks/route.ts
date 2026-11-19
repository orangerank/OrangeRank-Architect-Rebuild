import { timingSafeEqual } from 'node:crypto'
import { store } from '@/lib/checkout/store'
import { clickSpan } from '@/lib/outreach/code'
import { readClicks } from '@/lib/outreach/clicks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'no-store' }
const distinct = ['ORANGERANK_AUDIT_SECRET', 'ORANGERANK_DISPATCH_SECRET', 'ORANGERANK_REVIEW_REPLAY_SECRET', 'ORANGERANK_SANDBOX_CORRECTION_SECRET']

function fail(status: number, result: string) {
  if (result === 'UNAVAILABLE') {
    try { console.info(JSON.stringify({ event: 'outreach_clicks_read', result })) } catch { /* logging must not change the response */ }
  }
  return Response.json({ result }, { status, headers })
}

function authorized(supplied: string) {
  const secret = process.env.ORANGERANK_OUTREACH_CLICKS_SECRET
  if (!secret || secret.length < 32 || supplied.length > 1024) return false
  if (distinct.some(name => secret === process.env[name])) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(supplied)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function requestedDays(url: URL) {
  const names = [...new Set(url.searchParams.keys())]
  if (names.length === 1 && names[0] === 'date') {
    const values = url.searchParams.getAll('date')
    if (values.length !== 1) return null
    return clickSpan(values[0], values[0])
  }
  if (names.length === 2 && names.includes('from') && names.includes('to')) {
    const from = url.searchParams.getAll('from')
    const to = url.searchParams.getAll('to')
    if (from.length !== 1 || to.length !== 1) return null
    return clickSpan(from[0], to[0])
  }
  return null
}

export async function GET(request: Request) {
  if (!authorized(request.headers.get('authorization') ?? '')) return fail(401, 'UNAUTHORIZED')
  const days = requestedDays(new URL(request.url))
  if (!days) return fail(400, 'INVALID_DATE')
  try {
    const report = await readClicks(store(false), days)
    return Response.json({ from: days[0], to: days[days.length - 1], truncated: report.truncated, clicks: report.clicks }, { headers })
  } catch {
    return fail(503, 'UNAVAILABLE')
  }
}
