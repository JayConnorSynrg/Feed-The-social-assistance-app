// apps/web/src/components/panels/map-focus.wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Wiring guard. The behaviour lives in tested plain code — MapFocusSession, the popup reducer and
// hook, MarkerPopupDialog, motionDuration, SafetyAlertsFetchScheduler, placeSafetyAlert /
// updateSafetyAlert. This suite has no DOM, so React effects never run here; these checks pin the
// few lines that forward to that code, so deleting one (e.g. the unmount forward) turns RED.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const src = (rel: string) => readFileSync(path.join(__dirname, '..', '..', rel), 'utf8').replace(/\s+/g, ' ')

describe('map panel forwards its effects to MapFocusSession', () => {
  const panel = src('components/panels/map-panel.tsx')
  it('arrival, layer updates, unmount/remount and a member gesture each reach the session', () => {
    expect(panel).toContain('useEffect(() => { if (focus) focusSession.arrive(focus) }, [focus, focusSession])')
    expect(panel).toMatch(/useEffect\(\(\) => \{ focusSession\.layersUpdated\(\{ resource: dedupedMappableResources, business: viewportBusinesses, organization: viewportOrganizations, safety_alert: safetyAlerts, \}\) \}/)
    expect(panel).toContain('useEffect(() => { focusSession.remount() return () => focusSession.unmount() }, [focusSession])')
    expect(panel).toMatch(/onUserInteraction=\{\(\) => \{[^}]*focusSession\.memberTookMap\(\)/)
  })
  it('the session gets the real camera setters and the settle logger', () => {
    expect(panel).toContain('camera: { setUserHasMovedMap, setHasGeocentered }')
    expect(panel).toContain('onSettle: mapFocusSettler({ logEvent, setPanelParams, setFocusMiss })')
  })
  it('the alerts layer gets the bounds state itself (stable identity)', () => {
    expect(panel).toContain('useSafetyAlerts(bounds)')
  })
})

describe('every camera flight honours reduced motion', () => {
  it('MapView.flyTo sets its duration through motionDuration + readPrefersReducedMotion', () => {
    expect(src('components/map/map-view.tsx')).toContain('duration: motionDuration(opts.duration ?? 1000, readPrefersReducedMotion())')
  })
})

describe('the four markers share one popup behaviour', () => {
  it.each(['resource-marker.tsx', 'org-marker.tsx', 'business-marker.tsx', 'safety-alert-marker.tsx'])('%s', (file) => {
    const m = src(`components/map/${file}`)
    expect(m).toContain('= useMarkerPopup(focused)')
    expect(m).toMatch(/<button type="button" ref=\{triggerRef\}/)
    expect(m).toContain('aria-haspopup="dialog" aria-expanded={showPopup}')
    expect(m).toContain('onClose={closePopup} focusAfterOpen={false}')
    expect(m).toMatch(/<MarkerPopupDialog titleId=\{titleId\} onClose=\{closePopup\}/)
    expect(m).toMatch(/id=\{titleId\}/)
  })
})

describe('the safety-alerts hook forwards to its scheduler', () => {
  const hook = src('hooks/use-safety-alerts.ts')
  it('bounds, unmount, and the refetch after place / edit', () => {
    expect(hook).toContain('scheduler.setBounds(viewportBounds)')
    expect(hook).toContain('useEffect(() => () => scheduler.dispose(), [scheduler])')
    expect(hook).toContain('placeSafetyAlert(supabase, input, () => scheduler.refresh())')
    expect(hook).toContain('updateSafetyAlert(supabase, alertId, input, () => scheduler.refresh())')
  })
})
