import posthog from 'posthog-js'

let started = false

function getKey() {
  return String(import.meta.env.VITE_POSTHOG_KEY || '').trim()
}

function getHost() {
  return String(import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com').trim()
}

function isAdminPath(path) {
  return String(path || '').startsWith('/admin')
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
    persistence: 'localStorage+cookie'
  })

  started = true
  return posthog
}

export function capturePageview(route) {
  if (!started && !getKey()) return
  if (!started) initPosthog()
  if (!started) return

  const path = route?.fullPath || route?.path || window.location.pathname
  if (isAdminPath(path)) return

  posthog.capture('$pageview', {
    $current_url: window.location.href,
    path
  })
}

export function captureEvent(event, properties = {}) {
  if (!started && !getKey()) return
  if (!started) initPosthog()
  if (!started) return
  posthog.capture(event, properties)
}

export function getPosthog() {
  return started ? posthog : null
}
