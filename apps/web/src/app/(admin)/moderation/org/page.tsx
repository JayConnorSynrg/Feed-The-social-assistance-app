// apps/web/src/app/(admin)/moderation/org/page.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Your organizations": the organizations the signed-in user may administer, from
// get_admin_org_list() (an organization admin: the active non-business organizations they admin;
// a platform admin: every active non-business organization). Exactly one -> straight to its admin
// page; otherwise a short list of links. The Settings "Administration" entry of an organization
// admin with no tier leads here.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { orgAdminHref } from '@/lib/org-admin-paths'

interface AdminOrgRow {
  id: string
  name: string
}

export default async function OrgAdminIndexPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_admin_org_list')
  if (error) throw new Error(error.message)
  const orgs = (data ?? []) as AdminOrgRow[]
  if (orgs.length === 1) redirect(orgAdminHref(orgs[0].id))

  return (
    <main className="min-h-screen bg-stone-100 px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-xl font-bold text-stone-900">Your organizations</h1>
        <p className="mt-1 text-sm text-stone-600">Choose an organization to manage its events, profile and members.</p>
        {orgs.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-700">
            You do not manage any active organization right now.
          </p>
        ) : (
          <ul className="mt-6 divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white shadow-sm">
            {orgs.map((o) => (
              <li key={o.id}>
                <Link
                  href={orgAdminHref(o.id)}
                  className="flex min-h-12 items-center gap-3 px-4 py-3 text-stone-900 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand"
                >
                  <Building2 className="h-4 w-4 shrink-0 text-stone-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate font-medium">{o.name}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-stone-500 rtl:rotate-180" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
