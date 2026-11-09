import { BASE_URL } from '../services/api'

/**
 * Resolve DB media paths (/uploads/...) against the API host.
 * Absolute http(s) URLs pass through. Empty → ''.
 */
export function resolveMediaUrl(path) {
  if (!path) return ''
  const value = String(path).trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value

  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL
  const normalized = value.startsWith('/') ? value : `/${value}`
  return `${base}${normalized}`
}

export function resolveMediaUrlOrPlaceholder(path) {
  return resolveMediaUrl(path) || '/placeholder.jpg'
}

/** Staff photos: FE public placeholder stays on the site origin, not the API host. */
export const STAFF_PLACEHOLDER = '/placeholder-staff.svg'

export function resolveStaffPhotoUrl(path) {
  if (!path) return STAFF_PLACEHOLDER
  const value = String(path).trim()
  if (!value || value.includes('placeholder-staff')) return STAFF_PLACEHOLDER
  return resolveMediaUrl(value) || STAFF_PLACEHOLDER
}
