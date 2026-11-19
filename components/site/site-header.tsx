'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Logo } from './logo'
import { CtaLink } from './cta-link'

const navItems = [
  { href: '/ai-visibility', label: 'AI Visibility' },
  { href: '/ai-workforce-systems', label: 'AI Workforce Systems' },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-black">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 bg-black px-5 sm:px-6 lg:px-8">
        <Link href="/" aria-label="OrangeRank home" className="rounded-md bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`rounded-full px-3.5 py-2 text-sm font-semibold transition-colors hover:text-white ${active ? 'text-white' : 'text-[#C8C8C8]'}`}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="hidden lg:block">
          <CtaLink href="/get-your-orange-score">Get Your Orange Score</CtaLink>
        </div>

        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-full border border-border text-white lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </div>

      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-white/[0.08] bg-black lg:hidden">
          <ul className="flex flex-col gap-1 px-5 py-4">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-3 text-base font-semibold text-[#C8C8C8] hover:bg-white/[0.04] hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="pt-3">
              <CtaLink href="/get-your-orange-score" className="w-full" size="lg">
                Get Your Orange Score
              </CtaLink>
            </li>
          </ul>
        </nav>
      )}
    </header>
  )
}
