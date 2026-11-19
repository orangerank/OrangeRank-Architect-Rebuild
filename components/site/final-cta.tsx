import { ArrowRight } from 'lucide-react'
import { Container } from './section-heading'
import { CtaLink } from './cta-link'
import { LogoMark } from './logo'

export function FinalCta() {
  return (
    <section id="get-started" aria-labelledby="final-cta-title" className="py-24 sm:py-32">
      <Container>
        <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-surface px-6 py-16 text-center sm:px-12 sm:py-24">
          <div
            aria-hidden="true"
            className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_60%_70%_at_50%_100%,black,transparent)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[-220px] left-1/2 h-[440px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(254_109_0/0.28),transparent)]"
          />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center">
            <LogoMark className="size-12" />
            <h2
              id="final-cta-title"
              className="mt-8 text-balance text-3xl font-bold tracking-tight text-foreground sm:text-5xl"
            >
              AI is deciding who gets recommended. <span className="text-brand">Be the business AI recommends.</span>
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              Get your Orange Score, see who AI recommends instead of you, and walk away with a prioritized plan to
              close the gap.
            </p>
            <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
              <CtaLink href="/get-your-orange-score" size="lg" className="w-full sm:w-auto">
                Get Your Orange Score
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </CtaLink>
              <CtaLink href="#sample" variant="secondary" size="lg" className="w-full sm:w-auto">
                See a Sample Assessment
              </CtaLink>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
