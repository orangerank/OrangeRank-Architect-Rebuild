import { CheckCircle2 } from 'lucide-react'
import { Container, SectionHeading } from './section-heading'
import { roadmap, sampleBusiness } from '@/lib/sample-data'

export function RoadmapSection() {
  let running = sampleBusiness.score

  return (
    <section aria-labelledby="roadmap-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="roadmap-title"
          eyebrow="30 / 60 / 90 day recommendations"
          title="A prioritized plan, not a pile of findings."
          description="Recommendations are sequenced by impact and effort, with a projected score at every milestone — so your team knows what to do on Monday."
        />

        <ol className="mt-14 grid gap-4 lg:grid-cols-3">
          {roadmap.map((phase) => {
            running += Number(phase.lift)
            return (
              <li key={phase.phase} className="card-surface relative flex flex-col overflow-hidden rounded-2xl p-6 sm:p-7">
                <div className="flex items-start justify-between">
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-semibold tracking-tighter text-foreground">{phase.phase}</span>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">days</span>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm tabular-nums text-success">{phase.lift} pts</p>
                    <p className="text-xs text-muted-foreground">
                      Projected <span className="font-medium text-foreground">{running}</span>
                    </p>
                  </div>
                </div>
                <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-brand">{phase.label}</p>
                <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">{phase.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{phase.focus}</p>
                <ul className="mt-6 flex flex-col gap-3 border-t border-white/[0.06] pt-6">
                  {phase.items.map((item) => (
                    <li key={item} className="flex gap-3 text-sm leading-relaxed text-foreground/85">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ol>
      </Container>
    </section>
  )
}
