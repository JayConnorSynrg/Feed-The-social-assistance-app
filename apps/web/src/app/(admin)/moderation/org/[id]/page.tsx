// apps/web/src/app/(admin)/moderation/org/[id]/page.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// The organization admin page. Access is decided HERE, next to the data, by can_admin_org (SECURITY
// DEFINER): true for a platform admin (any non-business organization) or an admin of that active,
// non-business organization. A malformed id, an unknown organization and a refused caller all get
// the same notFound(), and no organization row is read before access is granted. (The (admin)
// layout only admits signed-in users with a tier or an organization role; proxy.ts sends signed-out
// requests to /login.)
//
// Logging: one first-party wide event per load, admin.org_page.load.complete with outcome ok |
// not_found (+ reason) and org_id when allowed, duration_ms in its own column, and the request id
// proxy.ts stamped on this request (the server log sink reads x-request-id). A failed access check
// throws (admin.org_page.load.error) and shows the admin error boundary for every id alike.

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { withMetric } from '@/lib/logger'
import { isUuid } from '@/lib/org-admin-paths'
import { OrgAdminShell, type OrgAdminOrg } from './org-admin-shell'

interface Props {
  params: Promise<{ id: string }>
}

type LoadAttrs = {
  outcome: 'ok' | 'not_found'
  org_id: string | null
  reason: 'malformed_id' | 'denied' | 'org_unreadable' | null
}

class OrgAdminAccessError extends Error {
  code: string | undefined
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'OrgAdminAccessError'
    this.code = code
  }
}

async function loadOrgAdminView(
  id: string,
  attrs: LoadAttrs
): Promise<{ org: OrgAdminOrg; isPlatformAdmin: boolean } | null> {
  if (!isUuid(id)) {
    attrs.reason = 'malformed_id'
    return null
  }
  const supabase = await createClient()
  const { data: allowed, error } = await supabase.rpc('can_admin_org', { p_org_id: id })
  if (error) throw new OrgAdminAccessError(error.message, error.code)
  if (allowed !== true) {
    attrs.reason = 'denied'
    return null
  }

  const [orgRes, adminRes] = await Promise.all([
    supabase.from('organizations').select('id, name, org_type, is_active, city, state').eq('id', id).maybeSingle(),
    supabase.rpc('is_current_user_admin'),
  ])
  if (orgRes.error) throw new OrgAdminAccessError(orgRes.error.message, orgRes.error.code)
  if (adminRes.error) throw new OrgAdminAccessError(adminRes.error.message, adminRes.error.code)
  if (!orgRes.data) {
    attrs.reason = 'org_unreadable'
    return null
  }

  attrs.outcome = 'ok'
  attrs.org_id = id
  return { org: orgRes.data as OrgAdminOrg, isPlatformAdmin: adminRes.data === true }
}

export default async function OrgAdminPage({ params }: Props) {
  const { id } = await params
  // withMetric reads attrs when the operation settles, so the outcome set inside lands on the row.
  const attrs: LoadAttrs = { outcome: 'not_found', org_id: null, reason: null }
  const view = await withMetric('admin.org_page.load', attrs, () => loadOrgAdminView(id, attrs))
  if (!view) notFound()
  return <OrgAdminShell org={view.org} isPlatformAdmin={view.isPlatformAdmin} />
}
