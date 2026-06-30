// prod-client.ts — read-only Supabase Management API client for smoke tests
// © Jelal Connor / SYNRG SCALING, LLC

import fs from 'fs';
import path from 'path';

const PROJECT_REF = 'ndtpovonpadugthmcntl';
const ENDPOINT = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

// WRITE-GUARD: reject any mutating SQL before any HTTP call is made
const WRITE_PATTERN = /\b(insert|update|delete|alter|drop|truncate)\b/i;

function loadToken(): string | undefined {
  // 1. Env var takes precedence
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    return process.env.SUPABASE_ACCESS_TOKEN;
  }
  // 2. .env.local fallback — apps/web/.env.local relative to this file
  try {
    const envPath = path.resolve(__dirname, '../../../../.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^SUPABASE_ACCESS_TOKEN=["']?([^"'\n]+)["']?/m);
    if (match) return match[1];
  } catch {
    // file not present or unreadable — skip silently
  }
  return undefined;
}

export function isTokenAvailable(): boolean {
  return !!loadToken();
}

export async function queryProd(sql: string): Promise<Record<string, unknown>[]> {
  if (WRITE_PATTERN.test(sql)) {
    throw new Error(`WRITE-GUARD: mutating SQL rejected — matches /\\b(insert|update|delete|alter|drop|truncate)\\b/i`);
  }

  const token = loadToken();
  if (!token) {
    throw new Error('SUPABASE_ACCESS_TOKEN not set — call isTokenAvailable() to skip');
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<Record<string, unknown>[]>;
}
