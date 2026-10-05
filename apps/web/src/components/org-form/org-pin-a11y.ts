// apps/web/src/components/org-form/org-pin-a11y.ts
// Owner: Jelal Connor / SYNRG SCALING, LLC

/**
 * Marker ref for the org pin map: the pin element is decorative for assistive tech — the visible
 * pin status text ("Address found…", "Pin confirmed.") already says where the pin stands.
 */
export function hidePinFromAssistiveTech(
  marker: { getElement: () => { setAttribute: (k: string, v: string) => void } } | null
): void {
  marker?.getElement().setAttribute('aria-hidden', 'true')
}
