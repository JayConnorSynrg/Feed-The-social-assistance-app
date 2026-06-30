// prod-client.ts — shared read-only Supabase Management API client
// Owner: Jelal Connor / SYNRG SCALING, LLC

import * as fs from 'fs'
import * as path from 'path'

const PROJECT_REF = 'ndtpovonpadugthmcntl'
const MGMT_API_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`

// Write-guard: reject SQL that starts with or contains a bare mutating statement.
// Matches INSERT/UPDATE/DELETE/ALTER/DROP/TRUNCATE as SQL verbs (preceded by
// whitespace, semicolon, or start-of-string) — not as string literals in quotes.
// Quoted occurrences like has_table_privilege('authenticated','t','INSERT') are safe.
export const WRITE_GUARD_RE =
  /(?:^|;|\n)\s*(insert|update|delete|alter|drop|truncate)\s/i

function getEnvLocalPath(): string {
  // When vitest runs from apps/web/ (including worktrees), cwd is apps/web/.
  // Try cwd-relative first, then walk up to find the canonical apps/web/.env.local
  // This handles git worktrees where the env file lives in the main checkout.
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    // git worktree: ../../../.. walks up to the worktree root → then descend to main apps/web
    path.resolve(process.cwd(), '..', '..', '..', '..', '..', 'FEED.', 'apps', 'web', '.env.local'),
    // Direct path to the main checkout for this project
    '/Users/jelalconnor/CODING/CURSOR/FEED./apps/web/.env.local',
  ]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      // continue
    }
  }
  return candidates[0] // default to cwd-relative even if not found
}

function loadToken(): string | null {
  // 1. Environment variable (CI / configured envs)
  const fromEnv = process.env.SUPABASE_ACCESS_TOKEN
  if (fromEnv && fromEnv.length > 10) return fromEnv

  // 2. Fall back to apps/web/.env.local
  try {
    const envPath = getEnvLocalPath()
    const content = fs.readFileSync(envPath, 'utf-8')
    const match = content.match(/^SUPABASE_ACCESS_TOKEN=["']?([^\s"']+)["']?\s*$/m)
    if (match && match[1]) return match[1].trim()
  } catch {
    // File not found or unreadable — silently return null
  }
  return null
}

export function isTokenAvailable(): boolean {
  return loadToken() !== null
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function queryProd(
  sql: string,
  retries = 4,
): Promise<Record<string, unknown>[]> {
  // Write-guard — reject mutating SQL before it ever reaches the API
  if (WRITE_GUARD_RE.test(sql)) {
    throw new Error(`WRITE-GUARD: mutating SQL rejected. Snippet: "${sql.slice(0, 120)}"`)
  }

  const token = loadToken()
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN not available — set env var or add to apps/web/.env.local')
  }

  let lastError: Error | undefined
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 3s, 6s, 12s, 24s — handles 429 rate-limiting
      await sleep(3000 * Math.pow(2, attempt - 1))
    }

    const res = await fetch(MGMT_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    })

    if (res.status === 429) {
      // Rate-limited — retry after backoff
      lastError = new Error(`Supabase Mgmt API 429: Too Many Requests (attempt ${attempt + 1}/${retries + 1})`)
      continue
    }

    if (!res.ok) {
      const body = await res.text()
      // Redact the token if it appears in the error body (safety measure)
      const safeBody = body.replace(
        new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        '[REDACTED]'
      )
      throw new Error(`Supabase Mgmt API ${res.status}: ${safeBody}`)
    }

    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as Record<string, unknown>[]) : []
  }

  throw lastError ?? new Error('queryProd: exhausted retries with no response')
}
