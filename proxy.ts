import { NextResponse, type NextRequest } from 'next/server'
import { outreachAssessmentRedirect } from '@/lib/outreach/landing'

export function proxy(request: NextRequest) {
  const destination = outreachAssessmentRedirect(request.nextUrl.pathname, request.nextUrl.search)
  if (!destination) return NextResponse.next()
  const url = request.nextUrl.clone()
  url.pathname = '/ai-visibility'
  return NextResponse.redirect(url)
}

export const config = { matcher: '/' }
