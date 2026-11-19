import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Montserrat } from 'next/font/google'
import { OutreachClickBeacon } from '@/components/site/outreach-click'
import './globals.css'

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-montserrat',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://getorangerank.com'),
  title: 'OrangeRank — Be the business AI recommends.',
  description:
    'OrangeRank measures how AI systems like ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews see, describe, cite and recommend your business, and builds AI workforce systems for the work inside the business.',
  keywords: [
    'AI visibility',
    'AI search audit',
    'generative engine optimization',
    'ChatGPT visibility',
    'Orange Score',
    'AI recommendations',
    'AI Workforce Systems',
  ],
  openGraph: {
    title: 'OrangeRank — Be the business AI recommends.',
    description:
      'An AI Visibility Assessment and AI Workforce Systems for businesses that want to be recommended, and to put AI to work.',
    url: 'https://getorangerank.com',
    siteName: 'OrangeRank',
    type: 'website',
    images: [
      {
        url: '/icon-on-black-tight.png',
        width: 961,
        height: 943,
        alt: 'OrangeRank',
      },
    ],
  },
  twitter: {
    card: 'summary',
    images: ['/icon-on-black-tight.png'],
  },
  icons: {
    icon: [{ url: '/icon-on-black-tight.png', type: 'image/png' }],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#000000',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} bg-background`} data-scroll-behavior="smooth">
      <body className="font-sans antialiased">
        {children}
        <OutreachClickBeacon />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
