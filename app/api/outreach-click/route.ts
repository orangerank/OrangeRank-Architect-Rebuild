import { store } from '@/lib/checkout/store'
import { outreachCode, outreachPath } from '@/lib/outreach/code'
import { clientAddressKey, rememberClick } from '@/lib/outreach/clicks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function quiet(result?: 'UNAVAILABLE') {
  if (result) {
    try { console.info(JSON.stringify({ event: 'outreach_click', result })) } catch { /* logging must not change the response */ }
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
}

function siteHost(value: string | null) {
  if (!value) return ''
  try { return new URL(value.includes('://') ? value : `http://${value}`).host } catch { return '' }
}

function sameSite(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin.length > 200) return false
  const originHost = siteHost(origin)
  if (!originHost) return false
  const allowed = [siteHost(request.url), siteHost(request.headers.get('host'))]
  const configured = process.env.ORANGERANK_CHECKOUT_ORIGIN
  if (configured) allowed.push(siteHost(configured))
  return allowed.some(host => host === originHost)
}

export async function POST(request: Request) {
  try {
    if (!sameSite(request)) return quiet()
    const type = request.headers.get('content-type') ?? ''
    if (!type.startsWith('application/json')) return quiet()
    const text = await request.text()
    if (Buffer.byteLength(text) > 512) return quiet()
    let parsed: unknown
    try { parsed = JSON.parse(text) } catch { return quiet() }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return quiet()
    const body = parsed as Record<string, unknown>
    const keys = Object.keys(body).sort()
    if (keys.join(',') !== 'code,path') return quiet()
    const code = outreachCode(body.code)
    const path = outreachPath(body.path)
    if (!code || !path) return quiet()
    await rememberClick(store(false), code, path, new Date(), clientAddressKey(request.headers.get('x-forwarded-for')))
    return quiet()
  } catch {
    return quiet('UNAVAILABLE')
  }
}
