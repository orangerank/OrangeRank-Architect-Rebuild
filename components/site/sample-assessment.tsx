'use client'

import { useState } from 'react'
import { Check, Download, Minus, X } from 'lucide-react'
import { Container, SectionHeading } from './section-heading'
import { OrangeScoreRing } from './orange-score-ring'
import { platformResults, queryResults, sampleBusiness, scoreDimensions } from '@/lib/sample-data'
import { PlatformLabel } from './platform-wordmark'
import { cn } from '@/lib/utils'

const tabs = ['Summary', 'Platforms', 'Prompts', 'Accuracy'] as const
type Tab = (typeof tabs)[number]

const accuracyChecks = [
  { field: 'Business name', status: 'correct', note: 'Consistent across sampled platforms' },
  { field: 'Address', status: 'correct', note: '1840 S Downing St, Denver, CO 80210' },
  { field: 'Hours of operation', status: 'incorrect', note: 'Perplexity reports closed Saturdays' },
  { field: 'Services offered', status: 'partial', note: 'ACL rehab and vestibular therapy rarely mentioned' },
  { field: 'Insurance accepted', status: 'incorrect', note: 'AI says “unknown” or lists only self-pay' },
  { field: 'Phone number', status: 'correct', note: 'Matches Google Business Profile' },
] as const

export function SampleAssessment() {
  const [tab, setTab] = useState<Tab>('Summary')

  return (
    <section id="sample" aria-labelledby="sample-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            id="sample-title"
            eyebrow="Sample assessment"
            title="What your report actually looks like."
            description="An abridged view of a real-format OrangeRank assessment for a Denver physical therapy clinic."
          />
        </div>

        <div className="card-surface mt-12 overflow-hidden rounded-3xl">
          <div className="grid lg:grid-cols-[300px_1fr]">
            <aside className="flex flex-col gap-6 border-b border-white/[0.06] bg-black/20 p-6 sm:p-8 lg:border-b-0 lg:border-r">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Report #OR-2609-0417</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-foreground">{sampleBusiness.name}</p>
                <p className="text-sm text-muted-foreground">{sampleBusiness.domain}</p>
              </div>
              <div className="mx-auto w-full max-w-[200px]">
                <OrangeScoreRing value={sampleBusiness.score} sublabel="Competitive" showTicks={false} />
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Audit date</dt>
                <dd className="text-right text-foreground">{sampleBusiness.auditDate}</dd>
                <dt className="text-muted-foreground">Checks</dt>
                <dd className="text-right text-foreground">{sampleBusiness.checksBreadth}</dd>
                <dt className="text-muted-foreground">Platforms</dt>
                <dd className="text-right text-foreground">{sampleBusiness.platformsTested}</dd>
                <dt className="text-muted-foreground">Competitors</dt>
                <dd className="text-right text-foreground">4</dd>
              </dl>
              <span className="mt-auto inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground">
                <Download className="size-4" aria-hidden="true" /> PDF + interactive report
              </span>
            </aside>

            <div className="min-w-0">
              <div
                role="tablist"
                aria-label="Report sections"
                className="flex gap-1 overflow-x-auto border-b border-white/[0.06] px-4 pt-4 sm:px-8"
              >
                {tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    id={`tab-${t}`}
                    aria-selected={tab === t}
                    aria-controls={`panel-${t}`}
                    onClick={() => setTab(t)}
                    className={cn(
                      '-mb-px shrink-0 border-b-2 px-3 pb-3 pt-1 text-sm transition-colors focus-visible:outline-none focus-visible:text-foreground',
                      tab === t
                        ? 'border-brand font-medium text-foreground'
                        : 'border-transparent text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5 sm:p-8">
                {tab === 'Summary' && <SummaryPanel />}
                {tab === 'Platforms' && <PlatformsPanel />}
                {tab === 'Prompts' && <PromptsPanel />}
                {tab === 'Accuracy' && <AccuracyPanel />}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}

function SummaryPanel() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-base font-semibold text-foreground">Executive summary</h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Northline is well-regarded when AI does mention it — sentiment and factual accuracy are above category average.
          The core problem is reach: it is absent from most sports-injury and insurance-related prompts, where Summit
          Sports Rehab and Peak Motion PT dominate. Closing four specific gaps could lift the Orange Score from 62 to
          an estimated 84.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { k: 'Strongest signal', v: 'Accuracy', s: '81 / 100' },
          { k: 'Weakest signal', v: 'Citation Share', s: '44 / 100' },
          { k: 'Best platform', v: 'Gemini', s: '71% mention rate' },
        ].map((c) => (
          <div key={c.k} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
            <p className="text-xs text-muted-foreground">{c.k}</p>
            <p className="mt-1 font-semibold text-foreground">{c.v}</p>
            <p className="font-mono text-xs text-brand">{c.s}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground">Score breakdown</h3>
        <ul className="mt-4 flex flex-col gap-4">
          {scoreDimensions.map((d) => (
            <li key={d.label} className="grid grid-cols-[110px_1fr_40px] items-center gap-4 text-sm sm:grid-cols-[140px_1fr_48px]">
              <span className="text-foreground/85">{d.label}</span>
              <span className="relative h-2 rounded-full bg-white/[0.06]">
                <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${d.value}%` }} />
                <span
                  className="absolute -top-1 h-4 w-px bg-white/40"
                  style={{ left: '60%' }}
                  aria-hidden="true"
                />
              </span>
              <span className="text-right font-mono tabular-nums text-foreground">{d.value}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Marker indicates category average (60).</p>
      </div>
    </div>
  )
}

function PlatformsPanel() {
  return (
    <div className="overflow-x-auto">
      <h3 className="mb-4 text-sm font-medium text-foreground">AI platforms</h3>
      <p className="mb-4 text-xs text-muted-foreground">ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews. Sample results shown where available.</p>
      <table className="w-full min-w-[480px] text-left text-sm">
        <caption className="sr-only">Results by AI platform</caption>
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-white/[0.06]">
            <th scope="col" className="pb-3 font-medium">Platform</th>
            <th scope="col" className="pb-3 font-medium">Mention rate</th>
            <th scope="col" className="pb-3 text-right font-medium">Avg. position</th>
            <th scope="col" className="pb-3 text-right font-medium">Accuracy</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {platformResults.map((p) => (
            <tr key={p.name}>
              <th scope="row" className="py-4 font-medium text-foreground"><PlatformLabel name={p.name} /></th>
              <td className="py-4">
                <span className="flex items-center gap-3">
                  <span className="h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full bg-brand" style={{ width: `${p.mentionRate}%` }} />
                  </span>
                  <span className="font-mono tabular-nums text-foreground">{p.mentionRate}%</span>
                </span>
              </td>
              <td className="py-4 text-right font-mono tabular-nums text-foreground">
                {p.avgPosition ? `#${p.avgPosition.toFixed(1)}` : '—'}
              </td>
              <td className="py-4 text-right font-mono tabular-nums text-foreground">{p.accuracy}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PromptsPanel() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <caption className="sr-only">Sample prompt results</caption>
        <thead className="text-xs text-muted-foreground">
          <tr className="border-b border-white/[0.06]">
            <th scope="col" className="pb-3 font-medium">Prompt</th>
            <th scope="col" className="pb-3 font-medium">Intent</th>
            <th scope="col" className="pb-3 text-center font-medium">You</th>
            <th scope="col" className="pb-3 font-medium">Top recommendation</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.05]">
          {queryResults.map((q) => (
            <tr key={q.prompt}>
              <th scope="row" className="max-w-[260px] py-3.5 pr-4 font-normal text-foreground">{q.prompt}</th>
              <td className="py-3.5 pr-4">
                <span className="rounded-md border border-white/[0.08] px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {q.intent}
                </span>
              </td>
              <td className="py-3.5 pr-4 text-center font-mono text-xs">
                {q.mentioned ? (
                  <span className="text-brand">#{q.position}</span>
                ) : (
                  <span className="text-muted-foreground">Absent</span>
                )}
              </td>
              <td
                className={cn(
                  'py-3.5',
                  q.leader === sampleBusiness.name ? 'text-brand' : 'text-foreground/80',
                )}
              >
                {q.leader}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-xs text-muted-foreground">Selected sample prompts. Hundreds of AI visibility checks inform each assessment.</p>
    </div>
  )
}

function AccuracyPanel() {
  return (
    <ul className="flex flex-col divide-y divide-white/[0.05]">
      {accuracyChecks.map((c) => (
        <li key={c.field} className="flex items-start gap-4 py-4 first:pt-0">
          <span
            className={cn(
              'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
              c.status === 'correct' && 'bg-[oklch(0.74_0.15_155/0.12)] text-success',
              c.status === 'partial' && 'bg-[oklch(0.82_0.15_85/0.12)] text-warning',
              c.status === 'incorrect' && 'bg-[oklch(0.66_0.2_25/0.14)] text-destructive',
            )}
          >
            {c.status === 'correct' && <Check className="size-3.5" aria-hidden="true" />}
            {c.status === 'partial' && <Minus className="size-3.5" aria-hidden="true" />}
            {c.status === 'incorrect' && <X className="size-3.5" aria-hidden="true" />}
            <span className="sr-only">{c.status}</span>
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{c.field}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{c.note}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
