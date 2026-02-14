#!/usr/bin/env ts-node

/**
 * Register Local Instance in Federation
 *
 * This script registers the local FEED instance in the federated_instances table.
 * Must be run after generating keypair and configuring environment.
 *
 * Usage:
 *   npm run federation:register-local
 *
 * Prerequisites:
 *   - Keypair generated (npm run federation:generate-keys)
 *   - FEDERATION_INSTANCE_URL set in .env.local
 *   - FEDERATION_INSTANCE_NAME set in .env.local
 *   - FEDERATION_PUBLIC_KEY set in .env.local
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface FederatedInstance {
  id: string
  instance_url: string
  instance_name: string
  is_local: boolean
  public_key: string
  status: 'active' | 'suspended' | 'blocked'
  metadata: Record<string, unknown>
}

async function main() {
  console.log('🌐 Registering local FEED instance for federation...\n')

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Error: Missing Supabase credentials')
    console.error('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  // Get instance configuration
  const instanceUrl = process.env.FEDERATION_INSTANCE_URL || SUPABASE_URL
  const instanceName = process.env.FEDERATION_INSTANCE_NAME || 'Local FEED Instance'

  // Try to load public key from file or environment
  let publicKey = process.env.FEDERATION_PUBLIC_KEY || ''

  if (!publicKey && existsSync('public_key.pem')) {
    console.log('📄 Loading public key from public_key.pem...')
    publicKey = readFileSync('public_key.pem', 'utf-8')
  }

  if (!publicKey) {
    console.error('❌ Error: No public key found')
    console.error('   Run: npm run federation:generate-keys')
    console.error('   Or set FEDERATION_PUBLIC_KEY in .env.local')
    process.exit(1)
  }

  // Validate public key format
  if (!publicKey.includes('BEGIN PUBLIC KEY')) {
    console.error('❌ Error: Invalid public key format')
    console.error('   Public key must be in PEM format')
    process.exit(1)
  }

  console.log('📋 Instance configuration:')
  console.log(`   URL: ${instanceUrl}`)
  console.log(`   Name: ${instanceName}`)
  console.log(`   Public key: ${publicKey.substring(0, 50)}...\n`)

  // Create Supabase client with service role
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  })

  // Check if local instance already exists
  const { data: existingInstance, error: fetchError } = await supabase
    .from('federated_instances')
    .select('*')
    .eq('is_local', true)
    .single()

  if (fetchError && fetchError.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('❌ Error fetching existing instance:', fetchError.message)
    process.exit(1)
  }

  if (existingInstance) {
    console.log('📝 Local instance already registered, updating...')

    const { error: updateError } = await supabase
      .from('federated_instances')
      .update({
        instance_url: instanceUrl,
        instance_name: instanceName,
        public_key: publicKey,
        status: 'active',
        updated_at: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          capabilities: ['resources', 'search'],
          last_registered: new Date().toISOString()
        }
      })
      .eq('id', existingInstance.id)

    if (updateError) {
      console.error('❌ Error updating instance:', updateError.message)
      process.exit(1)
    }

    console.log('✅ Local instance updated successfully!\n')
    console.log(`   ID: ${existingInstance.id}`)
  } else {
    console.log('📝 Creating new local instance registration...')

    const { data: newInstance, error: insertError } = await supabase
      .from('federated_instances')
      .insert({
        instance_url: instanceUrl,
        instance_name: instanceName,
        is_local: true,
        public_key: publicKey,
        status: 'active',
        metadata: {
          version: '1.0.0',
          capabilities: ['resources', 'search'],
          registered_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Error creating instance:', insertError.message)
      process.exit(1)
    }

    console.log('✅ Local instance registered successfully!\n')
    console.log(`   ID: ${newInstance.id}`)
  }

  console.log('\n📋 Next steps:')
  console.log('   1. Share your public key with federation partners')
  console.log('   2. Add partner instances via the admin UI')
  console.log('   3. Configure sync settings per partner\n')

  console.log('🔗 Federation endpoint:')
  console.log(`   ${instanceUrl}/.well-known/feed-instance\n`)
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error)
  process.exit(1)
})
