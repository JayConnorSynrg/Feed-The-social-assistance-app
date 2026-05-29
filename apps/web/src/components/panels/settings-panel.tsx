'use client'

// apps/web/src/components/panels/settings-panel.tsx
// Settings panel - User preferences, account settings, and profile management
// Two-column layout: Settings Navigation | Settings Content

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  User,
  Bell,
  Shield,
  Settings,
  Eye,
  ChevronRight,
  Save,
  X,
  Camera,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MFAEnrollment } from '@/components/auth/mfa-enrollment'
import { SecurityActivity } from '@/components/security/security-activity'
import { useAuth } from '@/hooks/use-auth'
import { createClient } from '@/lib/supabase/client'
import { normalizeState } from '@/lib/us-states'

// ============================================
// TYPES
// ============================================
type SettingsSection = 'profile' | 'notifications' | 'privacy' | 'account' | 'accessibility'

interface SettingsPanelProps {
  userRole?: string
}

interface SettingsData {
  profile: {
    name: string
    email: string
    phone: string
    location: string
  }
  notifications: {
    emailUpdates: boolean
    pushNotifications: boolean
    applicationUpdates: boolean
    communityPosts: boolean
    resourceAlerts: boolean
  }
  privacy: {
    profileVisible: boolean
    shareLocation: boolean
    shareActivity: boolean
    allowMessages: boolean
  }
  accessibility: {
    highContrast: boolean
    largeText: boolean
    reduceMotion: boolean
  }
}

const DEFAULT_SETTINGS: SettingsData = {
  profile: {
    name: '',
    email: '',
    phone: '',
    location: ''
  },
  notifications: {
    emailUpdates: true,
    pushNotifications: true,
    applicationUpdates: true,
    communityPosts: false,
    resourceAlerts: true
  },
  privacy: {
    profileVisible: true,
    shareLocation: false,
    shareActivity: true,
    allowMessages: true
  },
  accessibility: {
    highContrast: false,
    largeText: false,
    reduceMotion: false
  }
}

const SETTINGS_NAV = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy', icon: Shield },
  { id: 'account', label: 'Account', icon: Settings },
  { id: 'accessibility', label: 'Accessibility', icon: Eye },
] as const

// ============================================
// SETTINGS NAV ITEM
// ============================================
interface SettingsNavItemProps {
  id: SettingsSection
  label: string
  icon: React.ElementType
  isActive: boolean
  onClick: () => void
}

function SettingsNavItem({ id, label, icon: Icon, isActive, onClick }: SettingsNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        isActive
          ? 'bg-[#4a5d23] text-white'
          : 'text-stone-700 hover:bg-[#f0ede6]'
      }`}
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="text-sm font-medium hidden sm:inline">{label}</span>
      {isActive && <ChevronRight className="w-4 h-4 ml-auto hidden sm:inline" />}
    </button>
  )
}

// ============================================
// SETTINGS SECTION
// ============================================
interface SettingsSectionProps {
  title: string
  description?: string
  children: React.ReactNode
}

function SettingsSection({ title, description, children }: SettingsSectionProps) {
  return (
    <div className="mb-8">
      <div className="mb-4">
        <h3 className="font-semibold text-lg mb-1">{title}</h3>
        {description && (
          <p className="text-sm text-stone-600">{description}</p>
        )}
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  )
}

// ============================================
// TOGGLE ROW
// ============================================
interface ToggleRowProps {
  label: string
  description?: string
  value: boolean
  onChange: (value: boolean) => void
}

function ToggleRow({ label, description, value, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
      <div className="flex-1">
        <p className="font-medium text-sm mb-0.5">{label}</p>
        {description && (
          <p className="text-xs text-stone-600">{description}</p>
        )}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          value ? 'bg-[#4a5d23]' : 'bg-stone-300'
        }`}
      >
        <span
          className={`block w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}

// ============================================
// INPUT ROW
// ============================================
interface InputRowProps {
  label: string
  icon?: React.ElementType
  value: string
  onChange: (value: string) => void
  type?: string
  disabled?: boolean
}

function InputRow({ label, icon: Icon, value, onChange, type = 'text', disabled = false }: InputRowProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium flex items-center gap-2">
        {Icon && <Icon className="w-4 h-4 text-stone-600" />}
        {label}
      </label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="bg-[#faf9f6]"
      />
    </div>
  )
}

// ============================================
// PROFILE SECTION
// ============================================
interface ProfileSectionProps {
  profile: SettingsData['profile']
  onUpdate: (profile: SettingsData['profile']) => void
  saving?: boolean
}

function ProfileSection({ profile, onUpdate, saving }: ProfileSectionProps) {
  const [editMode, setEditMode] = useState(false)
  const [localProfile, setLocalProfile] = useState(profile)

  const handleSave = () => {
    onUpdate(localProfile)
    setEditMode(false)
  }

  const handleCancel = () => {
    setLocalProfile(profile)
    setEditMode(false)
  }

  return (
    <SettingsSection
      title="Profile Information"
      description="Manage your personal information and how others see you"
    >
      {/* Avatar */}
      <div className="flex items-center gap-4 p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-[#4a5d23] flex items-center justify-center text-white text-xl font-semibold">
            {profile.name.split(' ').map(n => n[0]).join('')}
          </div>
          {editMode && (
            <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
              <Camera className="w-3 h-3 text-white" />
            </button>
          )}
        </div>
        <div className="flex-1">
          <p className="font-medium">{profile.name}</p>
          <p className="text-sm text-stone-600">{profile.email}</p>
        </div>
        {!editMode && (
          <Button size="sm" variant="outline" onClick={() => setEditMode(true)}>
            Edit
          </Button>
        )}
      </div>

      {/* Editable Fields */}
      {editMode ? (
        <>
          <InputRow
            label="Full Name"
            icon={User}
            value={localProfile.name}
            onChange={(name) => setLocalProfile({ ...localProfile, name })}
          />
          <InputRow
            label="Email Address"
            icon={Mail}
            value={localProfile.email}
            onChange={(email) => setLocalProfile({ ...localProfile, email })}
            type="email"
          />
          <InputRow
            label="Phone Number"
            icon={Phone}
            value={localProfile.phone}
            onChange={(phone) => setLocalProfile({ ...localProfile, phone })}
            type="tel"
          />
          <InputRow
            label="Location"
            icon={MapPin}
            value={localProfile.location}
            onChange={(location) => setLocalProfile({ ...localProfile, location })}
          />

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} className="flex-1" disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1" disabled={saving}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
              <p className="text-xs text-stone-600 mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Phone
              </p>
              <p className="text-sm font-medium">{profile.phone}</p>
            </div>
            <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
              <p className="text-xs text-stone-600 mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                Location
              </p>
              <p className="text-sm font-medium">{profile.location}</p>
            </div>
          </div>
        </>
      )}
    </SettingsSection>
  )
}

// ============================================
// NOTIFICATION SECTION
// ============================================
interface NotificationSectionProps {
  notifications: SettingsData['notifications']
  onUpdate: (notifications: SettingsData['notifications']) => void
}

function NotificationSection({ notifications, onUpdate }: NotificationSectionProps) {
  const handleToggle = (key: keyof SettingsData['notifications']) => {
    onUpdate({ ...notifications, [key]: !notifications[key] })
  }

  return (
    <SettingsSection
      title="Notification Preferences"
      description="Choose what updates you want to receive"
    >
      <ToggleRow
        label="Email Updates"
        description="Receive updates and announcements via email"
        value={notifications.emailUpdates}
        onChange={() => handleToggle('emailUpdates')}
      />
      <ToggleRow
        label="Push Notifications"
        description="Get notifications on your mobile device"
        value={notifications.pushNotifications}
        onChange={() => handleToggle('pushNotifications')}
      />
      <ToggleRow
        label="Application Updates"
        description="Notifications about your benefit applications"
        value={notifications.applicationUpdates}
        onChange={() => handleToggle('applicationUpdates')}
      />
      <ToggleRow
        label="Community Posts"
        description="Updates when someone posts in your community"
        value={notifications.communityPosts}
        onChange={() => handleToggle('communityPosts')}
      />
      <ToggleRow
        label="Resource Alerts"
        description="Alerts about new resources near you"
        value={notifications.resourceAlerts}
        onChange={() => handleToggle('resourceAlerts')}
      />
    </SettingsSection>
  )
}

// ============================================
// PRIVACY SECTION
// ============================================
interface PrivacySectionProps {
  privacy: SettingsData['privacy']
  onUpdate: (privacy: SettingsData['privacy']) => void
}

function PrivacySection({ privacy, onUpdate }: PrivacySectionProps) {
  const handleToggle = (key: keyof SettingsData['privacy']) => {
    onUpdate({ ...privacy, [key]: !privacy[key] })
  }

  return (
    <SettingsSection
      title="Privacy & Data"
      description="Control your privacy settings and data sharing"
    >
      <ToggleRow
        label="Profile Visible"
        description="Allow others to view your profile"
        value={privacy.profileVisible}
        onChange={() => handleToggle('profileVisible')}
      />
      <ToggleRow
        label="Share Location"
        description="Share your location to find nearby resources"
        value={privacy.shareLocation}
        onChange={() => handleToggle('shareLocation')}
      />
      <ToggleRow
        label="Share Activity"
        description="Show your activity in the community feed"
        value={privacy.shareActivity}
        onChange={() => handleToggle('shareActivity')}
      />
      <ToggleRow
        label="Allow Messages"
        description="Let other users send you messages"
        value={privacy.allowMessages}
        onChange={() => handleToggle('allowMessages')}
      />
    </SettingsSection>
  )
}

// ============================================
// RELATIVE TIME HELPER
// ============================================
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`
  return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`
}

// ============================================
// ACCOUNT SECTION
// ============================================
function AccountSection() {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [showMFAEnrollment, setShowMFAEnrollment] = useState(false)
  const [showMFADisable, setShowMFADisable] = useState(false)
  const [loading, setLoading] = useState(false)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Password last-changed timestamp
  const [passwordLastChanged, setPasswordLastChanged] = useState<string | null>(null)

  const { signOut } = useAuth()
  const router = useRouter()

  // Check MFA status + fetch password timestamp on mount
  useEffect(() => {
    const checkMFAStatus = async () => {
      const { mfaService } = await import('@/lib/mfa')
      const enabled = await mfaService.isMFAEnabled()
      setMfaEnabled(enabled)
    }
    checkMFAStatus()

    const fetchPasswordTimestamp = async () => {
      try {
        const res = await fetch('/api/auth/password-last-changed')
        if (res.ok) {
          const { last_changed } = await res.json()
          if (last_changed) {
            setPasswordLastChanged(getRelativeTime(new Date(last_changed)))
          }
        }
      } catch {
        // Silently fall back to null — UI shows fallback text
      }
    }
    fetchPasswordTimestamp()
  }, [])

  const handleEnableMFA = () => {
    setShowMFAEnrollment(true)
  }

  const handleMFAEnrollmentSuccess = () => {
    setShowMFAEnrollment(false)
    setMfaEnabled(true)
  }

  const handleDisableMFA = async () => {
    setLoading(true)
    try {
      const { mfaService } = await import('@/lib/mfa')
      const factors = await mfaService.listFactors()
      const verifiedFactor = factors.find(f => f.status === 'verified')

      if (verifiedFactor) {
        const success = await mfaService.unenrollTOTP(verifiedFactor.id)
        if (success) {
          setMfaEnabled(false)
          setShowMFADisable(false)
        }
      }
    } catch (error) {
      console.error('Error disabling MFA:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteLoading(true)
    setDeleteError(null)

    // Use an AbortController with a 30-second timeout so the fetch is not
    // cancelled by component unmount or Next.js route transitions.
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30_000)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      if (!session?.access_token) {
        setDeleteError('No active session. Please sign in again.')
        setDeleteLoading(false)
        return
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/delete-account`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        }
      )

      clearTimeout(timeoutId)

      const body = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(body.error || body.message || `Request failed: ${res.status}`)
      }

      // Account deleted — sign out and redirect
      await signOut()
      router.push('/login')
    } catch (err) {
      clearTimeout(timeoutId)
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <SettingsSection
      title="Account Settings"
      description="Manage your account security and connected services"
    >
      <div className="space-y-4">
        {/* Password */}
        <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-sm">Password</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/forgot-password')}
            >
              Change
            </Button>
          </div>
          <p className="text-xs text-stone-600">
            {passwordLastChanged ? `Last changed ${passwordLastChanged}` : 'Loading...'}
          </p>
        </div>

        {/* Two-Factor Authentication */}
        {!showMFAEnrollment ? (
          <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="font-medium text-sm">Two-Factor Authentication</p>
                <p className="text-xs text-stone-600 mt-1">
                  {mfaEnabled ? 'Enabled - Your account is protected' : 'Add an extra layer of security'}
                </p>
              </div>
              {mfaEnabled ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowMFADisable(true)}
                  >
                    Disable
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnableMFA}
                >
                  Enable
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-white rounded-xl border-2 border-[#4a5d23]">
            <MFAEnrollment
              onSuccess={handleMFAEnrollmentSuccess}
              onCancel={() => setShowMFAEnrollment(false)}
            />
          </div>
        )}

        {/* Disable MFA Confirmation */}
        {showMFADisable && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <p className="font-medium text-sm text-amber-900 mb-2">Disable Two-Factor Authentication?</p>
            <p className="text-xs text-amber-800 mb-3">
              Your account will be less secure without 2FA. Are you sure?
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisableMFA}
                disabled={loading}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                {loading ? 'Disabling...' : 'Yes, Disable'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMFADisable(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Connected Accounts */}
        <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
          <p className="font-medium text-sm mb-3">Connected Accounts</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-white rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-semibold text-blue-800">G</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Google</p>
                  <p className="text-xs text-stone-600">Connected</p>
                </div>
              </div>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>

        {/* Security Activity */}
        <div className="p-4 bg-white rounded-xl border border-stone-200">
          <SecurityActivity />
        </div>

        {/* Delete Account */}
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          {!showDeleteConfirm ? (
            <>
              <p className="font-medium text-sm text-red-900 mb-1">Delete Account</p>
              <p className="text-xs text-red-700 mb-3">
                Permanently delete your account and all data
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-300 hover:bg-red-100"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </Button>
            </>
          ) : (
            <>
              <p className="font-medium text-sm text-red-900 mb-1">Are you sure? This cannot be undone.</p>
              <p className="text-xs text-red-700 mb-3">
                All your posts, messages, and personal data will be permanently removed.
              </p>
              {deleteError && (
                <p className="text-xs text-red-800 bg-red-100 rounded px-2 py-1 mb-3">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300 hover:bg-red-100"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                >
                  {deleteLoading ? (
                    <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Deleting...</>
                  ) : (
                    'Yes, delete everything'
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDeleteConfirm(false); setDeleteError(null) }}
                  disabled={deleteLoading}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </SettingsSection>
  )
}

// ============================================
// ACCESSIBILITY SECTION
// ============================================
interface AccessibilitySectionProps {
  accessibility: SettingsData['accessibility']
  onUpdate: (accessibility: SettingsData['accessibility']) => void
}

function AccessibilitySection({ accessibility, onUpdate }: AccessibilitySectionProps) {
  const handleToggle = (key: keyof SettingsData['accessibility']) => {
    onUpdate({ ...accessibility, [key]: !accessibility[key] })
  }

  return (
    <SettingsSection
      title="Accessibility"
      description="Adjust settings to improve your experience"
    >
      <ToggleRow
        label="High Contrast"
        description="Increase contrast for better visibility"
        value={accessibility.highContrast}
        onChange={() => handleToggle('highContrast')}
      />
      <ToggleRow
        label="Large Text"
        description="Increase text size throughout the app"
        value={accessibility.largeText}
        onChange={() => handleToggle('largeText')}
      />
      <ToggleRow
        label="Reduce Motion"
        description="Minimize animations and transitions"
        value={accessibility.reduceMotion}
        onChange={() => handleToggle('reduceMotion')}
      />
    </SettingsSection>
  )
}

// ============================================
// LOCAL PREFERENCES (notifications, privacy, accessibility)
// ============================================
const PREFS_KEY = 'feed-settings-prefs'

function loadLocalPrefs(): Omit<SettingsData, 'profile'> {
  if (typeof window === 'undefined') {
    return {
      notifications: DEFAULT_SETTINGS.notifications,
      privacy: DEFAULT_SETTINGS.privacy,
      accessibility: DEFAULT_SETTINGS.accessibility,
    }
  }
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return {
    notifications: DEFAULT_SETTINGS.notifications,
    privacy: DEFAULT_SETTINGS.privacy,
    accessibility: DEFAULT_SETTINGS.accessibility,
  }
}

function saveLocalPrefs(prefs: Omit<SettingsData, 'profile'>) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  } catch {}
}

// ============================================
// MAIN SETTINGS PANEL
// ============================================
export function SettingsPanel({ userRole }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const { user, profile, refreshSession } = useAuth()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)

  // Build profile settings from auth data
  const profileSettings: SettingsData['profile'] = {
    name: profile?.full_name || '',
    email: user?.email || '',
    phone: profile?.phone || '',
    location: [
      profile?.location_city,
      profile?.location_state
    ].filter(Boolean).join(', ') || '',
  }

  // Local preferences (notifications, privacy, accessibility)
  const [localPrefs, setLocalPrefs] = useState(loadLocalPrefs)

  const updateProfile = useCallback(async (newProfile: SettingsData['profile']) => {
    if (!user) return
    setSaving(true)
    setSaveMessage(null)

    // Parse location into city/state
    const locationParts = newProfile.location.split(',').map(s => s.trim())
    const city = locationParts[0] || null
    const state = locationParts[1] || null

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: newProfile.name,
          location_city: city,
          location_state: normalizeState(state),
          phone: newProfile.phone,
        })
        .eq('id', user.id)

      if (error) throw error

      // Refresh auth to pick up new profile
      await refreshSession()
      setSaveMessage('Profile updated successfully')
      setTimeout(() => setSaveMessage(null), 3000)
    } catch (err) {
      console.error('Error saving profile:', err)
      setSaveMessage('Failed to save changes')
      setTimeout(() => setSaveMessage(null), 3000)
    } finally {
      setSaving(false)
    }
  }, [user, supabase, refreshSession])

  const updateNotifications = (notifications: SettingsData['notifications']) => {
    const updated = { ...localPrefs, notifications }
    setLocalPrefs(updated)
    saveLocalPrefs(updated)
  }

  const updatePrivacy = (privacy: SettingsData['privacy']) => {
    const updated = { ...localPrefs, privacy }
    setLocalPrefs(updated)
    saveLocalPrefs(updated)
  }

  const updateAccessibility = (accessibility: SettingsData['accessibility']) => {
    const updated = { ...localPrefs, accessibility }
    setLocalPrefs(updated)
    saveLocalPrefs(updated)
  }

  return (
    <div className="h-full flex gap-6">
      {/* Save Status */}
      {saveMessage && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg ${
          saveMessage.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {saveMessage}
        </div>
      )}

      {/* Left Navigation */}
      <div className="w-12 sm:w-48 flex-shrink-0">
        <div className="space-y-1">
          {SETTINGS_NAV.map((nav) => (
            <SettingsNavItem
              key={nav.id}
              {...nav}
              isActive={activeSection === nav.id}
              onClick={() => setActiveSection(nav.id)}
            />
          ))}
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl">
          {activeSection === 'profile' && (
            <ProfileSection profile={profileSettings} onUpdate={updateProfile} saving={saving} />
          )}
          {activeSection === 'notifications' && (
            <NotificationSection notifications={localPrefs.notifications} onUpdate={updateNotifications} />
          )}
          {activeSection === 'privacy' && (
            <PrivacySection privacy={localPrefs.privacy} onUpdate={updatePrivacy} />
          )}
          {activeSection === 'account' && (
            <AccountSection />
          )}
          {activeSection === 'accessibility' && (
            <AccessibilitySection accessibility={localPrefs.accessibility} onUpdate={updateAccessibility} />
          )}
        </div>
      </div>
    </div>
  )
}
