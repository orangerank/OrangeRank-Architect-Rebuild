import { AlertTriangle, TrendingUp } from 'lucide-react'
import { Container, SectionHeading } from './section-heading'
import { sampleBusiness, visibilityGaps } from '@/lib/sample-data'
import { cn } from '@/lib/utils'

export function GapSection() {
  const totalLift = visibilityGaps.reduce((sum, g) => sum + g.potentialLift, 0)

  return (
    <section aria-labelledby="gap-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            id="gap-title"
            eyebrow="Visibility gap analysis"
            title="Find the exact gaps holding your score back."
            description="Every gap is tied to the prompts it affects and the score it's costing you, so you can fix what matters first."
          />

          <div className="card-surface flex shrink-0 items-center gap-5 rounded-2xl px-6 py-5">
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-3xl font-semibold tabular-nums text-foreground">{sampleBusiness.score}</p>
            </div>
            <TrendingUp className="size-5 text-brand" aria-hidden="true" />
            <div>
              <p className="text-xs text-muted-foreground">Potential</p>
              <p className="text-3xl font-semibold tabular-nums text-brand">{sampleBusiness.score + totalLift}</p>
            </div>
            <p className="max-w-[120px] border-l border-border pl-5 text-xs leading-snug text-muted-foreground">
              Projected if all four gaps are closed
            </p>
          </div>
        </div>

        <ul className="mt-14 grid gap-4 md:grid-cols-2">
          {visibilityGaps.map((gap) => (
            <li key={gap.title} className="card-surface flex flex-col rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                    gap.impact === 'High'
                      ? 'bg-brand-soft text-brand'
                      : 'bg-[oklch(0.82_0.15_85/0.1)] text-warning',
                  )}
                >
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {gap.impact} impact
                </span>
                <span className="font-mono text-sm tabular-nums text-success">+{gap.potentialLift} pts</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">{gap.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{gap.detail}</p>
              <div className="mt-6 flex items-center gap-3 border-t border-white/[0.06] pt-4">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-white/30"
                    style={{ width: `${(gap.affectedPrompts / 50) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-muted-foreground">{gap.affectedPrompts} prompts affected</span>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
