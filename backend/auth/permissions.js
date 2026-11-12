/**
 * CMS RBAC — single source of truth for admin roles and modules.
 * Frontend mirrors this map in frontend/src/auth/permissions.js
 */

const ROLES = Object.freeze({
  ADMIN: 'admin',
  EDITOR: 'editor',
  RECEPTION: 'reception',
});

const ROLE_LIST = Object.freeze([ROLES.ADMIN, ROLES.EDITOR, ROLES.RECEPTION]);

/** @type {Record<string, ReadonlyArray<string>>} */
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
});

function normalizeRole(role) {
  const value = String(role || '').toLowerCase();
  return ROLE_LIST.includes(value) ? value : null;
}

function canAccess(role, module) {
  const normalized = normalizeRole(role);
  if (!normalized || !module) return false;
  return ROLE_MODULES[normalized].includes(module);
}

function modulesForRole(role) {
  const normalized = normalizeRole(role);
  return normalized ? [...ROLE_MODULES[normalized]] : [];
}

module.exports = {
  ROLES,
  ROLE_LIST,
  ROLE_MODULES,
  normalizeRole,
  canAccess,
  modulesForRole,
};
