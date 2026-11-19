import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site/site-header'

export const metadata: Metadata = {
  title: 'AI Visibility Assessment | OrangeRank',
  description:
    'OrangeRank measures how AI systems like ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews see, describe, cite and recommend your business. Get your Orange Score.',
  alternates: { canonical: '/ai-visibility' },
}
import { Hero } from '@/components/site/hero'
import { HowItWorks } from '@/components/site/how-it-works'
import { ScoreSection } from '@/components/site/score-section'
import { CompetitorSection } from '@/components/site/competitor-section'
import { GapSection } from '@/components/site/gap-section'
import { EvidenceSection } from '@/components/site/evidence-section'
import { SampleAssessment } from '@/components/site/sample-assessment'
import { RoadmapSection } from '@/components/site/roadmap-section'
import { PricingSection } from '@/components/site/pricing-section'
import { FaqSection } from '@/components/site/faq-section'
import { FinalCta } from '@/components/site/final-cta'
import { SiteFooter } from '@/components/site/site-footer'

export default function AiVisibilityPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <HowItWorks />
        <ScoreSection />
        <CompetitorSection />
        <GapSection />
        <EvidenceSection />
        <SampleAssessment />
        <RoadmapSection />
        <PricingSection />
        <FaqSection />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  )
}
