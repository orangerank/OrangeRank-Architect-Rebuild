const sans = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'
const serif = 'Georgia, "Iowan Old Style", "Palatino Linotype", Palatino, serif'

export const platformNames = ['ChatGPT', 'Gemini', 'Claude', 'Perplexity', 'Google AI Overviews'] as const
export type PlatformName = (typeof platformNames)[number]

export function PlatformLabel({ name }: { name: string }) {
  if ((platformNames as readonly string[]).includes(name)) return <PlatformWordmark name={name as PlatformName} />
  return name
}

export function PlatformWordmark({ name }: { name: PlatformName }) {
  if (name === 'Perplexity') {
    return (
      <span aria-label="Perplexity" className="whitespace-nowrap font-semibold lowercase tracking-tight text-foreground/55" style={{ fontFamily: sans }}>
        perplexity
      </span>
    )
  }
  if (name === 'Claude') {
    return (
      <span className="whitespace-nowrap font-medium tracking-tight text-foreground/55" style={{ fontFamily: serif }}>
        Claude
      </span>
    )
  }
  return (
    <span className="whitespace-nowrap font-semibold tracking-tight text-foreground/55" style={{ fontFamily: sans }}>
      {name}
    </span>
  )
}
