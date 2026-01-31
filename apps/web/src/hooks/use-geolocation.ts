'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Geolocation, Position, PositionOptions } from '@capacitor/geolocation'

export interface GeolocationState {
  position: Position | null
  error: GeolocationError | null
  loading: boolean
  permissionDenied: boolean
}

export interface GeolocationError {
  code: number
  message: string
}

export interface UseGeolocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
  watch?: boolean
}

const defaultOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
}

/**
 * Detects if running as a native app via Capacitor
 */
function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.()
}

/**
 * Hook for accessing device geolocation
 * Works with both Capacitor (native) and browser Geolocation API
 */
export function useGeolocation(options: UseGeolocationOptions = {}): GeolocationState & {
  getCurrentPosition: () => Promise<Position | null>
  startWatching: () => Promise<void>
  stopWatching: () => void
  requestPermission: () => Promise<boolean>
} {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    loading: false,
    permissionDenied: false,
  })

  const watchIdRef = useRef<string | null>(null)
  const { enableHighAccuracy = true, timeout = 10000, maximumAge = 0, watch = false } = options

  const positionOptions: PositionOptions = {
    enableHighAccuracy,
    timeout,
    maximumAge,
  }

  /**
   * Request geolocation permission
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      if (isNativeApp()) {
        const permission = await Geolocation.requestPermissions()
        const granted =
          permission.location === 'granted' || permission.coarseLocation === 'granted'
        setState((prev) => ({ ...prev, permissionDenied: !granted }))
        return granted
      } else {
        // Browser - permission is requested on first position request
        return true
      }
    } catch (error) {
      console.error('Permission request error:', error)
      setState((prev) => ({ ...prev, permissionDenied: true }))
      return false
    }
  }, [])

  /**
   * Get current position
   */
  const getCurrentPosition = useCallback(async (): Promise<Position | null> => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      if (isNativeApp()) {
        // Use Capacitor Geolocation
        const position = await Geolocation.getCurrentPosition(positionOptions)
        setState((prev) => ({
          ...prev,
          position,
          loading: false,
          error: null,
          permissionDenied: false,
        }))
        return position
      } else {
        // Use browser Geolocation API
        return new Promise((resolve) => {
          if (!navigator.geolocation) {
            const error = { code: 0, message: 'Geolocation not supported' }
            setState((prev) => ({ ...prev, error, loading: false }))
            resolve(null)
            return
          }

          navigator.geolocation.getCurrentPosition(
            (position) => {
              // Convert to Capacitor Position format
              const capacitorPosition: Position = {
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  altitude: position.coords.altitude,
                  altitudeAccuracy: position.coords.altitudeAccuracy,
                  heading: position.coords.heading,
                  speed: position.coords.speed,
                },
                timestamp: position.timestamp,
              }
              setState((prev) => ({
                ...prev,
                position: capacitorPosition,
                loading: false,
                error: null,
                permissionDenied: false,
              }))
              resolve(capacitorPosition)
            },
            (error) => {
              const geoError: GeolocationError = {
                code: error.code,
                message: error.message,
              }
              const permissionDenied = error.code === 1 // PERMISSION_DENIED
              setState((prev) => ({
                ...prev,
                error: geoError,
                loading: false,
                permissionDenied,
              }))
              resolve(null)
            },
            {
              enableHighAccuracy,
              timeout,
              maximumAge,
            }
          )
        })
      }
    } catch (error) {
      const geoError: GeolocationError = {
        code: -1,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      setState((prev) => ({ ...prev, error: geoError, loading: false }))
      return null
    }
  }, [enableHighAccuracy, timeout, maximumAge, positionOptions])

  /**
   * Start watching position
   */
  const startWatching = useCallback(async (): Promise<void> => {
    // Stop any existing watch
    if (watchIdRef.current) {
      stopWatching()
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      if (isNativeApp()) {
        watchIdRef.current = await Geolocation.watchPosition(
          positionOptions,
          (position, error) => {
            if (error) {
              setState((prev) => ({
                ...prev,
                error: { code: -1, message: error.message || 'Watch error' },
                loading: false,
              }))
            } else if (position) {
              setState((prev) => ({
                ...prev,
                position,
                loading: false,
                error: null,
              }))
            }
          }
        )
      } else {
        if (!navigator.geolocation) {
          setState((prev) => ({
            ...prev,
            error: { code: 0, message: 'Geolocation not supported' },
            loading: false,
          }))
          return
        }

        const id = navigator.geolocation.watchPosition(
          (position) => {
            const capacitorPosition: Position = {
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy,
                altitude: position.coords.altitude,
                altitudeAccuracy: position.coords.altitudeAccuracy,
                heading: position.coords.heading,
                speed: position.coords.speed,
              },
              timestamp: position.timestamp,
            }
            setState((prev) => ({
              ...prev,
              position: capacitorPosition,
              loading: false,
              error: null,
            }))
          },
          (error) => {
            setState((prev) => ({
              ...prev,
              error: { code: error.code, message: error.message },
              loading: false,
              permissionDenied: error.code === 1,
            }))
          },
          { enableHighAccuracy, timeout, maximumAge }
        )
        watchIdRef.current = id.toString()
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: {
          code: -1,
          message: error instanceof Error ? error.message : 'Failed to start watching',
        },
        loading: false,
      }))
    }
  }, [enableHighAccuracy, timeout, maximumAge, positionOptions])

  /**
   * Stop watching position
   */
  const stopWatching = useCallback((): void => {
    if (watchIdRef.current) {
      if (isNativeApp()) {
        Geolocation.clearWatch({ id: watchIdRef.current })
      } else {
        navigator.geolocation.clearWatch(parseInt(watchIdRef.current, 10))
      }
      watchIdRef.current = null
    }
  }, [])

  // Auto-start watching if watch option is true
  useEffect(() => {
    if (watch) {
      startWatching()
    }

    return () => {
      stopWatching()
    }
  }, [watch, startWatching, stopWatching])

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
    requestPermission,
  }
}

/**
 * Calculate distance between two coordinates (in kilometers)
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
