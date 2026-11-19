import { ArrowUpRight, Check, Minus, Lock } from 'lucide-react'
import { PlatformLabel } from './platform-wordmark'
import { OrangeScoreRing } from './orange-score-ring'
import { platformResults, queryResults, sampleBusiness, scoreDimensions } from '@/lib/sample-data'
import { cn } from '@/lib/utils'

export function DashboardPreview() {
  return (
    <div className="card-surface overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
          <span className="size-2.5 rounded-full bg-white/15" />
        </div>
        <div className="mx-auto flex min-w-0 items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1 font-mono text-[11px] text-muted-foreground">
          <Lock className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">app.getorangerank.com/reports/northline-pt</span>
        </div>
        <span className="hidden w-12 sm:block" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              AI Visibility Audit
            </p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              {sampleBusiness.name}
            </p>
            <p className="text-sm text-muted-foreground">
              {sampleBusiness.category} · {sampleBusiness.location}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="rounded-md border border-white/[0.08] px-2 py-1">
              {sampleBusiness.checksBreadth}
            </span>
            <span className="rounded-md border border-white/[0.08] px-2 py-1">
              Five AI platforms
            </span>
            <span className="rounded-md border border-white/[0.08] px-2 py-1">{sampleBusiness.auditDate}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 [&>*]:min-w-0">
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-white/[0.07] bg-black/20 p-5 sm:flex-row lg:col-span-5 lg:flex-col lg:justify-center lg:gap-6">
            <div className="w-full max-w-[220px] sm:max-w-[200px] lg:max-w-[270px]">
              <OrangeScoreRing value={sampleBusiness.score} />
            </div>
            <dl className="grid w-full grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/[0.03] p-3">
                <dt className="text-xs text-muted-foreground">Category benchmark</dt>
                <dd className="mt-1 text-lg font-semibold text-foreground">{sampleBusiness.previousBenchmark}</dd>
              </div>
              <div className="rounded-lg bg-white/[0.03] p-3">
                <dt className="text-xs text-muted-foreground">vs. benchmark</dt>
                <dd className="mt-1 flex items-center gap-1 text-lg font-semibold text-success">
                  <ArrowUpRight className="size-4" aria-hidden="true" />+
                  {sampleBusiness.score - sampleBusiness.previousBenchmark}
                </dd>
              </div>
              <div className="col-span-2 rounded-lg bg-white/[0.03] p-3">
                <dt className="text-xs text-muted-foreground">Local competitive rank</dt>
                <dd className="mt-1 text-sm text-foreground">
                  <span className="text-lg font-semibold">#3</span>
                  <span className="text-muted-foreground"> of 5 tracked clinics</span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col gap-4 lg:col-span-7">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {scoreDimensions.map((d, i) => (
                <div
                  key={d.label}
                  className={cn(
                    'rounded-lg border border-white/[0.07] bg-black/20 p-3',
                    i === 4 && 'col-span-2 sm:col-span-1',
                  )}
                >
                  <p className="truncate text-[11px] text-muted-foreground">{d.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{d.value}</p>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${d.value}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Mention rate by platform</p>
                <p className="font-mono text-[11px] text-muted-foreground">% of prompts</p>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews. Sample results shown where available.</p>
              <ul className="mt-4 flex flex-col gap-3">
                {platformResults.map((p) => (
                  <li key={p.name} className="grid grid-cols-[80px_1fr_36px] items-center gap-3 text-sm">
                    <span><PlatformLabel name={p.name} /></span>
                    <span className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                      <span
                        className="block h-full rounded-full bg-gradient-to-r from-brand to-brand-light"
                        style={{ width: `${p.mentionRate}%` }}
                      />
                    </span>
                    <span className="text-right font-mono text-xs tabular-nums text-foreground">{p.mentionRate}%</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/[0.07] bg-black/20">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                <p className="text-sm font-medium text-foreground">Prompt results</p>
                <p className="font-mono text-[11px] text-muted-foreground">Sample prompts</p>
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {queryResults.slice(0, 4).map((q) => (
                  <li key={q.prompt} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span
                      className={cn(
                        'flex size-5 shrink-0 items-center justify-center rounded-full',
                        q.mentioned ? 'bg-brand-soft text-brand' : 'bg-white/[0.05] text-muted-foreground',
                      )}
                    >
                      {q.mentioned ? <Check className="size-3" /> : <Minus className="size-3" />}
                      <span className="sr-only">{q.mentioned ? 'Mentioned' : 'Not mentioned'}</span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-foreground/90">{q.prompt}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {q.position ? `#${q.position}` : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
