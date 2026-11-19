/** Homepage visits with a utm_content code are outreach to local businesses. */
export function outreachAssessmentRedirect(pathname: string, search: string): string | null {
  const path = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (path !== '/') return null
  const query = search.startsWith('?') ? search.slice(1) : search
  let params: URLSearchParams
  try {
    params = new URLSearchParams(query)
  } catch {
    return null
  }
  const code = params.get('utm_content')
  if (code == null || code.trim() === '') return null
  const preserved = search.startsWith('?') ? search : query ? `?${query}` : ''
  return `/ai-visibility${preserved}`
}
