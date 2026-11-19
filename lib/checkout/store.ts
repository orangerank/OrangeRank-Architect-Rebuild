import { Redis } from '@upstash/redis'
import { assessmentBase, pending, type Pending } from './core'
import type { IntakeValues } from '../../components/intake/validation'
export function store(automaticDeserialization = true) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) throw new Error('CONFIG')
  return new Redis({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN,automaticDeserialization})
}
export const reserveScript = `
local old = redis.call('GET', KEYS[1])
if old then
  local existing = cjson.decode(old)
  local proposed = cjson.decode(ARGV[1])
  if existing.fingerprint ~= proposed.fingerprint or existing.origin ~= proposed.origin or existing.price ~= proposed.price then return 'SUBMISSION_CONFLICT' end
  return old
end
local n = redis.call('INCR', KEYS[2])
local record = cjson.decode(ARGV[1])
if n > 1 then record.assessment_id = record.assessment_id .. '-' .. n end
local encoded = cjson.encode(record)
redis.call('SET', KEYS[1], encoded)
return encoded
`
export async function reserve(redis: Redis, values: IntakeValues, submission: string, origin:string, price:string) {
  const now = new Date()
  const base = assessmentBase(values.businessName,now)
  const result = await redis.eval(reserveScript, [`or:intake:${submission}`,`or:ids:${base}`], [JSON.stringify(pending(values,base,submission,now,origin,price))])
  if(result==='SUBMISSION_CONFLICT')throw new Error('SUBMISSION_CONFLICT')
  return (typeof result === 'string' ? JSON.parse(result) : result) as Pending
}
