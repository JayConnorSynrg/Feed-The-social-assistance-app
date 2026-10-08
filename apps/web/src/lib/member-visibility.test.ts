// apps/web/src/lib/member-visibility.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Each member-visibility predicate in BOTH directions (I2): the visible case, and every reason a
// member cannot see the item at its member page.

import { describe, it, expect } from 'vitest'
import {
  businessVisibility,
  organizationVisibility,
  postVisibility,
  profileVisibility,
  resourceVisibility,
} from './member-visibility'
import { memberReasonText, adminNavMessages } from './i18n-admin-nav'

describe('member visibility', () => {
  it('post: visible unless hidden; a missing row is not found', () => {
    expect(postVisibility({ is_hidden: false })).toEqual({ visible: true })
    expect(postVisibility({ is_hidden: true })).toEqual({ visible: false, reason: 'hidden' })
    expect(postVisibility(null)).toEqual({ visible: false, reason: 'not_found' })
  })

  it('organization: visible while active, inactive otherwise', () => {
    expect(organizationVisibility({ is_active: true })).toEqual({ visible: true })
    expect(organizationVisibility({ is_active: false })).toEqual({ visible: false, reason: 'inactive' })
  })

  it('business: visible only when approved AND active', () => {
    expect(businessVisibility({ status: 'approved', is_active: true })).toEqual({ visible: true })
    expect(businessVisibility({ status: 'approved', is_active: false })).toEqual({ visible: false, reason: 'inactive' })
    expect(businessVisibility({ status: 'pending', is_active: true })).toEqual({ visible: false, reason: 'not_approved' })
    expect(businessVisibility({ status: 'rejected', is_active: false })).toEqual({ visible: false, reason: 'not_approved' })
  })

  it('resource: visible only when approved', () => {
    expect(resourceVisibility({ status: 'approved' })).toEqual({ visible: true })
    expect(resourceVisibility({ status: 'pending' })).toEqual({ visible: false, reason: 'not_approved' })
    expect(resourceVisibility({ status: 'rejected' })).toEqual({ visible: false, reason: 'not_approved' })
  })

  it('profile: visible only with a username', () => {
    expect(profileVisibility({ username: 'ann' })).toEqual({ visible: true })
    expect(profileVisibility({ username: null })).toEqual({ visible: false, reason: 'no_username' })
    expect(profileVisibility({ username: '' })).toEqual({ visible: false, reason: 'no_username' })
  })
})

describe('reason text', () => {
  it('every reason has text in every locale, and English reads plainly', () => {
    expect(memberReasonText('en', 'hidden')).toBe('Hidden from members')
    expect(memberReasonText('en', 'inactive')).toBe('Inactive — hidden from members')
    expect(memberReasonText('es', 'inactive')).toBe('Inactivo: oculto para los miembros')
    for (const [locale, msgs] of Object.entries(adminNavMessages)) {
      for (const [key, value] of Object.entries(msgs)) expect(value, `${locale}.${key}`).not.toBe('')
    }
    expect(Object.keys(adminNavMessages)).toHaveLength(14)
  })
})
