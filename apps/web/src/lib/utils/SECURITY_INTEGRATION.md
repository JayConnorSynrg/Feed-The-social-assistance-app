# Security Integration Summary

This document outlines the security measures integrated into the FEED platform.

## Integrated Security Features

### 1. Rate Limiting
**Location**: Client-side (browser-based)
**Files**:
- `/apps/web/src/lib/security.ts` (implementation)
- `/apps/web/src/hooks/use-rate-limited-action.ts` (React hook)

**Configuration**:
- **API calls**: 20 per minute
- **Form submissions**: 5 per minute
- **File uploads**: 10 per minute
- **Auth attempts**: 5 per 15 minutes

**Integrated in**:
- Post Composer (`/components/feed/post-composer.tsx`)
  - Form submission: 5 per minute
  - File upload: 10 per minute
- Login Page (`/app/(auth)/login/page.tsx`)
  - Auth attempts: 5 per 15 minutes
  - Shows warning at 2 attempts remaining
  - Locks for 15 minutes after exceeding limit
- Signup Page (`/app/(auth)/signup/page.tsx`)
  - Auth attempts: 5 per 15 minutes
- Feed Panel (`/components/panels/feed-panel.tsx`)
  - Quick post creation: 5 per minute

**Important**: These are CLIENT-SIDE rate limits that prevent rapid-fire requests from the browser. They do NOT replace server-side rate limiting, which should be implemented on the API/Edge Functions.

---

### 2. CSRF Protection
**Location**: Client-side (sessionStorage-based)
**Files**:
- `/apps/web/src/lib/security.ts` (implementation)
- `/apps/web/src/hooks/use-csrf-token.ts` (React hook)

**Implementation**: Double-submit cookie pattern using sessionStorage

**Integrated in**:
- Post Composer (`/components/feed/post-composer.tsx`)
- Login Page (`/app/(auth)/login/page.tsx`)
- Signup Page (`/app/(auth)/signup/page.tsx`)

Each form includes a hidden CSRF token field. The token is generated on mount and stored in sessionStorage.

**Server-side validation**: Not yet implemented. Forms include the token, but server endpoints need to validate it.

---

### 3. Input Sanitization
**Location**: `/apps/web/src/lib/security.ts`
**Function**: `sanitizeInput(input: string)`

**What it does**:
- Escapes HTML special characters
- Prevents XSS via script injection
- Converts: `<`, `>`, `&`, `"`, `'` to HTML entities

**Integrated in**:
- Post Composer (`/components/feed/post-composer.tsx`)
  - Sanitizes post content before submission
- Feed Panel (`/components/panels/feed-panel.tsx`)
  - Sanitizes quick post content
- Signup Page (`/app/(auth)/signup/page.tsx`)
  - Sanitizes user full name

**Important**: This is basic HTML escaping. Rich text or markdown content may need additional sanitization.

---

### 4. File Upload Validation
**Location**: `/apps/web/src/lib/security.ts`
**Function**: `validateFileUpload(file, options)`

**Configuration**:
- Max size: 5MB (configurable)
- Allowed types: `image/jpeg`, `image/png`, `image/webp`
- Allowed extensions: `jpg`, `jpeg`, `png`, `webp`

**Integrated in**:
- Post Composer (`/components/feed/post-composer.tsx`)
  - Validates image uploads before storage upload
  - Shows user-friendly error messages

**Important**: This is CLIENT-SIDE validation only. Server-side validation should also be implemented in storage upload endpoints.

---

### 5. Password Strength Validation
**Location**: `/apps/web/src/lib/security.ts`
**Files**:
- `/apps/web/src/lib/security.ts` (implementation)
- `/apps/web/src/hooks/use-password-strength.ts` (React hook)

**Requirements**:
- Minimum 8 characters (enforced)
- Score-based system (6 points max):
  - +1: Length >= 8
  - +1: Length >= 12
  - +1: Contains lowercase
  - +1: Contains uppercase
  - +1: Contains numbers
  - +1: Contains special characters
  - -2: Contains common patterns (123456, password, etc.)

**Valid password**: Score >= 4 AND length >= 8

**Integrated in**:
- Signup Page (`/app/(auth)/signup/page.tsx`)
  - Real-time strength indicator (color-coded bar)
  - Dynamic feedback messages
  - Submit button disabled until valid
  - Strength labels: weak (red), fair (orange), good (yellow), strong (green)

---

## Security Hooks

### `useRateLimitedAction(options)`
Wraps actions with client-side rate limiting.

**Usage**:
```tsx
const { execute, isLimited, remainingRequests } = useRateLimitedAction({
  limiterType: 'formSubmit',
  identifier: 'user-123', // optional
  onRateLimited: () => console.log('Rate limited!')
})

const handleSubmit = async () => {
  const result = await execute(async () => {
    return await submitForm()
  })
  if (!result) {
    // Was rate limited
  }
}
```

---

### `useCsrfToken()`
Generates and manages CSRF tokens.

**Usage**:
```tsx
const { token, validate } = useCsrfToken()

return (
  <form onSubmit={handleSubmit}>
    <input type="hidden" name="csrf_token" value={token || ''} />
    ...
  </form>
)
```

---

### `usePasswordStrength(password)`
Validates password strength in real-time.

**Usage**:
```tsx
const [password, setPassword] = useState('')
const { valid, strength, feedback, color, score } = usePasswordStrength(password)

return (
  <div>
    <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
    <div style={{ color }}>{strength}</div>
    {feedback.map(msg => <div key={msg}>{msg}</div>)}
  </div>
)
```

---

## What's NOT Implemented (Server-Side)

The following are CLIENT-SIDE measures and require SERVER-SIDE implementation:

1. **Server-side rate limiting**
   - API routes and Edge Functions need rate limiting middleware
   - Consider using Upstash Redis for distributed rate limiting

2. **CSRF token validation**
   - Server endpoints need to validate CSRF tokens from requests
   - Implement in API route middleware

3. **Server-side input sanitization**
   - Database writes should sanitize/validate input
   - Edge Functions should validate all user input

4. **Server-side file validation**
   - Storage upload policies should validate file type/size
   - Consider scanning for malware

5. **Account lockout after failed auth**
   - Supabase Auth handles some of this, but custom logic may be needed
   - Consider implementing IP-based lockout

6. **Content Security Policy (CSP)**
   - Next.js middleware should add CSP headers
   - See `security.ts` for CSP helpers

---

## Security Audit Checklist

See `/apps/web/src/lib/security.ts` export `SECURITY_AUDIT_CHECKLIST` for a comprehensive security checklist covering:
- Authentication
- Authorization
- Data Protection
- Input Validation
- HTTP Headers
- Third-party Dependencies

---

## Next Steps

1. **Implement server-side rate limiting**
   - Use Upstash Redis or similar
   - Add middleware to API routes

2. **Add CSRF validation to server endpoints**
   - Validate tokens in API routes
   - Return 403 if invalid

3. **Configure Content Security Policy**
   - Add CSP headers via Next.js middleware
   - Generate nonces for inline scripts

4. **Implement IP-based account lockout**
   - Track failed auth attempts by IP
   - Add progressive delays or temporary bans

5. **Add server-side file scanning**
   - Integrate malware scanning for uploads
   - Validate file contents, not just extensions

6. **Set up security monitoring**
   - Log security events (failed auth, rate limits hit)
   - Alert on suspicious patterns
