import { Building2, MessageSquareText, Gauge, FileCheck2 } from 'lucide-react'
import { Container, SectionHeading } from './section-heading'

const steps = [
  {
    icon: Building2,
    title: 'Tell us about your business',
    body: 'Share your website, location, core services and up to four competitors. Takes about three minutes.',
    meta: 'Step 01',
  },
  {
    icon: MessageSquareText,
    title: 'We query AI like your customers do',
    body: 'Hundreds of AI visibility checks across ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews.',
    meta: 'Step 02',
  },
  {
    icon: Gauge,
    title: 'Every answer is scored',
    body: 'Responses are analyzed for presence, ranking, accuracy, sentiment and cited sources to produce your Orange Score.',
    meta: 'Step 03',
  },
  {
    icon: FileCheck2,
    title: 'You get a clear action plan',
    body: 'A full report with evidence, competitor benchmarks, visibility gaps and a prioritized 30/60/90 day roadmap.',
    meta: 'Step 04',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="how-title"
          eyebrow="How OrangeRank works"
          title="From blind spot to benchmark in four steps."
          description="No software to install and no ongoing contract. We do the testing, the analysis and the prioritization — you get the answers."
        />

        <ol className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <li key={step.title} className="card-surface relative flex flex-col rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl border border-brand/25 bg-brand-soft text-brand">
                  <step.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {step.meta}
                </span>
              </div>
              <h3 className="mt-8 text-lg font-semibold tracking-tight text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              {i < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute -right-[13px] top-11 hidden h-px w-[10px] bg-white/15 lg:block"
                />
              )}
            </li>
          ))}
        </ol>
      </Container>
    </section>
  )
}
