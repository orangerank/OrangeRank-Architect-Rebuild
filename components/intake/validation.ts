export const categories = ['Home services', 'Professional services', 'Healthcare', 'Dental', 'Legal', 'Real estate', 'Automotive', 'Beauty & wellness', 'Restaurants & hospitality', 'Retail', 'Other']
export const states = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming']
export type IntakeValues = { website?: string } & Record<string, string>
export const requiredFields = ['businessName', 'website', 'customerName', 'email', 'category', 'city', 'state', 'services', 'serviceArea', 'acceptance']
const domainTypos: Record<string, string> = {
  'gmali.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'gmail.comm': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'yahooo.com': 'yahoo.com',
  'yaho.com': 'yahoo.com',
  'yhaoo.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'outloo.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'icloud.co': 'icloud.com',
  'icloud.con': 'icloud.com',
  'icoud.com': 'icloud.com',
  'aol.co': 'aol.com',
  'aol.con': 'aol.com',
}

/** Suggest a corrected address for a common provider typo. A suggestion is not a validation error. */
export function emailSuggestion(email: string): string | null {
  const trimmed = email.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null
  const at = trimmed.lastIndexOf('@')
  const domain = trimmed.slice(at + 1).toLowerCase()
  const correction = domainTypos[domain]
  if (!correction) return null
  return `${trimmed.slice(0, at)}@${correction}`
}

const prefillParams = [
  ['biz', 'businessName', 200],
  ['site', 'website', 500],
  ['city', 'city', 200],
  ['email', 'email', 200],
] as const

/** Read outreach query params. Other params, including utm_*, are left untouched. */
export function prefillFromSearchParams(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): IntakeValues {
  const read = (name: string) => {
    const value = params instanceof URLSearchParams ? params.get(name) : params[name]
    return Array.isArray(value) ? value[0] : value
  }
  const values: IntakeValues = {}
  for (const [param, key, limit] of prefillParams) {
    const raw = read(param)
    if (typeof raw !== 'string') continue
    const value = raw.replace(/[\u0000-\u001f]/g, '').trim().slice(0, limit)
    if (value) values[key] = value
  }
  return values
}

export function validateIntake(values: IntakeValues) {
  const errors: Record<string, string> = {}
  for (const key of requiredFields) if (!values[key]?.trim()) errors[key] = 'This field is required.'
  if (values.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Enter a valid email address.'
  if (values.category && !categories.includes(values.category)) errors.category = 'Choose a business category.'
  if (values.state && !states.includes(values.state)) errors.state = 'Choose a state.'
  for (const key of ['website', 'googleUrl', ...Array.from({ length: 5 }, (_, i) => `url${i}`)]) {
    if (!values[key]?.trim()) continue
    try {
      const url = new URL(values[key].trim())
      if (!['https:', 'http:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) throw new Error()
    } catch { errors[key] = 'Enter a full http:// or https:// URL without credentials.' }
  }
  return errors
}
