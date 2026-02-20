#!/bin/bash
# MFA Setup Script
# This script completes the MFA implementation setup

set -e

echo "================================================"
echo "FEED Platform - MFA Setup"
echo "================================================"
echo ""

# Check if Supabase is running
echo "1. Checking Supabase status..."
if ! npx supabase status &>/dev/null; then
  echo "   ⚠️  Local Supabase is not running"
  echo "   Starting Supabase..."
  npx supabase start
else
  echo "   ✓ Supabase is running"
fi

echo ""
echo "2. Applying MFA migration..."
if npx supabase migration up; then
  echo "   ✓ Migration applied successfully"
else
  echo "   ⚠️  Migration failed (may already be applied)"
fi

echo ""
echo "3. Regenerating TypeScript types..."
if npx supabase gen types typescript --local > packages/database/types.ts; then
  echo "   ✓ Types regenerated successfully"
else
  echo "   ✗ Type generation failed"
  exit 1
fi

echo ""
echo "4. Building web application..."
cd apps/web
if npm run build; then
  echo "   ✓ Build successful"
else
  echo "   ✗ Build failed"
  exit 1
fi

cd ../..

echo ""
echo "================================================"
echo "MFA Setup Complete! ✓"
echo "================================================"
echo ""
echo "Next steps:"
echo "1. Run 'npm run dev' to start the development server"
echo "2. Navigate to Settings → Account"
echo "3. Enable Two-Factor Authentication"
echo "4. Test the enrollment and login flows"
echo ""
echo "See MFA-IMPLEMENTATION-SUMMARY.md for details"
echo ""
