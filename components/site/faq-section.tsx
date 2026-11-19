import { Plus } from 'lucide-react'
import { Container, SectionHeading } from './section-heading'

const faqs = [
  {
    q: 'What is AI visibility, and why does it matter?',
    a: 'More customers now ask ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews for recommendations instead of searching traditionally. AI visibility is how often — and how accurately — those systems mention and recommend your business. If AI does not know you, a growing share of buyers never will.',
  },
  {
    q: 'How is the Orange Score calculated?',
    a: 'Hundreds of AI visibility checks inform the locked six-dimension Orange Score: AI Visibility & Recommendation (30), AI Platform Consistency (15), Entity & Trust Confidence (15), Local/Geographic Visibility (15), Service & Intent Coverage (15), and Competitive Position (10).',
  },
  {
    q: 'Which AI platforms do you test?',
    a: 'Every assessment tests five AI platforms equally: ChatGPT, Gemini, Claude, Perplexity and Google AI Overviews.',
  },
  {
    q: 'How long does it take to get my report?',
    a: 'Most reports are delivered within 48 hours of completing the short intake form. You receive both a downloadable PDF and an interactive online report.',
  },
  {
    q: 'Is this an SEO audit?',
    a: 'No. Traditional SEO measures rankings on a search results page. OrangeRank measures how generative AI systems describe and recommend you — which depends on different signals like entity consistency, third-party citations and structured, crawlable facts. The two are complementary.',
  },
  {
    q: 'Do I need technical skills to act on the recommendations?',
    a: 'No. Each recommendation is written in plain language, tied to the gap it closes and tagged by effort. Many fixes — like correcting directory listings or publishing an insurance page — can be done by anyone on your team.',
  },
  {
    q: 'What if I have questions about my report?',
    a: "Email hello@getorangerank.com and we'll walk you through anything in your report.",
  },
]

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-white/[0.06] py-24 sm:py-32">
      <Container>
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 [&>*]:min-w-0">
          <div className="lg:col-span-4">
            <SectionHeading
              id="faq-title"
              eyebrow="FAQ"
              title="Questions, answered."
              description={
                <>
                  Something else on your mind?{' '}
                  <a href="mailto:hello@getorangerank.com" className="text-foreground underline decoration-brand/60 underline-offset-4 hover:decoration-brand">
                    hello@getorangerank.com
                  </a>
                </>
              }
            />
          </div>
          <div className="lg:col-span-8">
            <ul className="divide-y divide-white/[0.07] border-y border-white/[0.07]">
              {faqs.map((f) => (
                <li key={f.q}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left text-base font-medium text-foreground focus-visible:outline-none focus-visible:text-brand [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <Plus
                        className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 group-open:text-brand"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="pb-6 pr-10 text-sm leading-relaxed text-muted-foreground sm:text-[15px]">{f.a}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Container>
    </section>
  )
}
