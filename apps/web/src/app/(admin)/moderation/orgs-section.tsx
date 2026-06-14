'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type OrgType = 'food_bank' | 'pantry' | 'shelter' | 'clinic' | 'mutual_aid' | 'other'
type MemberRole = 'admin' | 'member'

interface Org {
  id: string
  name: string
  org_type: string
  is_active: boolean
  description: string | null
}

interface OrgMember {
  id: string
  user_id: string
  role: string
  joined_at: string
}

const ORG_TYPE_LABELS: Record<string, string> = {
  food_bank: 'Food Bank',
  pantry: 'Pantry',
  shelter: 'Shelter',
  clinic: 'Clinic',
  mutual_aid: 'Mutual Aid',
  other: 'Other',
}

export function OrgsSection() {
  const supabase = createClient()

  const [orgs, setOrgs] = useState<Org[]>([])
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [members, setMembers] = useState<OrgMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)

  // Create org form
  const [createName, setCreateName] = useState('')
  const [createOrgType, setCreateOrgType] = useState<OrgType>('food_bank')
  const [createDescription, setCreateDescription] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Add member form
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState<MemberRole>('member')
  const [addingMember, setAddingMember] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)

  const fetchOrgs = useCallback(async () => {
    setLoadingOrgs(true)
    const { data } = await supabase
      .from('organizations')
      .select('id, name, org_type, is_active, description')
      .order('name')
    setOrgs(data ?? [])
    setLoadingOrgs(false)
  }, [supabase])

  const fetchMembers = useCallback(async (orgId: string) => {
    setLoadingMembers(true)
    const { data } = await supabase
      .from('organization_members')
      .select('id, user_id, role, joined_at')
      .eq('org_id', orgId)
    setMembers(data ?? [])
    setLoadingMembers(false)
  }, [supabase])

  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  const handleSelectOrg = useCallback((orgId: string) => {
    if (selectedOrgId === orgId) {
      setSelectedOrgId(null)
      setMembers([])
    } else {
      setSelectedOrgId(orgId)
      fetchMembers(orgId)
    }
  }, [selectedOrgId, fetchMembers])

  const handleCreateOrg = useCallback(async () => {
    if (!createName.trim()) return
    setCreating(true)
    setCreateError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('organizations')
        .insert({
          name: createName.trim(),
          org_type: createOrgType,
          description: createDescription.trim() || null,
          created_by: user?.id,
        })
      if (error) {
        setCreateError(error.message)
      } else {
        setCreateName('')
        setCreateOrgType('food_bank')
        setCreateDescription('')
        await fetchOrgs()
      }
    } finally {
      setCreating(false)
    }
  }, [supabase, createName, createOrgType, createDescription, fetchOrgs])

  const handleAddMember = useCallback(async () => {
    if (!selectedOrgId || !addUserId.trim()) return
    setAddingMember(true)
    setAddMemberError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('organization_members')
        .insert({
          org_id: selectedOrgId,
          user_id: addUserId.trim(),
          role: addRole,
          invited_by: user?.id,
        })
      if (error) {
        setAddMemberError(error.message)
      } else {
        setAddUserId('')
        setAddRole('member')
        await fetchMembers(selectedOrgId)
      }
    } finally {
      setAddingMember(false)
    }
  }, [supabase, selectedOrgId, addUserId, addRole, fetchMembers])

  const handleRemoveMember = useCallback(async (memberId: string) => {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', memberId)
    if (!error && selectedOrgId) {
      await fetchMembers(selectedOrgId)
    }
  }, [supabase, selectedOrgId, fetchMembers])

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#4a5d23]">Organizations</h2>
        <p className="text-stone-600 mt-1 text-sm">
          Manage partner organizations and their membership rosters.
        </p>
      </div>

      {/* Create org form */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-stone-100 mb-6">
        <h3 className="text-base font-semibold text-[#4a5d23] mb-4">Create Organization</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-name" className="text-stone-700 text-sm">Name</Label>
            <Input
              id="org-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Organization name"
              className="text-stone-900 placeholder:text-stone-400"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-type" className="text-stone-700 text-sm">Type</Label>
            <Select value={createOrgType} onValueChange={(v) => setCreateOrgType(v as OrgType)}>
              <SelectTrigger id="org-type" className="text-stone-900">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="food_bank">Food Bank</SelectItem>
                <SelectItem value="pantry">Pantry</SelectItem>
                <SelectItem value="shelter">Shelter</SelectItem>
                <SelectItem value="clinic">Clinic</SelectItem>
                <SelectItem value="mutual_aid">Mutual Aid</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="org-desc" className="text-stone-700 text-sm">Description</Label>
            <Textarea
              id="org-desc"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="text-stone-900 placeholder:text-stone-400 resize-none"
            />
          </div>
        </div>
        {createError && (
          <p className="text-red-600 text-sm mt-2">{createError}</p>
        )}
        <Button
          onClick={handleCreateOrg}
          disabled={creating || !createName.trim()}
          className="mt-4 bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
        >
          {creating ? 'Creating…' : 'Create Organization'}
        </Button>
      </div>

      {/* Org list */}
      <div className="bg-white rounded-2xl shadow-sm p-6 border border-stone-100">
        <h3 className="text-base font-semibold text-[#4a5d23] mb-4">
          Organizations {!loadingOrgs && `(${orgs.length})`}
        </h3>

        {loadingOrgs ? (
          <p className="text-stone-500 text-sm">Loading…</p>
        ) : orgs.length === 0 ? (
          <p className="text-stone-500 text-sm">No organizations yet.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {orgs.map((org) => (
              <div key={org.id}>
                {/* Org row — click to expand */}
                <button
                  onClick={() => handleSelectOrg(org.id)}
                  className="w-full flex items-center justify-between py-3 px-1 text-left hover:bg-stone-50 rounded transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-stone-800">{org.name}</span>
                    <Badge variant="outline" className="text-xs text-[#4a5d23] border-[#4a5d23]/30">
                      {ORG_TYPE_LABELS[org.org_type] ?? org.org_type}
                    </Badge>
                    {!org.is_active && (
                      <Badge variant="outline" className="text-xs text-stone-500 border-stone-300">
                        Inactive
                      </Badge>
                    )}
                  </div>
                  <span className="text-stone-400 text-xs">{selectedOrgId === org.id ? '▲' : '▼'}</span>
                </button>

                {/* Expanded member panel */}
                {selectedOrgId === org.id && (
                  <div className="pb-4 px-2">
                    {org.description && (
                      <p className="text-stone-600 text-sm mb-3">{org.description}</p>
                    )}

                    {/* Add member form */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      <Input
                        value={addUserId}
                        onChange={(e) => setAddUserId(e.target.value)}
                        placeholder="User UUID"
                        className="text-stone-900 placeholder:text-stone-400 w-64 text-sm"
                      />
                      <Select value={addRole} onValueChange={(v) => setAddRole(v as MemberRole)}>
                        <SelectTrigger className="w-28 text-sm text-stone-900">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleAddMember}
                        disabled={addingMember || !addUserId.trim()}
                        size="sm"
                        className="bg-[#4a5d23] hover:bg-[#3d4d1c] text-white"
                      >
                        {addingMember ? 'Adding…' : 'Add Member'}
                      </Button>
                    </div>
                    {addMemberError && (
                      <p className="text-red-600 text-xs mb-2">{addMemberError}</p>
                    )}

                    {/* Member list */}
                    {loadingMembers ? (
                      <p className="text-stone-500 text-sm">Loading members…</p>
                    ) : members.length === 0 ? (
                      <p className="text-stone-500 text-sm">No members yet.</p>
                    ) : (
                      <div className="rounded-lg border border-stone-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-stone-50">
                            <tr>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">User ID</th>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Role</th>
                              <th className="text-left px-3 py-2 text-stone-600 font-medium">Joined</th>
                              <th className="px-3 py-2" />
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {members.map((m) => (
                              <tr key={m.id} className="hover:bg-stone-50">
                                <td className="px-3 py-2 font-mono text-xs text-stone-700 truncate max-w-[180px]">
                                  {m.user_id}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs ${m.role === 'admin' ? 'text-[#4a5d23] border-[#4a5d23]/30' : 'text-stone-500 border-stone-300'}`}
                                  >
                                    {m.role}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2 text-stone-500 text-xs">
                                  {new Date(m.joined_at).toLocaleDateString()}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button
                                    onClick={() => handleRemoveMember(m.id)}
                                    className="text-red-500 hover:text-red-700 text-xs font-medium"
                                  >
                                    Remove
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
