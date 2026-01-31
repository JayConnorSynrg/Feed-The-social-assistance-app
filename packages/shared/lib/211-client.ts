/**
 * 211 API Client
 *
 * Client for accessing 211 community resource data.
 * The 211 system provides information about health and human services
 * such as food assistance, housing, healthcare, and more.
 *
 * Note: The actual API endpoint and authentication method will depend
 * on your 211 data provider (e.g., iCarol, Open211, United Way, etc.)
 */

// Rate limiting configuration
const RATE_LIMIT = {
  requestsPerMinute: 60,
  requestQueue: [] as number[],
}

/**
 * API Response types from 211 services
 */
export interface API211Location {
  id: string
  name: string
  description?: string
  address?: {
    address1?: string
    address2?: string
    city?: string
    state?: string
    zip?: string
    county?: string
  }
  location?: {
    latitude?: number
    longitude?: number
  }
  phones?: Array<{
    number: string
    type?: string
  }>
  hours?: string | Record<string, string>
  website?: string
  email?: string
  services?: Array<{
    id: string
    name: string
    description?: string
    taxonomies?: Array<{
      id: string
      name: string
      parent?: string
    }>
  }>
  organization?: {
    id: string
    name: string
  }
  lastUpdated?: string
}

export interface API211SearchParams {
  query?: string
  keyword?: string
  location?: {
    latitude: number
    longitude: number
    radius?: number // miles
  }
  zipCode?: string
  city?: string
  state?: string
  category?: string
  taxonomy?: string
  page?: number
  pageSize?: number
}

export interface API211SearchResponse {
  results: API211Location[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface API211ClientConfig {
  apiKey: string
  baseUrl?: string
  timeout?: number
}

/**
 * Custom error class for 211 API errors
 */
export class API211Error extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message)
    this.name = 'API211Error'
  }
}

/**
 * Creates a 211 API client instance
 */
export function create211Client(config: API211ClientConfig) {
  const {
    apiKey,
    baseUrl = process.env.API_211_BASE_URL || 'https://api.211.org/v1',
    timeout = 30000,
  } = config

  /**
   * Check rate limit before making a request
   */
  async function checkRateLimit(): Promise<void> {
    const now = Date.now()
    const oneMinuteAgo = now - 60000

    // Remove old requests from queue
    RATE_LIMIT.requestQueue = RATE_LIMIT.requestQueue.filter(
      (time) => time > oneMinuteAgo
    )

    // Check if we're at the limit
    if (RATE_LIMIT.requestQueue.length >= RATE_LIMIT.requestsPerMinute) {
      const oldestRequest = RATE_LIMIT.requestQueue[0]
      const waitTime = oldestRequest + 60000 - now

      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }

    // Add current request to queue
    RATE_LIMIT.requestQueue.push(now)
  }

  /**
   * Make an authenticated request to the 211 API
   */
  async function request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    await checkRateLimit()

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey,
          ...options.headers,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '')
        throw new API211Error(
          `API request failed: ${response.statusText}${errorBody ? ` - ${errorBody}` : ''}`,
          response.status
        )
      }

      return response.json()
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof API211Error) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new API211Error('Request timeout', 408, 'TIMEOUT')
        }
        throw new API211Error(error.message, undefined, 'NETWORK_ERROR')
      }

      throw new API211Error('Unknown error occurred')
    }
  }

  /**
   * Search for resources
   */
  async function search(
    params: API211SearchParams
  ): Promise<API211SearchResponse> {
    const queryParams = new URLSearchParams()

    if (params.query) queryParams.set('q', params.query)
    if (params.keyword) queryParams.set('keyword', params.keyword)
    if (params.zipCode) queryParams.set('zip', params.zipCode)
    if (params.city) queryParams.set('city', params.city)
    if (params.state) queryParams.set('state', params.state)
    if (params.category) queryParams.set('category', params.category)
    if (params.taxonomy) queryParams.set('taxonomy', params.taxonomy)
    if (params.page) queryParams.set('page', params.page.toString())
    if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())

    if (params.location) {
      queryParams.set('lat', params.location.latitude.toString())
      queryParams.set('lng', params.location.longitude.toString())
      if (params.location.radius) {
        queryParams.set('radius', params.location.radius.toString())
      }
    }

    return request<API211SearchResponse>(`/search?${queryParams.toString()}`)
  }

  /**
   * Get a single location by ID
   */
  async function getLocation(id: string): Promise<API211Location> {
    return request<API211Location>(`/locations/${encodeURIComponent(id)}`)
  }

  /**
   * Get locations by taxonomy/category
   */
  async function getByTaxonomy(
    taxonomyId: string,
    options: { page?: number; pageSize?: number } = {}
  ): Promise<API211SearchResponse> {
    const queryParams = new URLSearchParams()
    queryParams.set('taxonomy', taxonomyId)
    if (options.page) queryParams.set('page', options.page.toString())
    if (options.pageSize) queryParams.set('pageSize', options.pageSize.toString())

    return request<API211SearchResponse>(`/search?${queryParams.toString()}`)
  }

  /**
   * Search by geographic area
   */
  async function searchByArea(
    latitude: number,
    longitude: number,
    radiusMiles: number = 10,
    options: Omit<API211SearchParams, 'location'> = {}
  ): Promise<API211SearchResponse> {
    return search({
      ...options,
      location: {
        latitude,
        longitude,
        radius: radiusMiles,
      },
    })
  }

  /**
   * Health check for the API
   */
  async function healthCheck(): Promise<{ status: 'ok' | 'error'; message?: string }> {
    try {
      await request('/health')
      return { status: 'ok' }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  return {
    search,
    getLocation,
    getByTaxonomy,
    searchByArea,
    healthCheck,
  }
}

/**
 * Default client instance (requires API_211_KEY environment variable)
 */
export function getDefault211Client() {
  const apiKey = process.env.API_211_KEY
  if (!apiKey) {
    throw new API211Error('API_211_KEY environment variable is not set', undefined, 'CONFIG_ERROR')
  }
  return create211Client({ apiKey })
}

export type API211Client = ReturnType<typeof create211Client>
