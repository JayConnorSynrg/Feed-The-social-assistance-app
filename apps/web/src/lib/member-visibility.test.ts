// apps/web/src/lib/member-visibility.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Each member-visibility predicate in BOTH directions (I2): the visible case, and every reason a
// member cannot see the item at its member page.

import { describe, it, expect } from 'vitest'
import {
  businessMapVisibility,
  businessVisibility,
  isMapPoint,
  organizationMapVisibility,
  organizationVisibility,
  postVisibility,
  resourceMapVisibility,
  resourceVisibility,
  safetyAlertMapVisibility,
  showsMapControl,
} from './member-visibility'
import { memberReasonText, adminNavMessages } from './i18n-admin-nav'

describe('member visibility', () => {
  it('post: visible unless hidden; a missing row is not found', () => {
    expect(postVisibility({ is_hidden: false })).toEqual({ visible: true })
    expect(postVisibility({ is_hidden: true })).toEqual({ visible: false, reason: 'hidden' })
    // /s/post/[id] reads is_hidden=false only: a NULL is_hidden is not visible to members.
    expect(postVisibility({ is_hidden: null })).toEqual({ visible: false, reason: 'hidden' })
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

  it('event reasons and the "Appears in feed {date}" line exist in every locale, placeholder kept', () => {
    expect(memberReasonText('en', 'retired')).toBe('Retired — not in the feed')
    expect(memberReasonText('en', 'org_inactive')).toBe('Organization inactive — not in the feed')
    expect(memberReasonText('en', 'no_upcoming')).toBe('No upcoming dates — not in the feed')
    for (const [locale, msgs] of Object.entries(adminNavMessages)) {
      expect(msgs.appearsInFeed, locale).toContain('{date}')
      if (locale !== 'en') expect(msgs.viewInFeed, locale).not.toBe(adminNavMessages.en.viewInFeed)
    }
  })
})

// M1: "View on map" shows exactly when a member's map draws the pin — both directions per kind.
describe('member map visibility', () => {
  it('a map point is present with neither coordinate 0 (the viewport hooks drop a 0)', () => {
    expect(isMapPoint({ lng: -72.9, lat: 43.6 })).toBe(true)
    expect(isMapPoint({ lng: 0, lat: 43.6 })).toBe(false)
    expect(isMapPoint({ lng: -72.9, lat: 0 })).toBe(false)
    expect(isMapPoint(null)).toBe(false)
    expect(isMapPoint({ lng: Number.NaN, lat: 43.6 })).toBe(false)
  })

  it('resource: approved AND a non-zero location; otherwise not_approved / no_location', () => {
    expect(resourceMapVisibility({ status: 'approved', lat: 43.6, lng: -72.9 })).toEqual({ visible: true })
    expect(resourceMapVisibility({ status: 'approved', lat: null, lng: null })).toEqual({ visible: false, reason: 'no_location' })
    expect(resourceMapVisibility({ status: 'approved', lat: 0, lng: -72.9 })).toEqual({ visible: false, reason: 'no_location' })
    expect(resourceMapVisibility({ status: 'approved', lat: 43.6, lng: 0 })).toEqual({ visible: false, reason: 'no_location' })
    expect(resourceMapVisibility({ status: 'pending', lat: 43.6, lng: -72.9 })).toEqual({ visible: false, reason: 'not_approved' })
  })

  it('organization: active AND located; otherwise inactive / no_location', () => {
    expect(organizationMapVisibility({ is_active: true, has_map_location: true })).toEqual({ visible: true })
    expect(organizationMapVisibility({ is_active: true, has_map_location: false })).toEqual({ visible: false, reason: 'no_location' })
    expect(organizationMapVisibility({ is_active: false, has_map_location: true })).toEqual({ visible: false, reason: 'inactive' })
  })

  it('business: approved AND active AND located', () => {
    expect(businessMapVisibility({ status: 'approved', is_active: true, has_map_location: true })).toEqual({ visible: true })
    expect(businessMapVisibility({ status: 'approved', is_active: true, has_map_location: false })).toEqual({ visible: false, reason: 'no_location' })
    expect(businessMapVisibility({ status: 'approved', is_active: false, has_map_location: true })).toEqual({ visible: false, reason: 'inactive' })
    expect(businessMapVisibility({ status: 'pending', is_active: true, has_map_location: true })).toEqual({ visible: false, reason: 'not_approved' })
  })

  it('safety alert: live AND expires_at > now; a past-expiry live alert is expired; removed is hidden', () => {
    const now = new Date('2026-10-08T19:00:00.000Z')
    expect(safetyAlertMapVisibility({ status: 'live', expires_at: '2026-10-08T19:00:01.000Z' }, now)).toEqual({ visible: true })
    expect(safetyAlertMapVisibility({ status: 'live', expires_at: '2026-10-08T19:00:00.000Z' }, now)).toEqual({ visible: false, reason: 'expired' })
    expect(safetyAlertMapVisibility({ status: 'expired', expires_at: '2026-10-09T00:00:00.000Z' }, now)).toEqual({ visible: false, reason: 'expired' })
    expect(safetyAlertMapVisibility({ status: 'removed', expires_at: '2026-10-09T00:00:00.000Z' }, now)).toEqual({ visible: false, reason: 'hidden' })
  })

  it('the map control is skipped only when it would repeat the page reason word for word', () => {
    const inactive = { visible: false as const, reason: 'inactive' as const }
    const noLocation = { visible: false as const, reason: 'no_location' as const }
    expect(showsMapControl(inactive, inactive)).toBe(false)
    expect(showsMapControl({ visible: true }, noLocation)).toBe(true)
    expect(showsMapControl(inactive, noLocation)).toBe(true)
    expect(showsMapControl({ visible: true }, { visible: true })).toBe(true)
  })

  it('map reasons and "View on map" read plainly in English and are translated everywhere', () => {
    expect(memberReasonText('en', 'no_location')).toBe('No location — not on the map')
    expect(memberReasonText('en', 'expired')).toBe('Expired — not on the map')
    for (const [locale, msgs] of Object.entries(adminNavMessages)) {
      if (locale === 'en') continue
      expect(msgs.viewOnMap, locale).not.toBe(adminNavMessages.en.viewOnMap)
      expect(msgs.reasonNoLocation, locale).not.toBe(adminNavMessages.en.reasonNoLocation)
      expect(msgs.reasonExpired, locale).not.toBe(adminNavMessages.en.reasonExpired)
    }
  })
})
