export const sampleBusiness = {
  name: 'Northline Physical Therapy',
  domain: 'northlinept.com',
  location: 'Denver, CO',
  category: 'Physical Therapy Clinic',
  auditDate: 'Sep 24, 2026',
  checksBreadth: 'Hundreds of AI visibility checks',
  platformsTested: 5,
  score: 62,
  previousBenchmark: 54,
  percentile: 41,
}

export type ScoreDimension = {
  label: string
  value: number
  weight: number
  description: string
}

export const scoreDimensions: ScoreDimension[] = [
  {
    label: 'Presence',
    value: 58,
    weight: 30,
    description: 'How often AI systems mention you for relevant, high-intent prompts.',
  },
  {
    label: 'Accuracy',
    value: 81,
    weight: 20,
    description: 'Whether facts like services, hours, location and pricing are correct.',
  },
  {
    label: 'Recommendation',
    value: 53,
    weight: 25,
    description: 'How highly you rank when AI is asked for a recommendation.',
  },
  {
    label: 'Sentiment',
    value: 74,
    weight: 10,
    description: 'The tone and framing AI uses when describing your business.',
  },
  {
    label: 'Citation Share',
    value: 44,
    weight: 15,
    description: 'How often your owned sources are cited as evidence.',
  },
]

export type PlatformResult = {
  name: string
  mentionRate: number
  avgPosition: number | null
  accuracy: number
}

export const platformResults: PlatformResult[] = [
  { name: 'ChatGPT', mentionRate: 64, avgPosition: 2.8, accuracy: 86 },
  { name: 'Gemini', mentionRate: 71, avgPosition: 2.1, accuracy: 90 },
  { name: 'Perplexity', mentionRate: 58, avgPosition: 3.4, accuracy: 72 },
]

export type Competitor = {
  name: string
  score: number
  shareOfVoice: number
  topQueries: number
  isYou?: boolean
}

export const competitors: Competitor[] = [
  { name: 'Summit Sports Rehab', score: 78, shareOfVoice: 31, topQueries: 94 },
  { name: 'Peak Motion PT', score: 71, shareOfVoice: 24, topQueries: 72 },
  { name: 'Northline Physical Therapy', score: 62, shareOfVoice: 18, topQueries: 51, isYou: true },
  { name: 'Elevate Physio Denver', score: 54, shareOfVoice: 15, topQueries: 38 },
  { name: 'Mile High Recovery', score: 47, shareOfVoice: 12, topQueries: 29 },
]

export type QueryResult = {
  prompt: string
  intent: 'Discovery' | 'Comparison' | 'Local' | 'Specific'
  mentioned: boolean
  position: number | null
  leader: string
}

export const queryResults: QueryResult[] = [
  {
    prompt: 'Best physical therapist in Denver for knee pain',
    intent: 'Local',
    mentioned: true,
    position: 2,
    leader: 'Summit Sports Rehab',
  },
  {
    prompt: 'Physical therapy for running injuries near Wash Park',
    intent: 'Local',
    mentioned: true,
    position: 1,
    leader: 'Northline Physical Therapy',
  },
  {
    prompt: 'Which Denver PT clinics take Kaiser insurance?',
    intent: 'Specific',
    mentioned: false,
    position: null,
    leader: 'Peak Motion PT',
  },
  {
    prompt: 'Summit Sports Rehab vs Northline PT',
    intent: 'Comparison',
    mentioned: true,
    position: 2,
    leader: 'Summit Sports Rehab',
  },
  {
    prompt: 'Post-surgery ACL rehab specialists in Colorado',
    intent: 'Discovery',
    mentioned: false,
    position: null,
    leader: 'Summit Sports Rehab',
  },
  {
    prompt: 'Dry needling physical therapy Denver',
    intent: 'Specific',
    mentioned: true,
    position: 3,
    leader: 'Elevate Physio Denver',
  },
]

export type VisibilityGap = {
  title: string
  impact: 'High' | 'Medium' | 'Low'
  detail: string
  affectedPrompts: number
  potentialLift: number
}

export const visibilityGaps: VisibilityGap[] = [
  {
    title: 'Absent from sports-injury & ACL rehab prompts',
    impact: 'High',
    detail:
      'Competitors with dedicated service pages are recommended in 78% of these prompts. Northline appears in 9%.',
    affectedPrompts: 46,
    potentialLift: 9,
  },
  {
    title: 'Insurance coverage not discoverable',
    impact: 'High',
    detail:
      'No accepted-insurance list is published in crawlable text, so AI systems default to clinics that state it explicitly.',
    affectedPrompts: 31,
    potentialLift: 6,
  },
  {
    title: 'Outdated hours on two cited directories',
    impact: 'Medium',
    detail:
      'Perplexity cites a listing that says the clinic is closed on Saturdays. It has been open Saturdays since 2025.',
    affectedPrompts: 18,
    potentialLift: 3,
  },
  {
    title: 'Low third-party review footprint',
    impact: 'Medium',
    detail:
      'Only 1 of the 4 review sources most cited by AI for Denver PT lists Northline with more than 20 reviews.',
    affectedPrompts: 27,
    potentialLift: 4,
  },
]

export type EvidenceItem = {
  platform: string
  prompt: string
  response: { text: string; highlight?: 'you' | 'competitor' | 'error' }[]
  verdict: 'Recommended' | 'Not mentioned' | 'Inaccurate'
  sources: string[]
  capturedAt: string
}

export const evidenceItems: EvidenceItem[] = [
  {
    platform: 'ChatGPT',
    prompt: 'Who is the best physical therapist in Denver for ACL rehab?',
    response: [
      { text: 'For ACL rehabilitation in Denver, ' },
      { text: 'Summit Sports Rehab', highlight: 'competitor' },
      { text: ' is frequently recommended for its return-to-sport protocols. ' },
      { text: 'Peak Motion PT', highlight: 'competitor' },
      {
        text: ' is another strong option, known for post-surgical programs and accepting most major insurance plans.',
      },
    ],
    verdict: 'Not mentioned',
    sources: ['summitsportsrehab.com', 'healthgrades.com', 'reddit.com/r/Denver'],
    capturedAt: 'Sep 22, 2026 · 14:08 MT',
  },
  {
    platform: 'Perplexity',
    prompt: 'Is Northline Physical Therapy open on weekends?',
    response: [
      { text: 'Northline Physical Therapy', highlight: 'you' },
      { text: ' in Wash Park is open Monday through Friday. ' },
      { text: 'It is closed on Saturdays and Sundays', highlight: 'error' },
      { text: ', so weekend appointments are not available.' },
    ],
    verdict: 'Inaccurate',
    sources: ['yellowpages.com', 'northlinept.com'],
    capturedAt: 'Sep 22, 2026 · 14:31 MT',
  },
  {
    platform: 'Gemini',
    prompt: 'Physical therapy for runners near Washington Park, Denver',
    response: [
      { text: 'A top choice is ' },
      { text: 'Northline Physical Therapy', highlight: 'you' },
      {
        text: ', which offers gait analysis and running-specific rehab programs. Patients highlight one-on-one sessions and flexible scheduling. ',
      },
      { text: 'Elevate Physio Denver', highlight: 'competitor' },
      { text: ' is also nearby.' },
    ],
    verdict: 'Recommended',
    sources: ['northlinept.com', 'google.com/maps', 'yelp.com'],
    capturedAt: 'Sep 23, 2026 · 09:12 MT',
  },
]

export const roadmap = [
  {
    phase: '30',
    label: 'Days 1–30',
    title: 'Fix the foundation',
    focus: 'Correct what AI gets wrong and make core facts machine-readable.',
    lift: '+6',
    items: [
      'Correct Saturday hours on Yellow Pages, Bing Places and Apple Maps',
      'Publish an accepted-insurance page with plain-text plan names',
      'Add LocalBusiness and MedicalClinic structured data',
      'Unify NAP details across 14 cited directories',
    ],
  },
  {
    phase: '60',
    label: 'Days 31–60',
    title: 'Close the content gaps',
    focus: 'Create the evidence AI needs to recommend you for high-value prompts.',
    lift: '+9',
    items: [
      'Launch dedicated ACL & sports-injury rehab service pages',
      'Publish clinician bios with credentials and specialties',
      'Add an FAQ hub answering 20 high-intent patient questions',
      'Earn 2 local editorial mentions (running clubs, local press)',
    ],
  },
  {
    phase: '90',
    label: 'Days 61–90',
    title: 'Build authority',
    focus: 'Grow third-party signals that AI systems weigh heavily.',
    lift: '+7',
    items: [
      'Grow review volume on Healthgrades and Google to 50+',
      'Secure listings on 3 AI-cited “best of Denver” roundups',
      'Publish patient outcome data with clear methodology',
      'Repeat AI visibility checks and benchmark against competitors',
    ],
  },
]
