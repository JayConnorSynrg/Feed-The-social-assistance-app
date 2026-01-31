/**
 * Directions utility for opening native map applications
 * Detects platform and opens the appropriate maps app
 */

interface DirectionsOptions {
  latitude: number
  longitude: number
  address?: string
  label?: string
}

/**
 * Detects if the current device is iOS
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

/**
 * Detects if the current device is Android
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false
  return /Android/.test(navigator.userAgent)
}

/**
 * Detects if running as a native app via Capacitor
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.()
}

/**
 * Generates a URL to open directions in the appropriate maps application
 * - iOS: Apple Maps (with Google Maps fallback)
 * - Android: Google Maps
 * - Web: Google Maps web
 */
export function getDirectionsUrl(options: DirectionsOptions): string {
  const { latitude, longitude, address, label } = options

  // Prefer coordinates if available, fallback to address
  const destination = address
    ? encodeURIComponent(address)
    : `${latitude},${longitude}`

  const labelParam = label ? encodeURIComponent(label) : ''

  if (isIOS()) {
    // Apple Maps URL scheme
    // Format: maps://?daddr=lat,lng or maps://?daddr=address
    return `maps://?daddr=${destination}${labelParam ? `&q=${labelParam}` : ''}`
  }

  if (isAndroid()) {
    // Google Maps intent for Android
    // Format: geo:lat,lng?q=lat,lng(label)
    if (latitude && longitude) {
      return `geo:${latitude},${longitude}?q=${latitude},${longitude}(${labelParam || 'Destination'})`
    }
    return `geo:0,0?q=${destination}`
  }

  // Web fallback - Google Maps
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}`
}

/**
 * Opens directions to a location using the best available method
 */
export function openDirections(options: DirectionsOptions): void {
  const url = getDirectionsUrl(options)

  if (isNativeApp()) {
    // For Capacitor, use the App plugin to open external URLs
    // This will be handled by Capacitor's Browser or App plugin
    window.location.href = url
  } else if (isIOS() || isAndroid()) {
    // For mobile web, try to open native app first
    // Set a timeout to fallback to web if app doesn't open
    const webFallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${
      options.address
        ? encodeURIComponent(options.address)
        : `${options.latitude},${options.longitude}`
    }`

    // Try native URL
    window.location.href = url

    // Fallback after delay (if app doesn't handle it)
    setTimeout(() => {
      // Only redirect if still on the same page
      if (!document.hidden) {
        window.open(webFallbackUrl, '_blank')
      }
    }, 1500)
  } else {
    // Desktop - open in new tab
    window.open(url, '_blank')
  }
}

/**
 * Builds a formatted address string from resource fields
 */
export function formatAddress(resource: {
  address_line1?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}): string {
  return [resource.address_line1, resource.city, resource.state, resource.zip]
    .filter(Boolean)
    .join(', ')
}
