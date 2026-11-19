import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { Container } from '@/components/site/section-heading'

export const metadata: Metadata = {
  title: 'AI Workforce Systems | OrangeRank',
  description:
    'OrangeRank designs, builds, and runs teams of specialized AI agents that do repeatable work inside your business, with human approval on anything consequential.',
  alternates: { canonical: '/ai-workforce-systems' },
}

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

const departments = [
  { title: 'Sales', body: 'Market research, buying-signal monitoring, account research, decision-maker identification, sales strategy, outreach drafting, sales ops and QA.' },
  { title: 'Marketing', body: 'Content drafting, campaign research, competitor monitoring, reporting.' },
  { title: 'Research', body: 'Market and competitor intelligence, briefs, ongoing monitoring.' },
  { title: 'Customer Service', body: 'Inquiry triage, answer drafting from your knowledge base, escalation to staff.' },
  { title: 'Recruiting', body: 'Candidate sourcing, screening support, scheduling and follow-up coordination.' },
  { title: 'Custom', body: 'An AI team designed around a workflow unique to your business.' },
]

const problems = [
  'Skilled people spending hours on research, data entry, list building, follow-up, and reporting.',
  'Work that stalls between people or tools because handoffs are manual.',
  'Opportunities missed because nobody has time to watch for them, such as new leads, signals, and follow-ups.',
  'Scattered data with no single source of truth.',
  'AI tools bought but never wired into real processes, with no quality control.',
  'Fear of AI acting without a person in the loop. Human approval is built into every consequential step.',
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
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">OrangeRank</p>
            <h1 id="workforce-title" className="mt-4 max-w-3xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              AI Workforce Systems
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#C8C8C8]">
              We design, build, and run teams of specialized AI agents that do real, repeatable work inside your business, connected to your tools and checked by your people.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white">
              Not a chatbot. A working AI team with roles, handoffs, quality checks, and human approval.
            </p>
            <div className="mt-8">
              <DiscoveryLink />
            </div>
            <p className="mt-4 text-sm text-[#C8C8C8]">
              Or email <a className="font-semibold text-white underline decoration-brand/70 underline-offset-4" href="mailto:hello@getorangerank.com">hello@getorangerank.com</a>
            </p>
          </Container>
        </section>

        {/* TODO(chris): Do not name industries, regions, or company sizes until Chris confirms targeting. */}
        <section aria-labelledby="who-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container>
            <h2 id="who-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Who it is for</h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                'Businesses with repetitive, rules-based work across sales, marketing, research, customer service, or recruiting.',
                'Teams that have tried ChatGPT-style tools and have not turned them into dependable, everyday workflows.',
                'Leaders who want measurable output and control, including approvals and an audit trail.',
              ].map((item) => (
                <li key={item} className="rounded-2xl border border-white/[0.08] bg-[#111111] p-5 text-sm leading-relaxed text-[#C8C8C8] sm:text-base">
                  {item}
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="problems-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container>
            <h2 id="problems-title" className="max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">Problems we solve</h2>
            <ul className="mt-8 grid gap-4 md:grid-cols-2">
              {problems.map((item) => (
                <li key={item} className="rounded-2xl border border-white/[0.08] p-5 text-sm leading-relaxed text-[#C8C8C8] sm:text-base">
                  {item}
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
          </Container>
        </section>

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

        {/* TODO(chris): The anonymized seven-agent sales-team proof line is omitted until Chris approves it. */}
        <section aria-labelledby="examples-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container>
            <h2 id="examples-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Examples of what we can build</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#C8C8C8]">
              Examples, not fixed packages.
            </p>
            <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {departments.map((item) => (
                <li key={item.title} className="rounded-2xl border border-white/[0.08] p-5">
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#C8C8C8]">{item.body}</p>
                </li>
              ))}
            </ul>
          </Container>
        </section>

        <section aria-labelledby="engagement-title" className="border-b border-white/[0.08] py-16 sm:py-24">
          <Container className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 id="engagement-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">How an engagement works</h2>
              <ul className="mt-6 space-y-4 text-sm leading-relaxed text-[#C8C8C8] sm:text-base">
                <li>Start with a discovery conversation and assessment.</li>
                <li>We propose an architecture and scope, with a clear split of one-time build and ongoing management.</li>
                <li>Build, test, and launch in phases, with your approval at each step.</li>
                <li>Your team approves anything consequential: outbound messages, data changes, deletions, and financial actions.</li>
                <li>Your data stays yours. Each client runs in its own isolated setup, accounts, and knowledge base, never mixed with other clients&apos;.</li>
                <li>Ongoing monthly management and optimization after launch. Add departments as value is shown.</li>
              </ul>
            </div>
            <div className="rounded-3xl border border-brand/40 bg-black p-6 sm:p-8">
              {/* TODO(chris): Pricing is not approved for publication. No dollar figures. Interim wording only. */}
              <h2 className="text-2xl font-bold tracking-tight text-white">Pricing</h2>
              <p className="mt-4 text-base leading-relaxed text-[#C8C8C8]">
                Scoped after discovery: one-time build plus monthly management.
              </p>
              <div className="mt-8">
                <DiscoveryLink />
              </div>
            </div>
          </Container>
        </section>

        {/* TODO(chris): Cross-link to the AI Visibility Assessment is included pending a decision on cross-sell. */}
        <section aria-labelledby="start-title" className="py-16 sm:py-24">
          <Container>
            <div className="rounded-3xl border border-white/[0.08] bg-[#111111] px-6 py-10 sm:px-10">
              <h2 id="start-title" className="text-3xl font-bold tracking-tight text-white">Not sure where to start?</h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#C8C8C8]">
                Begin with an <Link href="/ai-visibility" className="font-semibold text-white underline decoration-brand/70 underline-offset-4">AI Visibility Assessment</Link>. It is a low-cost starting point: 100+ real AI searches, research into the website, listings and competitors, and a 14-page report with the Orange Score and a step-by-step fix plan.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/get-your-orange-score" className="inline-flex h-12 w-full items-center justify-center rounded-full bg-brand px-6 text-[15px] font-semibold text-black hover:bg-brand-light sm:w-auto">
                  Get Your Orange Score
                </Link>
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
