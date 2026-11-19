import { ArrowRight, Check, Lock } from 'lucide-react'
import { CtaLink } from './cta-link'
import { Container } from './section-heading'

const chips = ['Who AI recommends instead of you', 'Why it picks them', 'Your step-by-step fix plan']

const reportPages = [
  { label: 'Your fix plan', className: 'right-0 top-0 z-0 bg-[#121212]' },
  { label: 'Why they win', className: 'right-[3%] top-[30px] z-[1] bg-[#151515]' },
  { label: 'Who AI recommends', className: 'right-[6%] top-[60px] z-[2] bg-[#191919]' },
]

const toc = ['Orange Score', 'Who AI recommends', 'Why they win', 'Your fix plan']

const exampleRows = [
  { rank: '1', name: 'Competitor A', tag: 'Named' },
  { rank: '2', name: 'Competitor B', tag: 'Named' },
  { rank: '3', name: 'Competitor C', tag: 'Named' },
]

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-48 size-[700px] rounded-full bg-[radial-gradient(circle,rgb(254_109_0/0.18),transparent_65%)]"
      />

      <Container className="relative pb-16 pt-12 sm:pb-20 sm:pt-16 lg:pt-16">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)] lg:gap-12">
          <div className="min-w-0">
            <p className="inline-flex rounded-full border border-brand/30 bg-brand/[0.08] px-3 py-1.5 text-[13px] text-brand-light">
              AI visibility audit for local businesses
            </p>

            <h1
              id="hero-title"
              className="mt-6 text-balance text-[2rem] font-bold leading-[1.07] tracking-[-0.035em] text-foreground sm:text-[2.875rem]"
            >
              ChatGPT, Gemini, Claude and Perplexity are recommending your competitors.{' '}
              <span className="text-brand">Find out why.</span>
            </h1>

            <p className="mt-5 max-w-[540px] text-[15.5px] leading-[1.65] text-[#A1A1A1] sm:text-[17px]">
              <strong className="font-bold text-brand">We start with over 100 AI searches</strong> across ChatGPT,
              Gemini, Claude, Perplexity and Google AI Overviews. Then we research your website, listings and
              competitors to find out why AI recommends them instead of you. You get a 14-page report with your Orange
              Score, who&apos;s beating you and why, and a step-by-step plan to fix it.
            </p>

            <p className="mt-6 text-[15px] font-semibold text-foreground">
              <span className="text-brand">$149</span> · 14-page report · Delivered in 48 hours
            </p>

            <div className="mt-6 flex flex-col items-stretch gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6">
              <CtaLink href="/get-your-orange-score" size="lg" className="w-full sm:w-auto">
                Get Your Orange Score
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </CtaLink>
              <a
                href="#sample"
                className="self-start border-b border-white/30 pb-0.5 text-[15px] font-medium text-foreground hover:border-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
              >
                See a sample report
              </a>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <li
                  key={chip}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#2D2D2D] bg-[#161616] py-1.5 pl-2.5 pr-3 text-[13px] font-medium text-[#E5E5E5]"
                >
                  <Check className="size-3.5 text-brand" strokeWidth={3} aria-hidden="true" />
                  {chip}
                </li>
              ))}
            </ul>

            <ul className="mt-4 flex flex-col gap-2 text-[13px] text-[#8A8A8A] sm:flex-row sm:flex-wrap sm:gap-x-6 sm:gap-y-2">
              <li className="flex items-start gap-1.5 sm:items-center">
                <Check className="mt-0.5 size-3.5 shrink-0 text-brand sm:mt-0" strokeWidth={3} aria-hidden="true" />
                <span>Checks ChatGPT, Gemini, Claude, Perplexity &amp; Google AI Overviews</span>
              </li>
              <li className="flex items-center gap-1.5">
                <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                <span>Secure checkout</span>
              </li>
            </ul>
          </div>

          <HeroVisual />
        </div>
      </Container>
    </section>
  )
}

function HeroVisual() {
  return (
    <div className="relative lg:h-[760px]" aria-hidden="true">
      <div className="relative mx-auto h-[430px] w-full max-w-[330px] lg:absolute lg:right-0 lg:top-0 lg:mx-0">
        {reportPages.map((page) => (
          <div
            key={page.label}
            className={`absolute h-[340px] w-[88%] rounded-[14px] border border-[#2D2D2D] shadow-[0_20px_50px_rgba(0,0,0,0.5)] ${page.className}`}
          >
            <p className="absolute left-4 top-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#FE7F04]">
              {page.label}
            </p>
          </div>
        ))}

        <div className="absolute right-[9%] top-[90px] z-[3] h-[340px] w-[88%] rounded-[14px] bg-[#F7F4EF] p-4 text-[#141414] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.08em]">
            <span className="text-[#FE6D00]">Sample report · Illustrative</span>
            <span className="text-[#777]">14 pages</span>
          </div>
          <p className="mt-4 text-[22px] font-bold tracking-[-0.02em]">Orange Score</p>
          <div className="mt-3.5 flex items-center gap-4">
            <div className="grid size-[60px] shrink-0 place-items-center rounded-full bg-[conic-gradient(#FE6D00_0_62%,#E4DED5_0)]">
              <span className="grid size-11 place-items-center rounded-full bg-[#F7F4EF] text-sm font-bold text-[#999]">
                –
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="mb-2 block h-[7px] w-[90%] rounded bg-[#E4DED5]" />
              <span className="mb-2 block h-[7px] w-[70%] rounded bg-[#E4DED5]" />
              <span className="block h-[7px] w-[80%] rounded bg-[#E4DED5]" />
            </div>
          </div>
          <div className="mt-3.5 border-t border-[#E4DED5]">
            {toc.map((item, index) => (
              <div key={item} className="border-b border-[#EEE8E0] py-2 text-[13px] font-medium">
                <span className="mr-2.5 text-[11px] font-bold text-brand">{String(index + 1).padStart(2, '0')}</span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-6 w-full max-w-[420px] rounded-[18px] border border-[#2D2D2D] bg-[#141414] p-4 shadow-[0_30px_80px_rgba(0,0,0,0.5)] lg:absolute lg:left-0 lg:top-[390px] lg:mt-0 lg:w-[300px] lg:max-w-none">
        <div className="mb-2.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em]">
          <span className="text-brand-light">Example AI answer</span>
          <span className="text-[#6A6A6A]">Illustrative</span>
        </div>
        <p className="mb-2.5 rounded-xl bg-[#1E1E1E] px-3 py-2.5 text-[13px] text-foreground">
          <span className="mb-1 block text-[11px] font-medium text-[#8A8A8A]">Prompt</span>
          &ldquo;Best HVAC company in St. Louis?&rdquo;
        </p>
        <ul className="space-y-1.5">
          {exampleRows.map((row) => (
            <li
              key={row.name}
              className="flex items-center gap-2.5 rounded-[10px] border border-[#262626] px-2.5 py-1.5 text-[13px]"
            >
              <span className="grid size-[22px] place-items-center rounded-md bg-[#262626] text-xs text-[#A1A1A1]">
                {row.rank}
              </span>
              <span>{row.name}</span>
              <span className="ml-auto text-[11px] text-[#6EE7A0]">{row.tag}</span>
            </li>
          ))}
          <li className="flex items-center gap-2.5 rounded-[10px] border border-dashed border-brand/55 bg-brand/[0.07] px-2.5 py-1.5 text-[13px] font-semibold text-brand-light">
            <span className="grid size-[22px] place-items-center rounded-md bg-brand/20 text-xs text-brand">✕</span>
            <span>Your business</span>
            <span className="ml-auto text-[11px] font-semibold text-brand">Not mentioned</span>
          </li>
        </ul>
        <p className="mt-3 text-[11px] text-[#6A6A6A]">Placeholder names, not real results.</p>
      </div>
    </div>
  )
}
