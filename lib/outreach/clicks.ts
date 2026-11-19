import { createHash } from 'node:crypto'
import { isIP } from 'node:net'
import type { Redis } from '@upstash/redis'
import { CLICK_READ_LIMIT, CLICK_TTL_SECONDS, clickKey, outreachCode, outreachPath, parseClick, type Click } from './code'

export const CLICK_DAY_CAP = 2000
export const CLICK_CODE_DAY_CAP = 20
export const CLICK_IP_LIMIT = 30
export const CLICK_IP_WINDOW_SECONDS = 10 * 60

// Atomic cap. A full day returns before any new counter key is created.
export const recordClickScript = `
local listKey = KEYS[1]
local codeKey = KEYS[2]
local addressKey = KEYS[3]
local payload = ARGV[1]
local dayTtl = tonumber(ARGV[2])
local dayCap = tonumber(ARGV[3])
local codeCap = tonumber(ARGV[4])
local addressCap = tonumber(ARGV[5])
local addressTtl = tonumber(ARGV[6])
if redis.call('LLEN', listKey) >= dayCap then return 0 end
if ARGV[7] == '1' then
  local n = redis.call('INCR', addressKey)
  if n == 1 then redis.call('EXPIRE', addressKey, addressTtl) end
  if n > addressCap then return 0 end
end
local seen = redis.call('INCR', codeKey)
if seen == 1 then redis.call('EXPIRE', codeKey, dayTtl) end
if seen > codeCap then return 0 end
redis.call('RPUSH', listKey, payload)
redis.call('EXPIRE', listKey, dayTtl)
return 1
`

// Server-only Redis access. The browser beacon imports ./code and never this file.
export function clientAddressKey(header: string | null): string | null {
  if (!header || header.length > 300) return null
  const first = header.split(',')[0]?.trim().toLowerCase() ?? ''
  if (!first || first.length > 64 || isIP(first) === 0) return null
  const digest = createHash('sha256').update(`or-click-v1|${first}`).digest('hex').slice(0, 16)
  return `or:clicks:rl:${digest}`
}

export async function rememberClick(redis: Redis, code: string, path: string, now: Date, addressKey: string | null = null): Promise<void> {
  const normalizedCode = outreachCode(code)
  const normalizedPath = outreachPath(path)
  if (!normalizedCode || !normalizedPath || Number.isNaN(now.getTime())) return
  const at = now.toISOString()
  const day = at.slice(0, 10)
  const payload = JSON.stringify({ code: normalizedCode, path: normalizedPath, at })
  await redis.eval(recordClickScript, [clickKey(day), `or:clicks:n:${day}:${normalizedCode}`, addressKey || 'or:clicks:rl:none'], [payload, String(CLICK_TTL_SECONDS), String(CLICK_DAY_CAP), String(CLICK_CODE_DAY_CAP), String(CLICK_IP_LIMIT), String(CLICK_IP_WINDOW_SECONDS), addressKey ? '1' : '0'])
}

export async function readClicks(redis: Redis, days: string[]): Promise<{ clicks: Click[], truncated: boolean }> {
  const batch = redis.pipeline()
  for (const day of days) batch.lrange(clickKey(day), 0, CLICK_READ_LIMIT)
  const rows = await batch.exec() as unknown[]
  const clicks: Click[] = []
  let truncated = false
  for (let index = 0; index < days.length; index++) {
    const row = rows[index]
    if (row == null) continue
    if (!Array.isArray(row)) throw new Error('CLICK_LIST')
    const list = row.length > CLICK_READ_LIMIT ? (truncated = true, row.slice(0, CLICK_READ_LIMIT)) : row
    for (const item of list) {
      const click = parseClick(item, days[index])
      if (click) clicks.push(click)
    }
  }
  return { clicks, truncated }
}
