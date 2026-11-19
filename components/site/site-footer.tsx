import Link from 'next/link'
import { Logo } from './logo'
import { Container } from './section-heading'

const columns = [
  {
    title: 'Offerings',
    links: [
      { label: 'AI Visibility Assessment', href: '/ai-visibility' },
      { label: 'Get Your Orange Score', href: '/get-your-orange-score' },
      { label: 'AI Workforce Systems', href: '/ai-workforce-systems' },
      { label: 'Book a discovery call', href: 'mailto:hello@getorangerank.com' },
    ],
  },
  {
    title: 'Assessment',
    links: [
      { label: 'How it works', href: '/ai-visibility#how-it-works' },
      { label: 'Orange Score', href: '/ai-visibility#orange-score' },
      { label: 'Sample assessment', href: '/ai-visibility#sample' },
      { label: 'Pricing', href: '/ai-visibility#pricing' },
      { label: 'FAQ', href: '/ai-visibility#faq' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Contact', href: 'mailto:hello@getorangerank.com' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.08] bg-black">
      <Container className="bg-black py-14">
        <div className="flex flex-col justify-between gap-10 md:flex-row">
          <div className="max-w-xs bg-black">
            <Link href="/" aria-label="OrangeRank home" className="inline-flex rounded-md bg-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Logo withTagline />
            </Link>
            <p className="mt-5 text-sm leading-relaxed text-[#C8C8C8]">
              Two separate practices: getting local businesses found by customers, and AI sales teams for companies that sell to other businesses.
            </p>
            <a
              href="mailto:hello@getorangerank.com"
              className="mt-4 inline-block text-sm font-medium text-white transition-colors hover:text-brand"
            >
              hello@getorangerank.com
            </a>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 sm:gap-16">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <p className="text-sm font-semibold text-white">{col.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <a href={l.href} className="text-sm text-[#C8C8C8] transition-colors hover:text-white">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="mt-14 flex flex-col justify-between gap-3 border-t border-white/[0.08] pt-6 text-xs text-[#C8C8C8] sm:flex-row">
          <p>© 2026 OrangeRank. All rights reserved.</p>
          <p className="font-medium">getorangerank.com</p>
        </div>
      </Container>
    </footer>
  )
}
