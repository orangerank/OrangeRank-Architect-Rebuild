import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { SiteHeader } from '@/components/site/site-header'
import { SiteFooter } from '@/components/site/site-footer'
import { CtaLink } from '@/components/site/cta-link'
import { Container } from '@/components/site/section-heading'

export const metadata: Metadata = {
  title: 'OrangeRank — Puts AI to work for your business.',
  description:
    'OrangeRank has two separate practices. Local businesses get found by customers through an AI Visibility Assessment. Companies that sell to other businesses get a 7-agent AI sales team.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section aria-labelledby="home-title" className="border-b border-white/[0.08] bg-black">
          <Container className="py-16 sm:py-20">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">OrangeRank</p>
            <h1 id="home-title" className="mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
              OrangeRank puts AI to work for your business.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#C8C8C8]">
              Two separate practices, for two different buyers. Local businesses use OrangeRank to get found by customers. Companies that sell to other businesses use it to build pipeline.
            </p>
          </Container>
        </section>

        <section aria-label="Offerings" className="bg-black py-12 sm:py-16">
          <Container>
            <div className="grid items-stretch gap-6 lg:grid-cols-2">
              <article className="flex h-full flex-col rounded-3xl border border-white/[0.12] bg-black p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Local businesses</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Get found by customers</h2>
                <p className="mt-4 text-base leading-relaxed text-[#C8C8C8]">
                  For local, consumer-facing businesses that want customers to find them through AI. The AI Visibility Assessment runs 100+ real AI searches, then researches the website, listings and competitors. You get a 14-page report with your Orange Score and a step-by-step fix plan.
                </p>
                <p className="mt-4 text-sm font-semibold text-white">
                  <span className="text-brand">$149</span> · one-time · secure checkout
                </p>
                <div className="mt-auto flex flex-col gap-3 pt-8">
                  <CtaLink href="/get-your-orange-score" size="lg" className="w-full">
                    Get Your Orange Score
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </CtaLink>
                  <Link href="/ai-visibility" className="inline-flex h-10 items-center justify-center text-sm font-semibold text-white underline decoration-brand/70 underline-offset-4 hover:decoration-brand">
                    See the assessment
                  </Link>
                </div>
              </article>

              <article className="flex h-full flex-col rounded-3xl border border-white/[0.12] bg-black p-6 sm:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">B2B companies</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight text-white">Get more B2B deals</h2>
                <p className="mt-4 text-base leading-relaxed text-[#C8C8C8]">
                  For companies that sell to other businesses and need more pipeline. A 7-agent AI sales team finds, qualifies and pitches prospects, with your approval on every send.
                </p>
                <p className="mt-4 text-sm font-semibold text-white">AI Workforce Systems</p>
                <div className="mt-auto flex flex-col gap-3 pt-8">
                  <a
                    href="mailto:hello@getorangerank.com"
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-semibold text-black hover:bg-brand-light"
                  >
                    Book a discovery call
                  </a>
                  <Link href="/ai-workforce-systems" className="inline-flex h-10 items-center justify-center text-sm font-semibold text-white underline decoration-brand/70 underline-offset-4 hover:decoration-brand">
                    See AI Workforce Systems
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
