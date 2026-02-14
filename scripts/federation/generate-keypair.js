#!/usr/bin/env node

/**
 * Generate RSA-4096 Keypair for Federation Authentication
 *
 * This script generates a public/private keypair used for HTTP Signatures
 * in the FEED Federation Protocol.
 *
 * Usage:
 *   npm run federation:generate-keys
 *
 * Output:
 *   - private_key.pem (KEEP SECRET!)
 *   - public_key.pem (share with federation partners)
 */

const { generateKeyPairSync } = require('crypto')
const { writeFileSync, existsSync } = require('fs')

const PRIVATE_KEY_FILE = 'private_key.pem'
const PUBLIC_KEY_FILE = 'public_key.pem'

function main() {
  console.log('🔐 Generating RSA-4096 keypair for federation...\n')

  // Check if keys already exist
  if (existsSync(PRIVATE_KEY_FILE) || existsSync(PUBLIC_KEY_FILE)) {
    console.error('❌ Error: Keys already exist!')
    console.error('   To regenerate, delete existing keys first:')
    console.error(`   rm ${PRIVATE_KEY_FILE} ${PUBLIC_KEY_FILE}\n`)
    process.exit(1)
  }

  // Generate keypair
  console.log('⏳ Generating 4096-bit RSA keypair (this may take a moment)...')
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })

  // Save to files
  writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 }) // Owner read/write only
  writeFileSync(PUBLIC_KEY_FILE, publicKey, { mode: 0o644 })   // World readable

  console.log('✅ Keypair generated successfully!\n')
  console.log('📄 Files created:')
  console.log(`   - ${PRIVATE_KEY_FILE} (KEEP SECRET - never commit to git!)`)
  console.log(`   - ${PUBLIC_KEY_FILE} (share with federation partners)\n`)

  console.log('📋 Next steps:')
  console.log('   1. Add private key to apps/web/.env.local:')
  console.log(`      FEDERATION_PRIVATE_KEY="$(cat ${PRIVATE_KEY_FILE})"\n`)
  console.log('   2. Share your public key with federation partners')
  console.log('   3. Add partner public keys to your federated_instances table\n')

  console.log('🔑 Your public key (share this):')
  console.log('─'.repeat(60))
  console.log(publicKey)
  console.log('─'.repeat(60))
  console.log('\n⚠️  Remember: Keep private_key.pem SECRET! Add it to .gitignore.')
}

main()
