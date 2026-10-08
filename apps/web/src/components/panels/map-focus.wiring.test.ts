// apps/web/src/components/panels/map-focus.wiring.test.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// Wiring guard. The behaviour lives in tested plain code — MapFocusSession, the popup reducer and
// hook, MarkerPopupDialog / markerA11yRef / focusPopupOnOpen, motionDuration,
// SafetyAlertsFetchScheduler, createLatestOnlyLoader, placeSafetyAlert / updateSafetyAlert. This
// suite has no DOM, so React effects never run here; these checks pin the few lines that forward to
// that code, so deleting or commenting one out turns RED. Sources are re-printed by the TypeScript
// printer with comments removed (JSX-aware), so a commented-out line never satisfies a check — the
// negative control below proves it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

/** Code only: comments removed, whitespace collapsed. */
function codeOf(text: string): string {
  const file = ts.createSourceFile('x.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  return ts.createPrinter({ removeComments: true }).printFile(file).replace(/\s+/g, ' ')
}
const src = (rel: string) => codeOf(readFileSync(path.join(__dirname, '..', '..', rel), 'utf8'))
/** The opening tag of the first <Name …> element (attribute values may contain "=>"). */
const openingTag = (code: string, name: string) => code.match(new RegExp(`<${name}\\b(?:=>|[^>])*>`))?.[0] ?? ''

describe('negative control: commented-out code never counts', () => {
  it('a planted commented-out forward does not satisfy the check', () => {
    const planted = codeOf(`
      function Panel() {
        // useEffect(() => { if (focus) focusSession.arrive(focus) }, [focus, focusSession])
        /* useSafetyAlerts(bounds) */
        return <div>{/* <Marker ref={markerA11yRef} /> */}</div>
      }`)
    expect(planted).not.toContain('focusSession.arrive(focus)')
    expect(planted).not.toContain('useSafetyAlerts(bounds)')
    expect(planted).not.toContain('markerA11yRef')
    expect(codeOf('focusSession.arrive(focus)')).toContain('focusSession.arrive(focus)')
  })
})

describe('map panel forwards its effects to MapFocusSession', () => {
  const panel = src('components/panels/map-panel.tsx')
  it('arrival, layer updates, unmount/remount and a member gesture each reach the session', () => {
    expect(panel).toContain('useEffect(() => { if (focus) focusSession.arrive(focus); }, [focus, focusSession]);')
    expect(panel).toContain(
      'useEffect(() => { focusSession.layersUpdated({ resource: dedupedMappableResources, business: viewportBusinesses, organization: viewportOrganizations, safety_alert: safetyAlerts, }); }',
    )
    expect(panel).toContain('useEffect(() => { focusSession.remount(); return () => focusSession.unmount(); }, [focusSession]);')
    expect(panel).toMatch(/onUserInteraction=\{\(\) => \{[^}]*focusSession\.memberTookMap\(\);/)
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
    expect(m).toContain('= useMarkerPopup(focused);')
    // The Mapbox wrapper loses its role="img" / "Map marker" so the button is exposed as a button.
    expect(openingTag(m, 'Marker')).toContain('ref={markerA11yRef}')
    const button = openingTag(m, 'button')
    expect(button).toMatch(/^<button type="button" ref=\{triggerRef\}/)
    expect(button).toContain('aria-haspopup="dialog" aria-expanded={showPopup}')
    const popup = openingTag(m, 'Popup')
    expect(popup).toContain('onClose={closePopup}')
    expect(popup).toContain('onOpen={onPopupOpen}')
    expect(popup).toContain('focusAfterOpen={false}')
    expect(popup).toContain('closeButton={false}')
    expect(openingTag(m, 'MarkerPopupDialog')).toContain('titleId={titleId} onClose={closePopup}')
    expect(m).toMatch(/id=\{titleId\}/)
  })
})

describe('the safety-alerts hook forwards to its scheduler and latest-only loader', () => {
  const hook = src('hooks/use-safety-alerts.ts')
  it('bounds, unmount, visibility, the refetch after place / edit, and latest-only reads', () => {
    expect(hook).toContain('scheduler.setBounds(viewportBounds)')
    expect(hook).toContain('useEffect(() => () => scheduler.dispose(), [scheduler]);')
    expect(hook).toContain("const onVisibility = () => scheduler.visibilityChanged(document.visibilityState === 'visible');")
    expect(hook).toContain("document.addEventListener('visibilitychange', onVisibility);")
    expect(hook).toContain('placeSafetyAlert(supabase, input, () => scheduler.refresh())')
    expect(hook).toContain('updateSafetyAlert(supabase, alertId, input, () => scheduler.refresh())')
    expect(hook).toContain('createLatestOnlyLoader<ViewportBounds, SafetyAlert[]>({ read: (bounds) => readSafetyAlertsInView(supabase, bounds),')
    expect(hook).toContain('fetch: (bounds) => void fetchAlerts(bounds),')
  })
})
