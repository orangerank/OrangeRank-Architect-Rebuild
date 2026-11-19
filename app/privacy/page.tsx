import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
export const metadata: Metadata = { title: 'Privacy Policy | OrangeRank', robots: { index: false, follow: false } }
export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy">
    <section><h2>1. What this policy covers</h2><p>This policy describes how OrangeRank handles the business and contact details you submit to request a $149 AI Visibility Assessment.</p></section>
    <section><h2>2. Information you can enter</h2><p>The form asks for business name, customer name, email, website, business category, primary city, state, and primary services. It also includes a terms and privacy acceptance checkbox.</p><p>Optional fields include phone, service area, known competitors, Google Business Profile URL, up to five additional URLs, and notes. Do not enter passwords, payment-card details, or unrelated confidential material.</p></section>
    <section><h2>3. How we use your intake</h2><p>When you continue, we save your intake and open checkout. Payment-card details are entered on the checkout page, not on the OrangeRank form. We use the details you provide to prepare your assessment and to send the finished report to the email address on the form.</p></section>
    <section><h2>4. Who processes it</h2><p>Stripe processes the payment. Hosting and infrastructure providers process the information needed to run the site and store the intake. We do not sell the information you submit on the form.</p></section>
    <section><h2>5. Site analytics</h2><p>The production site includes Vercel Analytics. The intake form does not send your field values to that component.</p><p>Campaign-link clicks record an opaque code, the page path, and the time for about 90 days, and do not include a name, email, IP address, or user agent.</p></section>
    <section><h2>6. Retention and requests</h2><p>We keep the intake for the assessment and related support. To ask about access or deletion, contact <a href="mailto:hello@getorangerank.com">hello@getorangerank.com</a>.</p></section>
    <section><h2>7. Updates</h2><p>We may update this policy as the service changes. Review the <a href="/terms">Terms of Service</a> alongside it.</p></section>
  </LegalPage>
}
