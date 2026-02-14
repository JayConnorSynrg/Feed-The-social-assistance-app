/**
 * Federation Client Service
 *
 * Makes authenticated requests to federated FEED instances using HTTP Signatures.
 * Handles retries, timeouts, and error handling.
 */

import { signRequest, SignatureComponents } from './http-signatures'

export interface InstanceMetadata {
  instance_url: string
  instance_name: string
  version: string
  public_key: string
  capabilities: string[]
  metadata: {
    region?: string
    resource_count?: number
    last_updated?: string
    contact_email?: string
  }
}

export interface ResourceQuery {
  since?: string
  category?: string
  limit?: number
  cursor?: string
}

export interface Resource {
  id: string
  name: string
  description?: string
  resource_type: string
  address_line1?: string
  city?: string
  state?: string
  zip_code?: string
  phone?: string
  website?: string
  latitude?: number
  longitude?: number
  hours_of_operation?: Record<string, unknown>
  metadata?: Record<string, unknown>
  is_verified?: boolean
  updated_at: string
}

export interface ResourceListResponse {
  resources: Resource[]
  cursor?: string
  has_more: boolean
  total: number
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  response_time_ms: number
  timestamp: string
  version?: string
}

export interface FederationClientConfig {
  privateKey: string
  instanceUrl: string
  keyId?: string
  timeout?: number
  maxRetries?: number
}

export class FederationClient {
  private privateKey: string
  private instanceUrl: string
  private keyId: string
  private timeout: number
  private maxRetries: number

  constructor(config: FederationClientConfig) {
    this.privateKey = config.privateKey
    this.instanceUrl = config.instanceUrl
    this.keyId = config.keyId || `${config.instanceUrl}#main-key`
    this.timeout = config.timeout || 10000
    this.maxRetries = config.maxRetries || 3
  }

  /**
   * Fetch instance metadata from a remote FEED instance
   */
  async fetchInstanceMetadata(remoteUrl: string): Promise<InstanceMetadata> {
    const endpoint = `${remoteUrl}/.well-known/feed-instance`
    return this.makeSignedRequest<InstanceMetadata>('GET', endpoint)
  }

  /**
   * Fetch resources from a remote FEED instance
   */
  async fetchResources(
    remoteUrl: string,
    query: ResourceQuery = {}
  ): Promise<ResourceListResponse> {
    const params = new URLSearchParams()
    if (query.since) params.set('since', query.since)
    if (query.category) params.set('category', query.category)
    if (query.limit) params.set('limit', String(query.limit))
    if (query.cursor) params.set('cursor', query.cursor)

    const queryString = params.toString()
    const endpoint = `${remoteUrl}/api/federation/resources${queryString ? `?${queryString}` : ''}`

    return this.makeSignedRequest<ResourceListResponse>('GET', endpoint)
  }

  /**
   * Health check a remote FEED instance
   */
  async healthCheck(remoteUrl: string): Promise<HealthStatus> {
    const startTime = Date.now()
    const endpoint = `${remoteUrl}/.well-known/feed-instance`

    try {
      const metadata = await this.makeSignedRequest<InstanceMetadata>(
        'GET',
        endpoint,
        undefined,
        1 // Only 1 retry for health checks
      )

      return {
        status: 'healthy',
        response_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        version: metadata.version
      }
    } catch (error) {
      const responseTime = Date.now() - startTime

      // Differentiate between degraded and unhealthy
      if (responseTime > this.timeout / 2) {
        return {
          status: 'degraded',
          response_time_ms: responseTime,
          timestamp: new Date().toISOString()
        }
      }

      return {
        status: 'unhealthy',
        response_time_ms: responseTime,
        timestamp: new Date().toISOString()
      }
    }
  }

  /**
   * Make an authenticated request with HTTP Signature
   */
  private async makeSignedRequest<T>(
    method: string,
    url: string,
    body?: string,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.maxRetries
    let lastError: Error | null = null

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const result = await this.executeRequest<T>(method, url, body)
        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Don't retry on authentication errors
        if (
          lastError.message.includes('401') ||
          lastError.message.includes('403')
        ) {
          throw lastError
        }

        // Exponential backoff
        if (attempt < retries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000)
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  }

  /**
   * Execute a single signed request
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    body?: string
  ): Promise<T> {
    const parsedUrl = new URL(url)

    const components: SignatureComponents = {
      method,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        host: parsedUrl.host,
        date: new Date().toUTCString()
      },
      body
    }

    // Sign the request
    const signature = signRequest(this.privateKey, this.keyId, components)

    // Build headers
    const headers: Record<string, string> = {
      Host: parsedUrl.host,
      Date: components.headers['date'],
      Signature: signature,
      Accept: 'application/json',
      'User-Agent': `FEED-Federation/1.0 (${this.instanceUrl})`
    }

    if (body) {
      headers['Content-Type'] = 'application/json'
      headers['Digest'] = components.headers['digest']
    }

    // Make request with timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      return (await response.json()) as T
    } catch (error) {
      clearTimeout(timeoutId)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`)
      }

      throw error
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Create a federation client with default configuration
 */
export function createFederationClient(
  privateKey: string,
  instanceUrl: string
): FederationClient {
  return new FederationClient({
    privateKey,
    instanceUrl
  })
}
