/**
 * CMS RBAC — mirror of backend/auth/permissions.js
 * Keep modules per role in sync with the backend map.
 */

export const ROLES = Object.freeze({
  ADMIN: 'admin',
  EDITOR: 'editor',
  RECEPTION: 'reception',
})

export const ROLE_LIST = Object.freeze([ROLES.ADMIN, ROLES.EDITOR, ROLES.RECEPTION])

const ROLE_MODULES = Object.freeze({
  [ROLES.ADMIN]: Object.freeze([
    'news',
    'pages',
    'themes',
    'projects',
    'staff',
    'restaurant',
    'settings',
    'hero',
    'stats',
    'ai_usage',
    'system',
    'cms_users',
    'inquiries',
    'guests',
    'rooms',
    'room_map',
    'content_ai',
    'upload',
  ]),
  [ROLES.EDITOR]: Object.freeze([
    'news',
    'pages',
    'themes',
    'projects',
    'staff',
    'restaurant',
    'content_ai',
    'upload',
  ]),
  [ROLES.RECEPTION]: Object.freeze([
    'inquiries',
    'guests',
    'rooms',
    'room_map',
    'upload',
  ]),
})

/** Route name → permission module */
export const ROUTE_PERMISSIONS = Object.freeze({
  'admin-news': 'news',
  'admin-pages': 'pages',
  'admin-nav': 'pages',
  'admin-projects': 'projects',
  'admin-staff': 'staff',
  'admin-reservations': 'inquiries',
  'admin-guests': 'guests',
  'admin-room-map': 'room_map',
  'admin-rooms': 'rooms',
  'admin-stats': 'stats',
  'admin-ai': 'ai_usage',
  'admin-restaurant': 'restaurant',
  'admin-settings': 'settings',
  'admin-email-templates': 'settings',
  'admin-themes': 'themes',
  'admin-cms-users': 'cms_users',
})

export function normalizeRole(role) {
  const value = String(role || '').toLowerCase()
  return ROLE_LIST.includes(value) ? value : null
}

export function canAccess(role, module) {
  const normalized = normalizeRole(role)
  if (!normalized || !module) return false
  return ROLE_MODULES[normalized].includes(module)
}

export function getStoredAdminRole() {
  return normalizeRole(localStorage.getItem('admin_role')) || ROLES.ADMIN
}

export function defaultAdminRouteName(role = getStoredAdminRole()) {
  if (canAccess(role, 'news')) return 'admin-news'
  if (canAccess(role, 'inquiries')) return 'admin-reservations'
  if (canAccess(role, 'cms_users')) return 'admin-cms-users'
  return 'admin-login'
}

export const ROLE_LABELS = Object.freeze({
  admin: 'Admin',
  editor: 'Editor',
  reception: 'Recepcija',
})
