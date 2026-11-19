import { Container, SectionHeading } from './section-heading'
import { competitors } from '@/lib/sample-data'
import { cn } from '@/lib/utils'

const highlights = [
  { value: '31%', label: 'Leader share of AI voice' },
  { value: '−13', label: 'Points behind category leader' },
  { value: '43', label: 'Prompts where a competitor wins' },
]

export function CompetitorSection() {
  return (
    <section aria-labelledby="competitor-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <div className="grid grid-cols-1 items-start gap-14 lg:grid-cols-12 lg:gap-16 [&>*]:min-w-0">
          <div className="lg:col-span-5 lg:sticky lg:top-28">
            <SectionHeading
              id="competitor-title"
              eyebrow="Competitor visibility analysis"
              title="See who AI recommends instead of you."
              description="We benchmark you against the competitors you name and the ones AI surfaces on its own — so you know exactly whose answers you're losing, and why."
            />
            <dl className="mt-10 grid grid-cols-3 gap-4">
              {highlights.map((h) => (
                <div key={h.label} className="border-l border-border pl-4">
                  <dt className="sr-only">{h.label}</dt>
                  <dd className="text-2xl font-semibold tabular-nums tracking-tight text-foreground sm:text-3xl">
                    {h.value}
                  </dd>
                  <dd className="mt-1 text-xs leading-snug text-muted-foreground">{h.label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="card-surface rounded-2xl p-5 sm:p-7 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">Orange Score vs. local competitors</p>
                <p className="text-xs text-muted-foreground">Physical therapy · Denver, CO</p>
              </div>
              <span className="rounded-md border border-white/[0.08] px-2 py-1 font-mono text-[11px] text-muted-foreground">
                Hundreds of AI visibility checks · Five AI platforms
              </span>
            </div>

            <ul className="mt-8 flex flex-col gap-5">
              {competitors.map((c, i) => (
                <li key={c.name}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
                      <span className={cn('truncate', c.isYou ? 'font-medium text-foreground' : 'text-foreground/80')}>
                        {c.name}
                      </span>
                      {c.isYou && (
                        <span className="shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-brand">
                          You
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 font-mono text-sm tabular-nums text-foreground">{c.score}</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        c.isYou
                          ? 'bg-gradient-to-r from-brand to-brand-light'
                          : 'bg-white/20',
                      )}
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 overflow-x-auto rounded-xl border border-white/[0.07]">
              <table className="w-full min-w-[420px] text-left text-sm">
                <caption className="sr-only">Competitor share of voice and winning prompts</caption>
                <thead className="bg-white/[0.02] text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Business</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Share of voice</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Prompts appeared</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {competitors.map((c) => (
                    <tr key={c.name} className={cn(c.isYou && 'bg-brand-soft')}>
                      <th scope="row" className={cn('px-4 py-2.5 font-normal', c.isYou ? 'text-brand' : 'text-foreground/85')}>
                        {c.name}
                      </th>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{c.shareOfVoice}%</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-foreground">{c.topQueries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
