import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { CtaLink } from '@/components/site/cta-link'
import { Container } from '@/components/site/section-heading'

export const metadata: Metadata = {
  title: 'OrangeRank — Be the business AI recommends.',
  description:
    'OrangeRank offers an AI Visibility Assessment and AI Workforce Systems. See how ChatGPT, Gemini, Claude and Perplexity recommend your business, or put a checked AI team to work inside it.',
  alternates: { canonical: '/' },
}

const assistants = 'ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews'

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section aria-labelledby="home-title" className="border-b border-white/[0.08] bg-black">
          <Container className="py-16 sm:py-24">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">OrangeRank</p>
            <h1 id="home-title" className="mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Be the business AI recommends.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#C8C8C8]">
              Two ways to work with OrangeRank. Find out how AI recommends businesses like yours, or put specialized AI agents to work on the repetitive jobs inside the business.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <CtaLink href="/get-your-orange-score" size="lg" className="w-full sm:w-auto">
                Get Your Orange Score
                <ArrowRight className="size-4" aria-hidden="true" />
              </CtaLink>
              <CtaLink href="/ai-workforce-systems" variant="secondary" size="lg" className="w-full sm:w-auto">
                AI Workforce Systems
              </CtaLink>
            </div>
          </Container>
        </section>

        <section aria-labelledby="offerings-title" className="bg-black py-16 sm:py-24">
          <Container>
            <h2 id="offerings-title" className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Two offerings. One place to start.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#C8C8C8] sm:text-lg">
              The assessment is the paid starting point available today. AI Workforce Systems is scoped with you after a discovery call.
            </p>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <article className="flex flex-col rounded-3xl border border-brand/50 bg-black p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Available now</p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight text-white">AI Visibility Assessment</h3>
                <p className="mt-4 text-sm leading-relaxed text-[#C8C8C8] sm:text-base">
                  We run 100+ real AI searches, then research the business&apos;s website, listings and competitors. You get a 14-page report with your Orange Score and a step-by-step fix plan.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white">
                  Platforms: {assistants}.
                </p>
                <p className="mt-4 text-sm font-semibold text-white">
                  <span className="text-brand">$149</span> · one-time · secure checkout
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <CtaLink href="/get-your-orange-score" className="w-full sm:w-auto">
                    Get Your Orange Score
                  </CtaLink>
                  <Link href="/ai-visibility" className="inline-flex h-10 items-center justify-center rounded-full px-2 text-sm font-semibold text-white underline decoration-brand/70 underline-offset-4 hover:decoration-brand">
                    See the assessment
                  </Link>
                </div>
              </article>

              <article className="flex flex-col rounded-3xl border border-white/[0.08] bg-[#111111] p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#C8C8C8]">Build and run</p>
                <h3 className="mt-3 text-2xl font-bold tracking-tight text-white">AI Workforce Systems</h3>
                <p className="mt-4 text-sm leading-relaxed text-[#C8C8C8] sm:text-base">
                  We design, build, and run teams of specialized AI agents that do real, repeatable work inside your business, connected to your tools and checked by your people.
                </p>
                <p className="mt-4 text-sm leading-relaxed text-white">
                  Scoped after discovery: one-time build plus monthly management.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="mailto:hello@getorangerank.com"
                    className="inline-flex h-10 w-full items-center justify-center rounded-full border border-white/15 px-5 text-sm font-semibold text-white hover:border-white/30 sm:w-auto"
                  >
                    Book a discovery call
                  </a>
                  <Link href="/ai-workforce-systems" className="inline-flex h-10 items-center justify-center rounded-full px-2 text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white">
                    Read how it works
                  </Link>
                </div>
              </article>
            </div>
          </Container>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
