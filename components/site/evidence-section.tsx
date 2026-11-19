import { Link2, Quote } from 'lucide-react'
import { PlatformLabel } from './platform-wordmark'
import { Container, SectionHeading } from './section-heading'
import { evidenceItems, type EvidenceItem } from '@/lib/sample-data'
import { cn } from '@/lib/utils'

const verdictStyles: Record<EvidenceItem['verdict'], string> = {
  Recommended: 'bg-[oklch(0.74_0.15_155/0.12)] text-success',
  'Not mentioned': 'bg-white/[0.06] text-muted-foreground',
  Inaccurate: 'bg-[oklch(0.66_0.2_25/0.14)] text-destructive',
}

const highlightStyles = {
  you: 'rounded bg-brand-soft px-1 text-brand',
  competitor: 'rounded bg-white/[0.08] px-1 text-foreground',
  error: 'rounded bg-[oklch(0.66_0.2_25/0.14)] px-1 text-destructive underline decoration-dotted underline-offset-4',
}

export function EvidenceSection() {
  return (
    <section aria-labelledby="evidence-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <SectionHeading
          id="evidence-title"
          eyebrow="AI evidence"
          title="Receipts, not guesses."
          description="Every finding is backed by the actual prompt, the AI's verbatim response, a timestamp and the sources it cited — so you can see the problem for yourself."
        />

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-brand" aria-hidden="true" /> Your business
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-white/40" aria-hidden="true" /> Competitor
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-sm bg-destructive" aria-hidden="true" /> Inaccuracy
          </span>
        </div>

        <ul className="mt-12 grid gap-4 lg:grid-cols-3">
          {evidenceItems.map((item) => (
            <li key={item.prompt} className="card-surface flex flex-col rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <span className="text-sm font-medium"><PlatformLabel name={item.platform} /></span>
                <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', verdictStyles[item.verdict])}>
                  {item.verdict}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-4 p-5">
                <div className="rounded-xl bg-white/[0.03] px-4 py-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Prompt</p>
                  <p className="mt-1.5 text-sm text-foreground">{item.prompt}</p>
                </div>

                <div className="flex gap-3">
                  <Quote className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {item.response.map((seg, i) =>
                      seg.highlight ? (
                        <mark key={i} className={cn('bg-transparent', highlightStyles[seg.highlight])}>
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                </div>
              </div>

              <div className="border-t border-white/[0.06] px-5 py-4">
                <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Link2 className="size-3" aria-hidden="true" /> Cited sources
                </p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {item.sources.map((s) => (
                    <li
                      key={s}
                      className="rounded-md border border-white/[0.07] px-2 py-0.5 font-mono text-[11px] text-foreground/75"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 font-mono text-[10px] text-muted-foreground">Captured {item.capturedAt}</p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
