import { describe, expect, it } from 'vitest'
import {
  canAccess,
  defaultAdminRouteName,
  ROLES,
  ROUTE_PERMISSIONS,
} from './permissions'

describe('frontend CMS permissions', () => {
  it('mirrors editor vs reception access', () => {
    expect(canAccess(ROLES.EDITOR, 'news')).toBe(true)
    expect(canAccess(ROLES.EDITOR, 'settings')).toBe(false)
    expect(canAccess(ROLES.RECEPTION, 'guests')).toBe(true)
    expect(canAccess(ROLES.RECEPTION, 'news')).toBe(false)
  })

  it('picks default home by role', () => {
    expect(defaultAdminRouteName(ROLES.ADMIN)).toBe('admin-news')
    expect(defaultAdminRouteName(ROLES.EDITOR)).toBe('admin-news')
    expect(defaultAdminRouteName(ROLES.RECEPTION)).toBe('admin-reservations')
  })

  it('maps cms users route to cms_users permission', () => {
    expect(ROUTE_PERMISSIONS['admin-cms-users']).toBe('cms_users')
  })
})
