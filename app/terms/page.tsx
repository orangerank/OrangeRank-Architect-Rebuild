import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/legal-page'
export const metadata: Metadata = { title: 'Terms of Service | OrangeRank', robots: { index: false, follow: false } }
export default function TermsPage() {
  return <LegalPage title="Terms of Service">
    <section><h2>1. About OrangeRank</h2><p>OrangeRank offers a $149 one-time AI Visibility Assessment for a single business or location. The assessment evaluates how AI and search systems represent a business and provides a score, evidence, competitor context, and suggested improvements. It is an assessment and report, not an ongoing subscription or a service that controls third-party platforms.</p></section>
    <section><h2>2. What the report means</h2><p>Reports reflect observations made during an assessment. Results may vary with the query, platform, location, time, and other conditions. AI output may contain errors or omissions. Recommendations are informational, not legal, financial, or other professional advice. Review findings before relying on them or making business decisions.</p></section>
    <section><h2>3. Your responsibilities</h2><p>Provide accurate business and contact details, ensure you are authorized to request an assessment for the business, and supply only information you have the right to share. Do not include passwords, payment-card details, or confidential information unrelated to the assessment. You remain responsible for decisions and changes made using the report.</p></section>
    <section><h2>4. Payment</h2><p>The price is $149, paid once at checkout.</p></section>
    <section><h2>5. Intellectual property</h2><p>You retain your rights in material you provide. OrangeRank’s branding, methods, and original report materials remain the property of OrangeRank or their respective rights holders. Third-party content remains subject to its owners’ rights. You may use your report for your business.</p></section>
    <section><h2>6. Acceptable use</h2><p>Do not use OrangeRank for unlawful activity, impersonation, harassment, infringement, unauthorized access, or attempts to disrupt the service. Do not submit information obtained unlawfully or ask OrangeRank to manipulate platforms through prohibited methods.</p></section>
    <section><h2>7. Third-party platforms and outcomes</h2><p>OrangeRank does not control or speak for third-party AI or search platforms. Their models, policies, content, and results can change without notice. An assessment does not guarantee rankings, recommendations, leads, revenue, or any other business outcome. A score is not a promise of future platform behavior.</p></section>
    <section><h2>8. Disclaimer</h2><p>The assessment is informational and based on available evidence. It is not a guarantee of complete or error-free platform output. Nothing here excludes rights that applicable law does not allow a business to exclude.</p></section>
    <section><h2>9. Contact</h2><p>Questions about OrangeRank: <a href="mailto:hello@getorangerank.com">hello@getorangerank.com</a>. See the <a href="/privacy">Privacy Policy</a> for how intake information is handled.</p></section>
  </LegalPage>
}
