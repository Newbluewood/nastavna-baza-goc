import posthog from 'posthog-js'

let started = false

function getKey() {
  return String(import.meta.env.VITE_POSTHOG_KEY || '').trim()
}

function getHost() {
  return String(import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com').trim()
}

function isAdminPath(pathOrUrl) {
  const value = String(pathOrUrl || '')
  try {
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return new URL(value).pathname.startsWith('/admin')
    }
  } catch {
    // fall through
  }
  return value.startsWith('/admin') || value.includes('/admin/')
}

function shouldDropEvent(event) {
  const props = event?.properties || {}
  const candidates = [
    props.$current_url,
    props.$pathname,
    props.path,
    typeof window !== 'undefined' ? window.location.href : '',
    typeof window !== 'undefined' ? window.location.pathname : ''
  ]
  return candidates.some((v) => isAdminPath(v))
}

/** Init once. No-op if VITE_POSTHOG_KEY is missing. */
export function initPosthog() {
  const key = getKey()
  if (!key || started) return posthog

  posthog.init(key, {
    api_host: getHost(),
    person_profiles: 'identified_only',
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    // CMS must never leak clicks / form edits / vitals.
    before_send: (event) => (shouldDropEvent(event) ? null : event)
  })

  started = true

  if (typeof window !== 'undefined' && isAdminPath(window.location.pathname)) {
    posthog.opt_out_capturing()
  }

  return posthog
}

/**
 * Enable analytics on public routes; fully disable on /admin/*.
 * Call from router.afterEach.
 */
export function syncPosthogRoute(route) {
  if (!started && !getKey()) return
  if (!started) initPosthog()
  if (!started) return

  const path = route?.fullPath || route?.path || window.location.pathname

  if (isAdminPath(path)) {
    posthog.opt_out_capturing()
    return
  }

  posthog.opt_in_capturing()
  posthog.capture('$pageview', {
    $current_url: window.location.href,
    path
  })
}

export function captureEvent(event, properties = {}) {
  if (!started && !getKey()) return
  if (!started) initPosthog()
  if (!started) return
  if (isAdminPath(window.location.pathname)) return
  posthog.capture(event, properties)
}

export function getPosthog() {
  return started ? posthog : null
}
