import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const files=['components/intake/intake-form.tsx','components/intake/payment-status.tsx','components/intake/resume-checkout.tsx','app/checkout/success/page.tsx','app/checkout/cancel/page.tsx','app/get-your-orange-score/page.tsx','components/site/site-footer.tsx','components/legal/legal-page.tsx','app/privacy/page.tsx','app/terms/page.tsx','components/site/faq-section.tsx','components/site/pricing-section.tsx','components/site/final-cta.tsx','components/site/how-it-works.tsx']
const banned=/test checkout|test-only|TEST MODE|\bsandbox\b|\bSandbox\b|\bPreview\b|live payments are disabled|Stage 2A|OWNER REVIEW REQUIRED|intake preview|Legal drafts|draft Terms|draft Privacy|payment is not connected/i
test('customer pages do not describe the site as a test, sandbox, or preview',()=>{
 for(const file of files){
  const source=readFileSync(file,'utf8')
  assert.equal(banned.test(source),false,`${file} still has launch wording: ${source.match(banned)?.[0]}`)
 }
})
test('hero, faq, and intake copy do not name Stripe',()=>{
 for(const file of ['components/site/hero.tsx','components/site/faq-section.tsx','components/intake/intake-form.tsx']){
  const source=readFileSync(file,'utf8')
  assert.equal(/\bStripe\b/.test(source),false,`${file} still names Stripe in customer copy`)
 }
})
