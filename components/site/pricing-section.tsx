import { ArrowRight, Check } from 'lucide-react'
import { Container, SectionHeading } from './section-heading'
import { CtaLink } from './cta-link'
import { LogoMark } from './logo'

const included = [
  'Orange Score with 5-signal breakdown',
  'Hundreds of AI visibility checks',
  'Benchmark against up to 4 competitors',
  'Visibility gap analysis with point impact',
  'Verbatim AI evidence with cited sources',
  'Factual accuracy check on core business data',
  'Prioritized 30/60/90 day action plan',
  'PDF + interactive online report',
]

export function PricingSection() {
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="pricing-title"
          eyebrow="Pricing"
          align="center"
          title="One audit. One price. No subscription."
          description="Everything you need to understand and improve how AI represents your business."
        />

        <div className="relative mx-auto mt-14 max-w-4xl">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-px rounded-3xl bg-gradient-to-b from-brand/50 via-brand/10 to-transparent"
          />
          <div className="relative grid overflow-hidden rounded-3xl bg-surface md:grid-cols-2">
            <div className="flex flex-col border-b border-border p-7 sm:p-10 md:border-b-0 md:border-r">
              <div className="flex items-center gap-3">
                <LogoMark className="size-9" />
                <div>
                  <h3 className="font-semibold text-foreground">OrangeRank AI Visibility Audit</h3>
                  <p className="text-sm text-muted-foreground">For a single business or location</p>
                </div>
              </div>

              <p className="mt-10 flex items-baseline gap-2">
                <span className="text-6xl font-bold tracking-tighter text-foreground">$149</span>
                <span className="text-sm text-muted-foreground">one-time</span>
              </p>
              <p className="mt-3 text-sm font-medium text-foreground">One audit. One price. No subscription.</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Delivered within 48 hours. Includes a 30-minute walkthrough of your results on request.
              </p>

              <div className="mt-auto pt-10">
                <CtaLink href="/get-your-orange-score" size="lg" className="w-full">
                  Get Your Orange Score
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </CtaLink>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Secure checkout
                </p>
              </div>
            </div>

            <div className="p-7 sm:p-10">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Everything included
              </p>
              <ul className="mt-6 flex flex-col gap-3.5">
                {included.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-foreground/90">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                      <Check className="size-2.5" strokeWidth={3} aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
