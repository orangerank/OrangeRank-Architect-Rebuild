// Run: node --test tests/intake-validation.test.mjs (Node 24+)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateIntake, requiredFields, emailSuggestion, prefillFromSearchParams } from '../components/intake/validation.ts'
const valid = { businessName: 'Example', website: 'https://example.com', customerName: 'Alex', email: 'alex@example.com', category: 'Home services', city: 'Austin', state: 'Texas', services: 'Plumbing', serviceArea:'Austin metro', acceptance: 'yes' }
test('all required fields reject empty and whitespace-only input', () => {
  for (const key of requiredFields) for (const value of ['', '   ']) assert.ok(validateIntake({ ...valid, [key]: value })[key])
})
test('complete intake passes without optional data', () => assert.deepEqual(validateIntake(valid), {}))
test('email validation', () => {
  for (const email of ['alex', 'alex@', '@example.com', 'alex@example', 'alex @example.com']) assert.ok(validateIntake({ ...valid, email }).email)
  assert.equal(validateIntake({ ...valid, email: 'alex+business@example.co.uk' }).email, undefined)
})
test('all seven URL fields reject invalid protocols and malformed URLs', () => {
  for (const key of ['website', 'googleUrl', 'url0', 'url1', 'url2', 'url3', 'url4']) {
    for (const value of ['example.com', 'javascript:alert(1)', 'ftp://example.com', 'https://', 'https://user:password@example.com']) assert.ok(validateIntake({ ...valid, [key]: value })[key])
    for (const value of [...(key === 'website' ? [] : ['']), 'https://example.com/path?q=1', 'http://example.com']) assert.equal(validateIntake({ ...valid, [key]: value })[key], undefined)
  }
})
test('selectors reject values outside their options', () => {
  assert.ok(validateIntake({ ...valid, state: 'Unknown' }).state)
  assert.ok(validateIntake({ ...valid, category: 'Unknown' }).category)
})
test('required fields stay the full assessment set', () => {
  assert.deepEqual(requiredFields, ['businessName', 'website', 'customerName', 'email', 'category', 'city', 'state', 'services', 'serviceArea', 'acceptance'])
})
test('common domain typos suggest a correction without failing validation', () => {
  assert.equal(validateIntake({ ...valid, email: 'alex@gmali.com' }).email, undefined)
  assert.equal(emailSuggestion('alex@gmali.com'), 'alex@gmail.com')
  assert.equal(emailSuggestion('Alex@Gmali.COM'), 'Alex@gmail.com')
  assert.equal(emailSuggestion('alex@gmail.com'), null)
  assert.equal(emailSuggestion('alex@example.com'), null)
  assert.equal(emailSuggestion('not-an-email'), null)
})
test('prefill reads biz, site, city and email and ignores utm params', () => {
  const params = new URLSearchParams('biz=North%20Line&site=https%3A%2F%2Fnorth.example&city=St.%20Louis&email=a%40gmali.com&utm_source=outreach&utm_campaign=fall')
  assert.deepEqual(prefillFromSearchParams(params), {
    businessName: 'North Line',
    website: 'https://north.example',
    city: 'St. Louis',
    email: 'a@gmali.com',
  })
  assert.deepEqual(prefillFromSearchParams({ biz: ['Second', 'Ignored'], utm_source: 'ads' }), { businessName: 'Second' })
})
