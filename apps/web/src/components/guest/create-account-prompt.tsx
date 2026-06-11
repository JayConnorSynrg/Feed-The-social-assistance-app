'use client'

import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface CreateAccountPromptProps {
  /** Optional override message. Defaults to the standard guest-UX copy. */
  message?: string
}

/**
 * Shown to anonymous (guest) users in place of write-action surfaces.
 * Modelled after chat-panel's SignInPrompt but for guest sessions that
 * already have a Supabase user object — they just need a real account.
 */
export function CreateAccountPrompt({ message }: CreateAccountPromptProps) {
  const defaultMessage = "Create a free account to save your information and use this feature"
  return (
    <div
      className="flex flex-col items-center gap-3 p-4 bg-lime-50 rounded-lg border border-lime-200"
      data-testid="create-account-prompt"
    >
      <UserPlus className="h-6 w-6 text-lime-700" />
      <p className="text-sm text-stone-700 text-center">
        {message ?? defaultMessage}
      </p>
      <Button
        asChild
        className="bg-lime-700 hover:bg-lime-800 text-white font-medium"
        size="sm"
      >
        <Link href="/signup" data-testid="create-account-prompt-link">
          Create free account
        </Link>
      </Button>
    </div>
  )
}
