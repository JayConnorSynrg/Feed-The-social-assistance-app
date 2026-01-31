'use client'

// apps/web/src/components/panels/settings-panel.tsx
// Settings panel - User preferences, account settings, and profile management
// Two-column layout: Settings Navigation | Settings Content

import React, { useState } from 'react'
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
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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

// ============================================
// MOCK DATA
// ============================================
const INITIAL_SETTINGS: SettingsData = {
  profile: {
    name: 'John Doe',
    email: 'john.doe@example.com',
    phone: '(555) 123-4567',
    location: 'San Francisco, CA'
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
          <p className="text-sm text-muted-foreground">{description}</p>
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
          <p className="text-xs text-muted-foreground">{description}</p>
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
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
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
}

function ProfileSection({ profile, onUpdate }: ProfileSectionProps) {
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
          <p className="text-sm text-muted-foreground">{profile.email}</p>
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
            <Button onClick={handleSave} className="flex-1">
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1">
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Phone className="w-3 h-3" />
                Phone
              </p>
              <p className="text-sm font-medium">{profile.phone}</p>
            </div>
            <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
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
// ACCOUNT SECTION
// ============================================
function AccountSection() {
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
            <Button variant="outline" size="sm">
              Change
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Last changed 3 months ago
          </p>
        </div>

        {/* Connected Accounts */}
        <div className="p-4 bg-[#faf9f6] rounded-xl border border-stone-200">
          <p className="font-medium text-sm mb-3">Connected Accounts</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 bg-white rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-xs font-semibold text-blue-600">G</span>
                </div>
                <div>
                  <p className="text-sm font-medium">Google</p>
                  <p className="text-xs text-muted-foreground">Connected</p>
                </div>
              </div>
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
        </div>

        {/* Delete Account */}
        <div className="p-4 bg-red-50 rounded-xl border border-red-200">
          <p className="font-medium text-sm text-red-900 mb-1">Delete Account</p>
          <p className="text-xs text-red-700 mb-3">
            Permanently delete your account and all data
          </p>
          <Button variant="outline" size="sm" className="text-red-600 border-red-300 hover:bg-red-100">
            Delete Account
          </Button>
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
// MAIN SETTINGS PANEL
// ============================================
export function SettingsPanel({ userRole }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile')
  const [settings, setSettings] = useState<SettingsData>(INITIAL_SETTINGS)

  const updateProfile = (profile: SettingsData['profile']) => {
    setSettings({ ...settings, profile })
  }

  const updateNotifications = (notifications: SettingsData['notifications']) => {
    setSettings({ ...settings, notifications })
  }

  const updatePrivacy = (privacy: SettingsData['privacy']) => {
    setSettings({ ...settings, privacy })
  }

  const updateAccessibility = (accessibility: SettingsData['accessibility']) => {
    setSettings({ ...settings, accessibility })
  }

  return (
    <div className="h-full flex gap-6">
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
            <ProfileSection profile={settings.profile} onUpdate={updateProfile} />
          )}
          {activeSection === 'notifications' && (
            <NotificationSection notifications={settings.notifications} onUpdate={updateNotifications} />
          )}
          {activeSection === 'privacy' && (
            <PrivacySection privacy={settings.privacy} onUpdate={updatePrivacy} />
          )}
          {activeSection === 'account' && (
            <AccountSection />
          )}
          {activeSection === 'accessibility' && (
            <AccessibilitySection accessibility={settings.accessibility} onUpdate={updateAccessibility} />
          )}
        </div>
      </div>
    </div>
  )
}
