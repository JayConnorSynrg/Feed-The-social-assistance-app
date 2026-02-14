#!/bin/bash

#############################################################
# FEED Federation Webhook Integration Test
# Tests the complete webhook notification system
#############################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUPABASE_URL="${SUPABASE_URL:-http://localhost:54321}"
FUNCTION_URL="${FUNCTION_URL:-${SUPABASE_URL}/functions/v1/federation-webhook}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

#############################################################
# Helper Functions
#############################################################

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
  echo -e "${GREEN}✅${NC} $1"
  ((TESTS_PASSED++))
}

log_error() {
  echo -e "${RED}❌${NC} $1"
  ((TESTS_FAILED++))
}

log_warning() {
  echo -e "${YELLOW}⚠️${NC} $1"
}

run_test() {
  ((TESTS_RUN++))
  echo ""
  log_info "Test $TESTS_RUN: $1"
}

#############################################################
# Pre-flight Checks
#############################################################

log_info "Starting FEED Federation Webhook Integration Tests"
echo ""

# Check SERVICE_ROLE_KEY
if [ -z "$SERVICE_ROLE_KEY" ]; then
  log_error "SUPABASE_SERVICE_ROLE_KEY environment variable not set"
  exit 1
fi

log_success "Environment configured"

#############################################################
# Test 1: Function is accessible
#############################################################

run_test "Function is accessible (OPTIONS request)"

response=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$FUNCTION_URL")

if [ "$response" -eq 200 ]; then
  log_success "Function is accessible (HTTP $response)"
else
  log_error "Function not accessible (HTTP $response)"
fi

#############################################################
# Test 2: Reject non-POST requests
#############################################################

run_test "Reject GET requests"

response=$(curl -s -w "\n%{http_code}" -X GET "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY")

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 405 ]; then
  log_success "GET request rejected (HTTP $http_code)"
else
  log_error "GET request not rejected (HTTP $http_code)"
  echo "Response: $body"
fi

#############################################################
# Test 3: Reject requests with missing fields
#############################################################

run_test "Reject requests with missing required fields"

response=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"insert"}')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 400 ]; then
  log_success "Request with missing fields rejected (HTTP $http_code)"
else
  log_error "Request with missing fields not rejected (HTTP $http_code)"
  echo "Response: $body"
fi

#############################################################
# Test 4: Reject invalid event types
#############################################################

run_test "Reject invalid event types"

response=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "invalid",
    "resource_id": "123e4567-e89b-12d3-a456-426614174000",
    "resource_type": "food"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 400 ]; then
  log_success "Invalid event type rejected (HTTP $http_code)"
else
  log_error "Invalid event type not rejected (HTTP $http_code)"
  echo "Response: $body"
fi

#############################################################
# Test 5: Accept valid insert event
#############################################################

run_test "Accept valid insert event"

response=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "insert",
    "resource_id": "123e4567-e89b-12d3-a456-426614174000",
    "resource_type": "food"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ]; then
  # Check response contains expected fields
  if echo "$body" | jq -e '.success == true' > /dev/null 2>&1; then
    if echo "$body" | jq -e '.event == "resource.created"' > /dev/null 2>&1; then
      log_success "Valid insert event accepted (HTTP $http_code)"
      echo "Response: $(echo "$body" | jq -c '.')"
    else
      log_error "Response missing expected event field"
      echo "Response: $body"
    fi
  else
    log_error "Response missing success field"
    echo "Response: $body"
  fi
else
  log_error "Valid insert event rejected (HTTP $http_code)"
  echo "Response: $body"
fi

#############################################################
# Test 6: Accept valid update event
#############################################################

run_test "Accept valid update event"

response=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "update",
    "resource_id": "456e7890-e89b-12d3-a456-426614174000",
    "resource_type": "housing"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ] && echo "$body" | jq -e '.event == "resource.updated"' > /dev/null 2>&1; then
  log_success "Valid update event accepted (HTTP $http_code)"
else
  log_error "Valid update event rejected (HTTP $http_code)"
  echo "Response: $body"
fi

#############################################################
# Test 7: Accept valid delete event
#############################################################

run_test "Accept valid delete event"

response=$(curl -s -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "delete",
    "resource_id": "789e0123-e89b-12d3-a456-426614174000",
    "resource_type": "healthcare"
  }')

http_code=$(echo "$response" | tail -n1)
body=$(echo "$response" | head -n-1)

if [ "$http_code" -eq 200 ] && echo "$body" | jq -e '.event == "resource.deleted"' > /dev/null 2>&1; then
  log_success "Valid delete event accepted (HTTP $http_code)"
else
  log_error "Valid delete event rejected (HTTP $http_code)"
  echo "Response: $body"
fi

#############################################################
# Test 8: Verify CORS headers
#############################################################

run_test "Verify CORS headers are present"

response=$(curl -s -I -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"event_type":"insert","resource_id":"test","resource_type":"food"}')

if echo "$response" | grep -qi "access-control-allow-origin"; then
  log_success "CORS headers present"
else
  log_error "CORS headers missing"
  echo "Headers: $response"
fi

#############################################################
# Test 9: Verify deliveries structure
#############################################################

run_test "Verify response includes deliveries structure"

response=$(curl -s -X POST "$FUNCTION_URL" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "insert",
    "resource_id": "abc12345-e89b-12d3-a456-426614174000",
    "resource_type": "food"
  }')

if echo "$response" | jq -e '.deliveries.total != null' > /dev/null 2>&1; then
  if echo "$response" | jq -e '.deliveries.succeeded != null' > /dev/null 2>&1; then
    if echo "$response" | jq -e '.deliveries.failed != null' > /dev/null 2>&1; then
      log_success "Deliveries structure is valid"
      echo "Deliveries: $(echo "$response" | jq -c '.deliveries')"
    else
      log_error "Deliveries missing 'failed' field"
    fi
  else
    log_error "Deliveries missing 'succeeded' field"
  fi
else
  log_error "Response missing deliveries structure"
  echo "Response: $response"
fi

#############################################################
# Test Summary
#############################################################

echo ""
echo "=========================================="
echo "FEDERATION WEBHOOK INTEGRATION TEST SUMMARY"
echo "=========================================="
echo ""
echo "Tests Run:    $TESTS_RUN"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed${NC}"
  exit 1
fi
