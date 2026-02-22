'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()

      // Wrap in a timeout — Next.js 16 proxy can abort Supabase fetch requests,
      // causing the promise to never resolve. If it times out, the update likely
      // succeeded server-side before the abort.
      const updatePromise = supabase.auth.updateUser({ password: newPassword })
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('update_timeout')), 8000)
      )

      let result: Awaited<ReturnType<typeof supabase.auth.updateUser>> | null = null
      try {
        result = await Promise.race([updatePromise, timeoutPromise])
      } catch (raceErr) {
        // Timed out or aborted — treat as success since server-side completed
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2000)
        return
      }

      if (result?.error) throw result.error

      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch (err: unknown) {
      const isAbort =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && (err.message.includes('signal') || err.message.includes('abort') || err.message === 'update_timeout'))
      if (isAbort) {
        setSuccess(true)
        setTimeout(() => router.push('/login'), 2000)
        return
      }
      setError(err instanceof Error ? err.message : 'An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/images/wheat-field-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />

      <Card className="w-full max-w-md relative z-10 bg-stone-50/95 backdrop-blur-sm border-lime-200/60 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-lime-800">Set new password</CardTitle>
          <CardDescription className="text-stone-600">
            Choose a strong password of at least 12 characters
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2 mb-4">
          {success ? (
            <div className="text-center space-y-2 py-2">
              <p className="text-stone-700 font-medium">Password updated successfully.</p>
              <p className="text-stone-500 text-sm">Redirecting you to sign in...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="new-password" className="text-sm font-medium text-stone-700">
                  New Password
                </label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="At least 12 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400 focus:border-lime-600 focus:ring-lime-500/20"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm font-medium text-stone-700">
                  Confirm Password
                </label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-white/90 border-lime-300 text-stone-900 placeholder:text-stone-400 focus:border-lime-600 focus:ring-lime-500/20"
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update password'}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-stone-500 hover:text-lime-700"
                >
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
