// Pure click-code rules. Safe to import from the browser beacon.
// Accepted shape: b18-0001, plus a short follow-up suffix such as b18-0001-f2.
const CLICK_CODE = /^[a-z][a-z0-9]{0,6}\d-\d{4}(?:-[a-z0-9]{1,8})?$/
const CLICK_PATH = /^\/(?:[a-z0-9._-]+(?:\/[a-z0-9._-]+)*)?$/
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
const AT = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

export const CLICK_TTL_SECONDS = 90 * 24 * 60 * 60
export const CLICK_READ_LIMIT = 5000
export const CLICK_SPAN_LIMIT = 90

export type Click = { code: string, path: string, at: string }

export function outreachCode(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const code = value.trim().toLowerCase()
  if (code.length > 24 || !CLICK_CODE.test(code)) return null
  return code
}

export function outreachPath(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const raw = value.trim().toLowerCase()
  if (raw.includes('//') || raw.includes('..') || raw.length > 128) return null
  const path = raw.length > 1 && raw.endsWith('/') ? raw.slice(0, -1) : raw
  if (!path || path.length > 128 || !CLICK_PATH.test(path) || path.split('/').includes('.')) return null
  return path
}

export function beaconBody(search: string, pathname: string): { code: string, path: string } | null {
  let params: URLSearchParams
  try { params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search) } catch { return null }
  const code = outreachCode(params.get('utm_content'))
  const path = outreachPath(pathname)
  if (!code || !path) return null
  return { code, path }
}

export function shouldSendClick(code: string, seen: (key: string) => string | null, mark: (key: string) => void, inflight: Set<string>): boolean {
  const key = `or:click:${code}`
  if (inflight.has(code)) return false
  try {
    if (seen(key) === '1') return false
  } catch { /* storage can be blocked; one send still happens for this load */ }
  inflight.add(code)
  try { mark(key) } catch { /* the in-memory set covers this page load */ }
  return true
}

export function parseDay(value: string): string | null {
  const match = DAY.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${match[1]}-${match[2]}-${match[3]}`
}

export function clickSpan(from: string, to: string): string[] | null {
  const start = parseDay(from)
  const end = parseDay(to)
  if (!start || !end || start > end) return null
  const days: string[] = []
  const cursor = new Date(`${start}T00:00:00.000Z`)
  while (cursor.toISOString().slice(0, 10) <= end) {
    days.push(cursor.toISOString().slice(0, 10))
    if (days.length > CLICK_SPAN_LIMIT) return null
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return days
}

export function clickKey(day: string) {
  return `or:clicks:${day}`
}

export function parseClick(value: unknown, day: string): Click | null {
  let record: unknown = value
  if (typeof value === 'string') {
    try { record = JSON.parse(value) } catch { return null }
  }
  if (!record || typeof record !== 'object' || Array.isArray(record)) return null
  const row = record as Record<string, unknown>
  if (Object.keys(row).sort().join(',') !== 'at,code,path') return null
  const code = outreachCode(row.code)
  const path = outreachPath(row.path)
  if (!code || !path || code !== row.code || path !== row.path) return null
  if (typeof row.at !== 'string' || !AT.test(row.at) || !row.at.startsWith(`${day}T`)) return null
  return { code, path, at: row.at }
}
