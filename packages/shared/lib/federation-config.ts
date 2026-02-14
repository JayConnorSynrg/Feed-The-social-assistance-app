/**
 * Federation Configuration Management
 *
 * Loads and validates federation settings from environment variables
 */

export interface FederationConfig {
  instanceUrl: string
  instanceName: string
  publicKey: string
  privateKey: string
  isLocal: boolean
  syncIntervalMinutes: number
  maxPeerTrustScore: number
  minPeerTrustScore: number
}

/**
 * Load federation configuration from environment variables
 *
 * @throws {Error} if required environment variables are missing
 */
export function loadFederationConfig(): FederationConfig {
  const instanceUrl = process.env.FEDERATION_INSTANCE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const instanceName = process.env.FEDERATION_INSTANCE_NAME || process.env.NEXT_PUBLIC_INSTANCE_NAME || 'FEED Instance'
  const publicKey = process.env.FEDERATION_PUBLIC_KEY || ''
  const privateKey = process.env.FEDERATION_PRIVATE_KEY || ''
  const syncInterval = parseInt(process.env.FEDERATION_SYNC_INTERVAL_MINUTES || '15', 10)
  const maxTrust = parseFloat(process.env.FEDERATION_MAX_PEER_TRUST || '1.0')
  const minTrust = parseFloat(process.env.FEDERATION_MIN_PEER_TRUST || '0.4')

  if (!instanceUrl) {
    throw new Error('FEDERATION_INSTANCE_URL or NEXT_PUBLIC_SUPABASE_URL must be set')
  }

  // Warn if keys aren't set (required for production)
  if (!publicKey || !privateKey) {
    console.warn('⚠️ Federation keys not configured. Run: npm run federation:generate-keys')
  }

  return {
    instanceUrl,
    instanceName,
    publicKey,
    privateKey,
    isLocal: process.env.NODE_ENV === 'development',
    syncIntervalMinutes: syncInterval,
    maxPeerTrustScore: maxTrust,
    minPeerTrustScore: minTrust,
  }
}

/**
 * Validate federation configuration
 *
 * @param config - Configuration object to validate
 * @returns true if valid, throws error if invalid
 */
export function validateConfig(config: FederationConfig): boolean {
  // Validate instance URL format
  try {
    new URL(config.instanceUrl)
  } catch (err) {
    throw new Error(`Invalid instance URL: ${config.instanceUrl}`)
  }

  // Validate instance name
  if (!config.instanceName || config.instanceName.length < 3) {
    throw new Error('Instance name must be at least 3 characters')
  }

  // Validate sync interval
  if (config.syncIntervalMinutes < 5) {
    throw new Error('Sync interval must be at least 5 minutes')
  }

  // Validate trust score range
  if (config.maxPeerTrustScore < 0 || config.maxPeerTrustScore > 1) {
    throw new Error('Max peer trust score must be between 0 and 1')
  }

  if (config.minPeerTrustScore < 0 || config.minPeerTrustScore > 1) {
    throw new Error('Min peer trust score must be between 0 and 1')
  }

  if (config.minPeerTrustScore > config.maxPeerTrustScore) {
    throw new Error('Min peer trust score cannot exceed max peer trust score')
  }

  // Validate keys format (PEM)
  if (config.publicKey && !config.publicKey.includes('BEGIN PUBLIC KEY')) {
    throw new Error('Public key must be in PEM format')
  }

  if (config.privateKey && !config.privateKey.includes('BEGIN PRIVATE KEY')) {
    throw new Error('Private key must be in PEM format')
  }

  return true
}

/**
 * Get federation configuration (loads and validates)
 *
 * @returns Validated federation configuration
 * @throws {Error} if configuration is invalid
 */
export function getFederationConfig(): FederationConfig {
  const config = loadFederationConfig()
  validateConfig(config)
  return config
}

/**
 * Check if federation is enabled
 *
 * @returns true if federation is properly configured
 */
export function isFederationEnabled(): boolean {
  try {
    const config = loadFederationConfig()
    return Boolean(config.publicKey && config.privateKey)
  } catch (err) {
    return false
  }
}
