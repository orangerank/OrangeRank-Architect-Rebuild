import { Container, SectionHeading } from './section-heading'
import { OrangeScoreRing } from './orange-score-ring'
import { sampleBusiness, scoreDimensions } from '@/lib/sample-data'
import { cn } from '@/lib/utils'

const bands = [
  { range: '0–39', label: 'Invisible', min: 0, max: 39 },
  { range: '40–59', label: 'Emerging', min: 40, max: 59 },
  { range: '60–79', label: 'Competitive', min: 60, max: 79 },
  { range: '80–100', label: 'Leading', min: 80, max: 100 },
]

export function ScoreSection() {
  const score = sampleBusiness.score

  return (
    <section id="orange-score" aria-labelledby="score-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading
              id="score-title"
              eyebrow="AI Visibility Score"
              title={
                <>
                  One number for how AI <span className="text-brand">sees you.</span>
                </>
              }
              description="The Orange Score is a 0–100 measure of your AI visibility, built from five weighted signals. It's designed to be benchmarked, tracked and improved — not just admired."
            />

            <ul className="mt-10 flex flex-col divide-y divide-white/[0.06] border-y border-white/[0.06]">
              {scoreDimensions.map((d) => (
                <li key={d.label} className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 py-4">
                  <p className="font-medium text-foreground">{d.label}</p>
                  <p className="font-mono text-xs text-muted-foreground">{d.weight}% weight</p>
                  <p className="col-span-2 text-sm leading-relaxed text-muted-foreground">{d.description}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="card-surface relative overflow-hidden rounded-3xl p-6 sm:p-10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-2/3 bg-[radial-gradient(ellipse_at_top,rgb(254_109_0/0.12),transparent_70%)]"
            />
            <div className="relative flex flex-col items-center">
              <div className="w-full max-w-[300px] p-2">
                <OrangeScoreRing value={score} sublabel="Competitive" />
              </div>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                {sampleBusiness.name} · sample result
              </p>

              <div className="mt-8 w-full">
                <div className="flex h-2 gap-1" aria-hidden="true">
                  {bands.map((b) => (
                    <span
                      key={b.label}
                      className={cn(
                        'flex-1 rounded-full',
                        score >= b.min && score <= b.max ? 'bg-brand' : 'bg-white/[0.08]',
                      )}
                    />
                  ))}
                </div>
                <ul className="mt-3 grid grid-cols-4 gap-1">
                  {bands.map((b) => {
                    const active = score >= b.min && score <= b.max
                    return (
                      <li key={b.label} className="text-center">
                        <p className={cn('text-xs font-medium', active ? 'text-brand' : 'text-foreground/70')}>
                          {b.label}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground">{b.range}</p>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <div className="mt-8 grid w-full grid-cols-3 gap-3 border-t border-white/[0.06] pt-6 text-center">
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{sampleBusiness.percentile}th</p>
                  <p className="mt-1 text-xs text-muted-foreground">Category percentile</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold tabular-nums text-foreground">{sampleBusiness.platformsTested}</p>
                  <p className="mt-1 text-xs text-muted-foreground">AI platforms</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Hundreds of AI visibility checks</p>
                  <p className="mt-1 text-xs text-muted-foreground">Assessment breadth</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
