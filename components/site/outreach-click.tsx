'use client'

import { useEffect } from 'react'
import { beaconBody, shouldSendClick } from '@/lib/outreach/code'

const inflight = new Set<string>()

export function OutreachClickBeacon() {
  useEffect(() => {
    try {
      const body = beaconBody(window.location.search, window.location.pathname)
      if (!body) return
      const send = shouldSendClick(
        body.code,
        key => sessionStorage.getItem(key),
        key => sessionStorage.setItem(key, '1'),
        inflight,
      )
      if (!send) return
      void fetch('/api/outreach-click', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'omit',
      }).catch(() => {})
    } catch { /* tracking is optional */ }
  }, [])
  return null
}
