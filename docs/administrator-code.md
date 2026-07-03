# Administrator Code

## What It Is

The **Administrator** role (internally `facilitator`) grants `is_admin = true` on the user's profile, enabling access to FEED admin capabilities. Selecting this role at onboarding requires a valid administrator code.

## How It Works

1. A user selects "Administrator" on the onboarding role screen and enters a code.
2. The client calls the `claim-facilitator-admin` Supabase Edge Function.
3. The edge function verifies the code server-side using a constant-time HMAC comparison.
4. On a valid code, the function sets `is_admin = true` and `user_role = 'facilitator'` on the profile row, then inserts an audit record and writes to `audit_log`.
5. Rate-limited: 5 failed attempts per user per hour before a 429 is returned.
6. The client NEVER sets `is_admin` directly — it is only set by this edge function.

## Hash Contract

```
FACILITATOR_ADMIN_CODE_HASH = hex(HMAC-SHA256(FACILITATOR_ADMIN_CODE_PEPPER, plaintext_code))
```

Both `FACILITATOR_ADMIN_CODE_HASH` and `FACILITATOR_ADMIN_CODE_PEPPER` are Supabase Edge Function secrets — never committed to the repo.

## Code Rotation

To rotate the administrator code:

1. Generate a new random code (recommended: 24 characters, alphanumeric).
2. Compute the new hash: `echo -n "<CODE>" | openssl dgst -sha256 -hmac "<PEPPER>" | awk '{print $2}'`
3. Update the `FACILITATOR_ADMIN_CODE_HASH` edge secret to the new hex value.
4. Optionally rotate `FACILITATOR_ADMIN_CODE_PEPPER` — if you do, recompute the hash with the new pepper.
5. Distribute the new plaintext code out-of-band (e.g., in a secure channel).
6. The previous code is immediately invalidated.

## Local Reference (git-ignored)

Store the current plaintext code in `.admin-code.local.md` (gitignored). **Never commit this file.**

## Security Properties

- Constant-time comparison prevents timing attacks on the code.
- No plaintext code or hash is ever logged or returned to the client.
- The `admin_code_redemptions` table is immutable (append-only audit log).
- Only `service_role` can read the audit table — no user-facing policies.
- Failed attempts are rate-limited before the code comparison runs.
