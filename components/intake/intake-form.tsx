'use client'

import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, Plus, X } from 'lucide-react'
import { categories, emailSuggestion, states, validateIntake, type IntakeValues } from './validation'

const control = 'mt-2 block w-full min-w-0 rounded-lg border border-border bg-background px-3.5 py-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand aria-[invalid=true]:border-destructive'
const step1Fields = ['businessName', 'website', 'city', 'state', 'email'] as const

const hints: Record<string, string> = {
  category: 'So we compare you with the right kind of business.',
  services: 'So we test the searches your customers actually make.',
  serviceArea: 'So we check the places you actually serve.',
  customerName: 'The person who should receive the report.',
  phone: 'Only if we need to clarify a detail in your intake.',
  competitors: "We'll compare you directly against these.",
  googleUrl: 'AI tools lean heavily on your Google profile.',
  notes: 'Context that should change how we read your results.',
}

function PriceLine({ id }: { id: string }) {
  return (
    <div id={id}>
      <p className="text-sm font-semibold text-foreground">
        <span className="text-brand">$149</span> · 14-page report · Delivered in 48 hours
      </p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">You&apos;ll enter payment on our secure checkout.</p>
    </div>
  )
}

export function IntakeForm({ initialValues = {} }: { initialValues?: IntakeValues }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [values, setValues] = useState<IntakeValues>(initialValues)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [urls, setUrls] = useState(1)
  const [notice, setNotice] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const busy = useRef(false)
  const attempt = useRef<{ id: string; payload: string } | null>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const errors = validateIntake(values)
  const valid = Object.keys(errors).length === 0
  const suggestion = emailSuggestion(values.email ?? '')

  function update(key: string, value: string) {
    setValues((previous) => ({ ...previous, [key]: value }))
    setNotice('')
  }

  function field(
    key: string,
    label: string,
    options: {
      required?: boolean
      type?: string
      choices?: string[]
      multiline?: boolean
      autoComplete?: string
      placeholder?: string
      hint?: string
    } = {},
  ) {
    const error = touched[key] ? errors[key] : undefined
    const emailHint = key === 'email' && suggestion && !errors.email ? suggestion : undefined
    const described = [
      options.hint ? `${key}-hint` : '',
      emailHint ? `${key}-suggestion` : '',
      error ? `${key}-error` : '',
    ]
      .filter(Boolean)
      .join(' ')
    const props = {
      id: key,
      name: key,
      value: values[key] ?? '',
      required: options.required,
      'aria-invalid': !!error,
      'aria-describedby': described || undefined,
      onChange: (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => update(key, event.target.value),
      onBlur: () => setTouched((previous) => ({ ...previous, [key]: true })),
      className: control,
    }
    return (
      <div>
        <label htmlFor={key} className="text-sm font-medium">
          {label}{' '}
          {options.required ? (
            <span className="text-brand" aria-label="required">
              *
            </span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </label>
        {options.choices ? (
          <select {...props}>
            <option value="">Select {label.toLowerCase()}</option>
            {options.choices.map((choice) => (
              <option key={choice}>{choice}</option>
            ))}
          </select>
        ) : options.multiline ? (
          <textarea {...props} rows={3} maxLength={5000} placeholder={options.placeholder} />
        ) : (
          <input {...props} type={options.type ?? 'text'} autoComplete={options.autoComplete} maxLength={1000} placeholder={options.placeholder} />
        )}
        {options.hint && (
          <p id={`${key}-hint`} className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {options.hint}
          </p>
        )}
        {emailHint && (
          <p id={`${key}-suggestion`} className="mt-2 text-sm text-muted-foreground">
            Did you mean{' '}
            <button
              type="button"
              className="font-medium text-brand underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              onClick={() => update('email', emailHint)}
            >
              {emailHint}
            </button>
            ?
          </p>
        )}
        {error && (
          <p id={`${key}-error`} className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    )
  }

  function showStep(next: 1 | 2) {
    setStep(next)
    queueMicrotask(() => titleRef.current?.focus())
  }

  function advance() {
    setTouched((previous) => ({ ...previous, ...Object.fromEntries(step1Fields.map((key) => [key, true])) }))
    const first = step1Fields.find((key) => errors[key])
    if (first) {
      document.getElementById(first)?.focus()
      return
    }
    showStep(2)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (step === 1) {
      advance()
      return
    }
    setTouched(Object.fromEntries(Object.keys(errors).map((key) => [key, true])))
    if (!valid) {
      document.getElementById(Object.keys(errors)[0])?.focus()
      return
    }
    if (busy.current) return
    busy.current = true
    setSubmitting(true)
    setNotice('')
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(values)))
      const payload = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
      if (!attempt.current || attempt.current.payload !== payload) {
        let previous: { id: string; payload: string } | null = null
        try {
          previous = JSON.parse(sessionStorage.getItem('or_intake_attempt') || 'null')
        } catch {}
        attempt.current = previous?.payload === payload ? previous : { id: crypto.randomUUID(), payload }
        try {
          sessionStorage.setItem('or_intake_attempt', JSON.stringify(attempt.current))
        } catch {}
      }
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intake_submission_id: attempt.current!.id,
          intake: { ...values, terms_accepted: values.acceptance === 'yes' },
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Checkout could not be started. Please retry.')
      const url = new URL(data.url)
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Checkout could not be verified.')
      window.location.assign(url.href)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Checkout could not be started. Please retry.')
    } finally {
      busy.current = false
      setSubmitting(false)
    }
  }

  return (
    <form noValidate onSubmit={submit} className="card-surface min-w-0 rounded-2xl p-5 sm:p-8">
      <div className="mb-8 border-b border-border pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 ref={titleRef} tabIndex={-1} className="text-xl font-semibold outline-none">
            Business details
          </h2>
          <span className="rounded-full border border-brand/30 bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            Step {step} of 2
          </span>
        </div>
        <div className="mt-4">
          <PriceLine id="offer-price" />
        </div>
        {step === 2 && (
          <p className="mt-4 text-sm text-foreground">This is what we use to build your 14-page report.</p>
        )}
        <p className="mt-3 text-sm text-muted-foreground">
          Fields marked <span className="text-brand">*</span> are required.
        </p>
      </div>

      {step === 1 ? (
        <fieldset>
          <legend className="sr-only">Business name, website, city, state, and email</legend>
          <div className="grid gap-5 sm:grid-cols-2">
            {field('businessName', 'Business name', { required: true, autoComplete: 'organization' })}
            {field('website', 'Website', { required: true, type: 'url', placeholder: 'https://yourwebsite.com', autoComplete: 'url' })}
            {field('city', 'Primary city', { required: true, autoComplete: 'address-level2' })}
            {field('state', 'State', { required: true, choices: states, autoComplete: 'address-level1' })}
            <div className="sm:col-span-2">{field('email', 'Customer email', { required: true, type: 'email', autoComplete: 'email' })}</div>
          </div>
          <button
            type="submit"
            className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Continue
            <ArrowRight aria-hidden="true" className="size-4" />
          </button>
        </fieldset>
      ) : (
        <>
          <fieldset>
            <legend className="mb-5 text-base font-semibold">Your business</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              {field('category', 'Business category', { required: true, choices: categories, hint: hints.category })}
              <div className="sm:col-span-2">
                {field('services', 'Primary services', {
                  required: true,
                  multiline: true,
                  placeholder: 'Which services are most important to your business?',
                  hint: hints.services,
                })}
              </div>
              <div className="sm:col-span-2">
                {field('serviceArea', 'Service area', {
                  required: true,
                  placeholder: 'Nearby cities, counties, or regions you serve',
                  hint: hints.serviceArea,
                })}
              </div>
            </div>
          </fieldset>

          <fieldset className="mt-8 border-t border-border pt-8">
            <legend className="float-left mb-5 w-full text-base font-semibold">Your contact details</legend>
            <div className="clear-both grid gap-5 sm:grid-cols-2">
              {field('customerName', 'Customer name', { required: true, autoComplete: 'name', hint: hints.customerName })}
              {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', hint: hints.phone })}
            </div>
          </fieldset>

          <fieldset className="mt-8 border-t border-border pt-8">
            <legend className="float-left mb-5 w-full text-base font-semibold">Your online presence</legend>
            <div className="clear-both space-y-5">
              {field('competitors', 'Known competitors', {
                multiline: true,
                placeholder: 'Names or websites of businesses you compete with',
                hint: hints.competitors,
              })}
              {field('googleUrl', 'Google Business Profile URL', {
                type: 'url',
                placeholder: 'https://...',
                hint: hints.googleUrl,
              })}
              <div>
                <p id="additional-urls-hint" className="text-sm text-muted-foreground">
                  Add up to five website, social profile, or other relevant URLs. AI may use these pages and profiles as sources.
                </p>
                <div className="mt-3 space-y-4">
                  {Array.from({ length: urls }, (_, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {field(`url${i}`, `Additional URL ${i + 1}`, { type: 'url', placeholder: 'https://...' })}
                      </div>
                      {i === urls - 1 && urls > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove additional URL ${i + 1}`}
                          className="mt-8 rounded-lg p-3 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand"
                          onClick={() => {
                            update(`url${i}`, '')
                            setUrls(urls - 1)
                          }}
                        >
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {urls < 5 && (
                  <button
                    type="button"
                    onClick={() => setUrls(urls + 1)}
                    className="mt-4 flex items-center gap-2 rounded-md text-sm font-medium text-brand focus-visible:ring-2 focus-visible:ring-brand"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Add another URL
                  </button>
                )}
              </div>
              {field('notes', 'Notes', {
                multiline: true,
                placeholder: 'Anything else we should know about your business?',
                hint: hints.notes,
              })}
            </div>
          </fieldset>

          <div className="mt-8 border-t border-border pt-6">
            <button
              type="button"
              onClick={() => showStep(1)}
              className="inline-flex items-center gap-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </button>
            <div className="mt-5">
              <PriceLine id="checkout-price" />
            </div>
            <label htmlFor="acceptance" className="mt-6 flex items-start gap-3 text-sm leading-relaxed">
              <input
                id="acceptance"
                type="checkbox"
                required
                checked={values.acceptance === 'yes'}
                onChange={(event) => update('acceptance', event.target.checked ? 'yes' : '')}
                onBlur={() => setTouched((previous) => ({ ...previous, acceptance: true }))}
                aria-invalid={!!(touched.acceptance && errors.acceptance)}
                aria-describedby={touched.acceptance && errors.acceptance ? 'acceptance-error' : undefined}
                className="mt-1 size-4 shrink-0 accent-brand focus-visible:ring-2 focus-visible:ring-brand"
              />
              <span>
                I agree to the{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="rounded-sm text-brand underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand">
                  Terms of Service
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="rounded-sm text-brand underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-brand">
                  Privacy Policy
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
                . <span className="text-brand" aria-label="required">*</span>
              </span>
            </label>
            {touched.acceptance && errors.acceptance && (
              <p id="acceptance-error" className="mt-2 text-sm text-destructive">
                {errors.acceptance}
              </p>
            )}
            <button
              type="submit"
              disabled={!valid || submitting}
              aria-describedby="checkout-price payment-status"
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Opening checkout…' : 'Continue to Payment'}
              <ArrowRight aria-hidden="true" className="size-4" />
            </button>
            <p id="payment-status" className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
              We save your intake when you continue. Your assessment begins after payment is confirmed.
            </p>
            <p role="status" aria-live="polite" className="mt-3 text-sm text-brand">
              {notice}
            </p>
          </div>
        </>
      )}
    </form>
  )
}
