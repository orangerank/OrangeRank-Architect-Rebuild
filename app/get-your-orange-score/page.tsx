import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/site/logo'
import { IntakeForm } from '@/components/intake/intake-form'
import { prefillFromSearchParams } from '@/components/intake/validation'

export const metadata: Metadata = {
  title: 'Start your AI Visibility Assessment | OrangeRank',
  description: 'Tell OrangeRank about your business to prepare for your AI Visibility Assessment.',
  robots: { index: false, follow: false },
}

export default async function IntakePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const initialValues = prefillFromSearchParams(await searchParams)
  return (
    <>
      <header className="border-b border-white/[0.06] bg-background/75">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8">
          <Link href="/" aria-label="OrangeRank home" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Logo /></Link>
          <Link href="/" className="flex items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft aria-hidden="true" className="size-4" />Back to home</Link>
        </div>
      </header>
      <main id="main-content" className="bg-grid">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand">Your AI Visibility Assessment</p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">Start with your business.<br /><span className="text-gradient-brand">See what AI sees.</span></h1>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">Give us the context behind your business, your services, and where you compete. This is the first step toward your Orange Score.</p>
          </div>
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
            <IntakeForm key={JSON.stringify(initialValues)} initialValues={initialValues} />
            <aside className="card-surface rounded-2xl p-6 lg:sticky lg:top-8" aria-label="Assessment next steps">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand">The path to your score</p>
              <ol className="mt-6 space-y-6 text-sm">
                {['Tell us about your business', 'Secure checkout', 'AI Visibility Assessment'].map((step, i) => <li key={step} className="flex gap-3"><span className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${i === 0 ? 'border-brand bg-brand-soft text-brand' : 'border-border text-muted-foreground'}`}>{i + 1}</span><span className="pt-1">{step}</span></li>)}
              </ol>
              <div className="mt-7 border-t border-border pt-5 text-sm leading-relaxed text-muted-foreground">We save your intake and open secure checkout. Your assessment begins after payment is confirmed, and the finished report is sent to the email on this form.</div>
            </aside>
          </div>
        </div>
      </main>
      <footer className="border-t border-white/[0.06]"><div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 px-5 py-8 sm:flex-row sm:px-6 lg:px-8"><Logo /><p className="text-xs text-muted-foreground">© 2026 OrangeRank. All rights reserved.</p></div></footer>
    </>
  )
}
