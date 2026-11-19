import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/site/logo'

export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return <>
    <header className="border-b border-white/[0.06] bg-background/75"><div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-6 lg:px-8"><Link href="/" aria-label="OrangeRank home" className="rounded-md focus-visible:ring-2 focus-visible:ring-ring"><Logo /></Link><Link href="/get-your-orange-score" className="rounded-md text-sm text-muted-foreground hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">Back to intake</Link></div></header>
    <main className="mx-auto max-w-3xl px-5 py-12 sm:px-6 sm:py-20">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">OrangeRank</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">{title}</h1>
      <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_p+p]:mt-3 [&_a]:text-brand [&_a]:underline [&_a]:underline-offset-4 [&_strong]:text-foreground">{children}</div>
    </main>
    <footer className="border-t border-white/[0.06]"><div className="mx-auto max-w-6xl px-5 py-8 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-5 sm:flex-row"><Logo /><nav aria-label="Legal" className="flex gap-5 text-sm"><Link href="/terms" className="rounded-md text-muted-foreground hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">Terms</Link><Link href="/privacy" className="rounded-md text-muted-foreground hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">Privacy</Link><a href="mailto:hello@getorangerank.com" className="rounded-md text-muted-foreground hover:text-brand focus-visible:ring-2 focus-visible:ring-ring">Contact</a></nav></div><p className="mt-6 text-xs text-muted-foreground">© 2026 OrangeRank. All rights reserved.</p></div></footer>
  </>
}
