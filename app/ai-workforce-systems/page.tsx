import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { Container } from '@/components/site/section-heading'

export const metadata: Metadata = {
  title: 'AI Workforce Systems | OrangeRank',
  description:
    'A 7-agent AI sales team for companies that sell to other businesses. It finds, qualifies and pitches prospects, and you approve every send.',
  alternates: { canonical: '/ai-workforce-systems' },
}

const roles = [
  { title: 'Lead Finder', body: 'Builds target lists.' },
  { title: 'Lead Qualifier', body: 'Checks fit and contact quality.' },
  { title: 'Prospect Research/Intelligence', body: 'Researches each account.' },
  { title: 'Outreach', body: 'Writes personalized first-touch emails.' },
  { title: 'Follow-Up', body: 'Sequenced follow-ups and reply handling.' },
  { title: 'QA', body: 'Reviews every draft against rules.' },
  { title: 'Human approval', body: 'You approve every send.' },
]

const alsoAvailable = [
  { title: 'Marketing', body: 'Content drafting, campaign research, competitor monitoring, and reporting.' },
  { title: 'Research', body: 'Market and competitor intelligence, briefs, and ongoing monitoring.' },
  { title: 'Operations', body: 'Repetitive, rules-based operations work, scoped to the workflow you already run.' },
  { title: 'Customer service', body: 'Inquiry triage, answer drafting from your knowledge base, and escalation to staff.' },
]

const stages = [
  {
    title: 'Discovery',
    body: 'We learn the business first: products, customers, revenue, people, operations, and current tools. We map where time goes and find the repetitive work, bottlenecks, and missed opportunities worth automating.',
  },
  {
    title: 'Architecture',
    body: 'We design the smallest AI team that does the job: how many agents, what each one owns, what it knows, which tools it can touch, how work passes between agents, where data lives, and where a person must approve.',
  },
  {
    title: 'Implementation',
    body: 'We build it: agent instructions, knowledge bases, structured handoffs, integrations with your email, spreadsheets, databases, CRM and other tools, then test end to end before anything goes live.',
  },
  {
    title: 'Ongoing optimization',
    body: 'We monitor performance, reliability, errors, and outcomes, fix what breaks, tune what underperforms, and expand into new departments as the value is proven.',
  },
]

const deliverables = [
  'Discovery Brief',
  'Process Map (current and future state)',
  'AI Opportunity Assessment',
  'Workforce Architecture',
  'Responsibility Matrix (who and what owns each task)',
  'Agent instructions for each AI role',
  'Handoff standards between agents',
  'Integration Architecture',
  'Knowledge Base Plan',
  'Data / Database Design',
  'Implementation Roadmap',
  'QA and Test Plan',
  'Human Approval Matrix',
  'Deployment Documentation',
  'Optimization Plan',
]

function DiscoveryLink({ className = '' }: { className?: string }) {
  return (
    <a
      href="mailto:hello@getorangerank.com"
      className={`inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-[15px] font-semibold text-black hover:bg-brand-light sm:w-auto ${className}`}
    >
      Book a discovery call
    </a>
  )
}

export default function AiWorkforceSystemsPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section aria-labelledby="workforce-title" className="border-b border-white/[0.08] bg-black">
          <Container className="py-16 sm:py-24">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">AI Workforce Systems</p>
            <h1 id="workforce-title" className="mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-5xl">
              A 7-agent AI sales team that finds, qualifies and pitches your prospects, with your approval on every send.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#C8C8C8]">
              For companies that sell to other businesses and need more pipeline. The team has roles, handoffs, and a person approving every email before it goes out.
            </p>
            <div className="mt-8">
              <DiscoveryLink />
            </div>
            <p className="mt-4 text-sm text-[#C8C8C8]">
              Or email <a className="font-semibold text-white underline decoration-brand/70 underline-offset-4" href="mailto:hello@getorangerank.com">hello@getorangerank.com</a>
            </p>
          </Container>
        </section>

        <section aria-labelledby="roles-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container>
            <h2 id="roles-title" className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">The team</h2>
            <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role, index) => (
                <li key={role.title} className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">0{index + 1}</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{role.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#C8C8C8]">{role.body}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        <section aria-labelledby="deployments-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container>
            <h2 id="deployments-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Proven deployments</h2>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[#C8C8C8] sm:text-lg">
              {'Deployed for OrangeRank\'s own sales pipeline and for EIP (Experience Improvement Partners), plus other companies.'}
            </p>
          </Container>
        </section>

        <section aria-labelledby="also-title" className="border-b border-white/[0.08] py-16 sm:py-20">
          <Container>
            <h2 id="also-title" className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Also available</h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#C8C8C8] sm:text-base">
              Other AI departments, scoped separately. Not fixed packages.
            </p>
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {alsoAvailable.map((item) => (
                <li key={item.title} className="rounded-2xl border border-white/[0.08] p-5">
                  <h3 className="text-base font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#C8C8C8]">{item.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        {/* TODO(chris): Do not publish timelines until Chris confirms them. */}
        <section aria-labelledby="stages-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container>
            <h2 id="stages-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">How we work</h2>
            <ol className="mt-8 grid gap-4 lg:grid-cols-4">
              {stages.map((stage, index) => (
                <li key={stage.title} className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">0{index + 1}</p>
                  <h3 className="mt-3 text-lg font-semibold text-white">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#C8C8C8]">{stage.body}</p>
                </li>
              ))}
            </ol>
            <ul className="mt-8 max-w-3xl space-y-3 text-sm leading-relaxed text-[#C8C8C8] sm:text-base">
              <li>Start with a discovery conversation.</li>
              <li>We propose an architecture and scope, with a clear split of one-time build and ongoing management.</li>
              <li>Build, test, and launch in phases, with your approval at each step.</li>
              <li>Your team approves anything consequential: outbound messages, data changes, deletions, and financial actions.</li>
              <li>Your data stays yours. Each client runs in its own isolated setup, accounts, and knowledge base, never mixed with other clients&apos;.</li>
              <li>Ongoing monthly management and optimization after launch. Add departments as value is shown.</li>
            </ul>
          </Container>
        </section>

        {/* TODO(chris): Do not name specific industries, regions, or company sizes until Chris confirms them. B2B companies that sell to other businesses is the confirmed buyer. */}
        <section aria-labelledby="deliverables-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container>
            <h2 id="deliverables-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">What an engagement can include</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#C8C8C8]">
              Scoped per client. Not every engagement includes every item.
            </p>
            <ul className="mt-8 grid gap-3 sm:grid-cols-2">
              {deliverables.map((item) => (
                <li key={item} className="rounded-xl border border-white/[0.08] px-4 py-3 text-sm text-white">
                  {item}
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="pricing-title" className="py-16 sm:py-24">
          <Container>
            <div className="rounded-3xl border border-brand/40 bg-black p-6 sm:p-10">
              {/* TODO(chris): Pricing is not approved for publication. No dollar figures. Interim wording only. */}
              <h2 id="pricing-title" className="text-3xl font-bold tracking-tight text-white">Pricing</h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#C8C8C8]">
                Scoped after discovery: one-time build plus monthly management.
              </p>
              <div className="mt-8">
                <DiscoveryLink />
              </div>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
