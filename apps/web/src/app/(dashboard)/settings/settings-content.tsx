'use client'

import { ProfileForm } from '@/components/profile/profile-form'
import { AvatarUpload } from '@/components/profile/avatar-upload'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Profile } from '@feed/database'

interface SettingsContentProps {
  profile: Profile | null
  userId: string
}

export function SettingsContent({ profile, userId }: SettingsContentProps) {
  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and profile information
        </p>
      </div>

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Profile Picture</CardTitle>
            <CardDescription>
              Upload a photo to personalize your profile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvatarUpload
              userId={userId}
              currentAvatarUrl={profile?.avatar_url || null}
              fullName={profile?.full_name || null}
            />
          </CardContent>
        </Card>

        <ProfileForm profile={profile} />
      </div>
    </div>
  )
}
