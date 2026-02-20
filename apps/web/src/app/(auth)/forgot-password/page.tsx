'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?redirectTo=/reset-password`,
      })

      if (error) throw error

      setSubmitted(true)
    } catch (err: unknown) {
      // Next.js App Router aborts fetch during re-renders — treat abort as success
      if (
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.message.includes('signal'))
      ) {
        setSubmitted(true)
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
          <CardTitle className="text-2xl font-bold text-lime-800">Reset your password</CardTitle>
          <CardDescription className="text-stone-600">
            Enter your email and we'll send you a reset link
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 bg-lime-50/30 mx-4 rounded-lg p-4 -mt-2 mb-4">
          {submitted ? (
            <div className="text-center space-y-4 py-2">
              <p className="text-stone-700 font-medium">Check your email for a password reset link.</p>
              <p className="text-stone-500 text-sm">
                If you don't see it, check your spam folder.
              </p>
              <Link
                href="/login"
                className="inline-block text-sm text-lime-700 font-semibold underline hover:text-lime-900"
              >
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-stone-700">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                {loading ? 'Sending...' : 'Send reset link'}
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
