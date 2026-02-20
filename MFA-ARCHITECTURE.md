# MFA Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FEED Platform                           │
│                      MFA Implementation                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        User Interfaces                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Login      │  │   Settings   │  │ MFA Verify   │         │
│  │   Page       │  │   Panel      │  │  Component   │         │
│  │              │  │              │  │              │         │
│  │ - Email/Pass │  │ - Enable MFA │  │ - TOTP Input │         │
│  │ - MFA Check  │  │ - Disable    │  │ - Backup Code│         │
│  │ - AAL Detect │  │ - Status     │  │ - Auto-submit│         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                 │                  │                 │
└─────────┼─────────────────┼──────────────────┼─────────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       MFA Service Layer                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────┐     │
│  │              MFAService (/lib/mfa.ts)                 │     │
│  ├───────────────────────────────────────────────────────┤     │
│  │                                                       │     │
│  │  • isMFAEnabled()         - Check MFA status         │     │
│  │  • getAssuranceLevel()    - Get AAL (aal1/aal2)      │     │
│  │  • enrollTOTP()           - Start enrollment         │     │
│  │  • verifyEnrollment()     - Complete enrollment      │     │
│  │  • createChallenge()      - Create login challenge   │     │
│  │  • verifyChallenge()      - Verify TOTP code         │     │
│  │  • unenrollTOTP()         - Disable MFA              │     │
│  │  • generateBackupCodes()  - Generate recovery codes  │     │
│  │  • verifyBackupCode()     - Verify backup code       │     │
│  │                                                       │     │
│  └───────────────────┬───────────────────────────────────┘     │
│                      │                                         │
└──────────────────────┼─────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase Auth API                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────┐       │
│  │              Native MFA Support                     │       │
│  ├─────────────────────────────────────────────────────┤       │
│  │                                                     │       │
│  │  • mfa.enroll()           - TOTP enrollment         │       │
│  │  • mfa.challenge()        - Create challenge        │       │
│  │  • mfa.verify()           - Verify code             │       │
│  │  • mfa.unenroll()         - Remove factor           │       │
│  │  • mfa.listFactors()      - Get user factors        │       │
│  │  • mfa.getAuthenticatorAssuranceLevel()             │       │
│  │                                                     │       │
│  │  ✓ TOTP secret management (encrypted)              │       │
│  │  ✓ QR code generation (otpauth://)                 │       │
│  │  ✓ Time-based verification (30s window)            │       │
│  │  ✓ Session AAL tracking                            │       │
│  │                                                     │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Database Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────────────────────┐  ┌──────────────────────┐          │
│  │   auth.mfa_factors     │  │  mfa_backup_codes    │          │
│  │  (Supabase managed)    │  │  (Custom table)      │          │
│  ├────────────────────────┤  ├──────────────────────┤          │
│  │                        │  │                      │          │
│  │ - id                   │  │ - id                 │          │
│  │ - user_id              │  │ - user_id            │          │
│  │ - factor_type (totp)   │  │ - code_hash (SHA256) │          │
│  │ - status (verified)    │  │ - used_at            │          │
│  │ - secret (encrypted)   │  │ - created_at         │          │
│  │ - created_at           │  │                      │          │
│  │                        │  │ RLS: User isolation  │          │
│  │ RLS: User isolation    │  │                      │          │
│  │                        │  │                      │          │
│  └────────────────────────┘  └──────────────────────┘          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Component Flow Diagrams

### Enrollment Flow

```
User Action                    Component                    Service/API
───────────                    ─────────                    ───────────

[Click Enable MFA]
                    ──────────> Settings Panel
                                     │
                                     ├─ Show MFAEnrollment
                                     │
[View QR Code]                       │
                                     ├─────────────────> mfaService.enrollTOTP()
                                     │                            │
                                     │                            ├──> Supabase auth.mfa.enroll()
                                     │                            │
                                     │  <────────────────         │
                                     │  {qrCode, secret, factorId}│
                                     │
                    <────────────    │ Display QR + Secret
[Scan with App]

[Enter 6-digit code]
                    ──────────> MFAEnrollment
                                     │
                                     ├─────────────────> mfaService.verifyEnrollment()
                                     │                            │
                                     │                            ├──> Supabase auth.mfa.verify()
                                     │                            │
                                     │  <────────────────         │
                                     │  {verified: true}          │
                                     │
                                     ├─────────────────> mfaService.generateBackupCodes()
                                     │                            │
                                     │                            ├──> Hash codes (SHA-256)
                                     │                            │
                                     │                            ├──> Insert to DB
                                     │                            │
                                     │  <────────────────         │
                                     │  {codes: [...]}            │
                                     │
                    <────────────    │ Display Backup Codes
[Save Backup Codes]                  │
                                     │
[Complete]          <────────────    │ MFA Enabled ✓
```

### Login Flow (with MFA)

```
User Action                    Component                    Service/API
───────────                    ─────────                    ───────────

[Enter Email/Pass]
                    ──────────> Login Page
                                     │
[Submit]                             ├──────────────────> Supabase auth.signInWithPassword()
                                     │                            │
                                     │  <────────────────         │
                                     │  {user, session}           │
                                     │
                                     ├─────────────────> mfaService.listFactors()
                                     │                            │
                                     │  <────────────────         │
                                     │  {factors: [...]}          │
                                     │
                                     ├─────────────────> mfaService.getAssuranceLevel()
                                     │                            │
                                     │  <────────────────         │
                                     │  {currentLevel: 'aal1'}    │
                                     │
                                     ├─ Show MFAVerify Component
                                     │
                    <────────────    │

[Enter TOTP Code]
                    ──────────> MFAVerify
                                     │
[Submit]                             ├─────────────────> mfaService.createChallenge()
                                     │                            │
                                     │                            ├──> Supabase auth.mfa.challenge()
                                     │                            │
                                     │  <────────────────         │
                                     │  {challengeId}             │
                                     │
                                     ├─────────────────> mfaService.verifyChallenge()
                                     │                            │
                                     │                            ├──> Supabase auth.mfa.verify()
                                     │                            │
                                     │  <────────────────         │
                                     │  {verified: true}          │
                                     │  {currentLevel: 'aal2'}    │
                                     │
[Redirect to App]   <────────────    │ Login Complete ✓
```

### Middleware Protection

```
Request                         Middleware                   Action
───────                         ──────────                   ──────

GET /
            ──────────────────> Check Auth Status
                                     │
                                     ├─ User authenticated?
                                     │  Yes ──────────────> Check AAL Level
                                     │                            │
                                     │                            ├─ AAL = aal1?
                                     │                            │  MFA enrolled?
                                     │                            │
                                     │                            │  Yes ─────> Redirect to /login?step=mfa
                                     │                            │
                                     │                            │  No ──────> Allow request
                                     │
            <──────────────────     │
Allow/Redirect
```

## Data Flow

### TOTP Secret Management

```
┌─────────────────────────────────────────────────────────────────┐
│                    TOTP Secret Lifecycle                        │
└─────────────────────────────────────────────────────────────────┘

1. Enrollment
   ┌──────────────────────────────────────────────────────────┐
   │ Client Request                                           │
   │   mfaService.enrollTOTP()                                │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Supabase Auth                                            │
   │   1. Generate random secret (base32)                     │
   │   2. Encrypt secret (AES-256)                            │
   │   3. Store in auth.mfa_factors                           │
   │   4. Generate otpauth:// URI                             │
   │   5. Return QR code data                                 │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Client Display                                           │
   │   - QR code (rendered client-side)                       │
   │   - Manual entry secret (base32)                         │
   │   - Never sent to server again                           │
   └──────────────────────────────────────────────────────────┘

2. Verification
   ┌──────────────────────────────────────────────────────────┐
   │ User Input                                               │
   │   6-digit TOTP code from authenticator app               │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Supabase Auth                                            │
   │   1. Decrypt stored secret                               │
   │   2. Generate expected TOTP (RFC 6238)                   │
   │   3. Compare with user input                             │
   │   4. Accept if within 30s window (±1 step)               │
   │   5. Update AAL to aal2 if verified                      │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Result                                                   │
   │   Success: AAL upgraded, session updated                 │
   │   Failure: Remain at AAL1, retry allowed                 │
   └──────────────────────────────────────────────────────────┘
```

### Backup Code Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Backup Code Lifecycle                        │
└─────────────────────────────────────────────────────────────────┘

1. Generation
   ┌──────────────────────────────────────────────────────────┐
   │ Client Request                                           │
   │   mfaService.generateBackupCodes()                       │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Client-Side Generation                                   │
   │   1. Generate 10 random codes (crypto.getRandomValues)   │
   │   2. 8 characters each (A-Z, 2-9, no ambiguous)          │
   │   3. Hash each code (SHA-256)                            │
   │   4. Store hashes in database                            │
   │   5. Return plaintext codes to user                      │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Database Storage                                         │
   │   Table: mfa_backup_codes                                │
   │   - user_id: UUID                                        │
   │   - code_hash: TEXT (SHA-256 hex)                        │
   │   - used_at: NULL (initially)                            │
   │   - created_at: TIMESTAMP                                │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ User Display                                             │
   │   - Show codes once (cannot retrieve)                    │
   │   - Offer download as .txt file                          │
   │   - Offer copy to clipboard                              │
   │   - Warn: Save in secure location                        │
   └──────────────────────────────────────────────────────────┘

2. Verification
   ┌──────────────────────────────────────────────────────────┐
   │ User Input                                               │
   │   Backup code from saved list                            │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Client-Side Processing                                   │
   │   1. Hash input code (SHA-256)                           │
   │   2. Query database for matching hash                    │
   │   3. Check used_at = NULL                                │
   │   4. If match found and unused, mark as used             │
   │   5. Return verification result                          │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Database Update                                          │
   │   UPDATE mfa_backup_codes                                │
   │   SET used_at = NOW()                                    │
   │   WHERE id = ?                                           │
   └───────────────────────┬──────────────────────────────────┘
                           │
                           ▼
   ┌──────────────────────────────────────────────────────────┐
   │ Result                                                   │
   │   Success: User logged in, code consumed                 │
   │   Failure: Invalid or already used code                  │
   └──────────────────────────────────────────────────────────┘
```

## Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Security Layers                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 1: Transport Security                                   │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • HTTPS enforced (production)                         │     │
│  │ • Secure cookies (httpOnly, sameSite)                 │     │
│  │ • HSTS headers                                        │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  Layer 2: Authentication                                       │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • AAL1: Email/password                                │     │
│  │ • AAL2: Email/password + TOTP                         │     │
│  │ • Session tokens (Supabase managed)                   │     │
│  │ • Rate limiting (5 attempts per 15 min)               │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  Layer 3: Data Protection                                      │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • TOTP secrets encrypted at rest (Supabase)           │     │
│  │ • Backup codes hashed (SHA-256)                       │     │
│  │ • QR codes never stored                               │     │
│  │ • Client-side QR rendering                            │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  Layer 4: Access Control                                       │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • Row Level Security (RLS) on all tables              │     │
│  │ • User isolation (can only access own data)           │     │
│  │ • Middleware route protection                         │     │
│  │ • AAL-based access control                            │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  Layer 5: Application Security                                │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • Input validation                                    │     │
│  │ • CSRF protection                                     │     │
│  │ • XSS prevention                                      │     │
│  │ • Error handling (no info leakage)                    │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      Technology Stack                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend                                                       │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • React 19.2.3                                        │     │
│  │ • Next.js 16.1.4                                      │     │
│  │ • TypeScript 5.x                                      │     │
│  │ • qrcode.react (QR code rendering)                    │     │
│  │ • Tailwind CSS (styling)                              │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  Backend                                                        │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • Supabase Auth (MFA provider)                        │     │
│  │ • PostgreSQL (database)                               │     │
│  │ • Row Level Security (RLS)                            │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
│  Security                                                       │
│  ┌───────────────────────────────────────────────────────┐     │
│  │ • TOTP (RFC 6238)                                     │     │
│  │ • SHA-256 (backup code hashing)                       │     │
│  │ • Web Crypto API                                      │     │
│  │ • AES-256 (Supabase secret encryption)                │     │
│  └───────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
