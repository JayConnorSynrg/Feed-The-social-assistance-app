'use client'

// apps/web/src/components/layout/panel-error-boundary.tsx
// Panel-level error boundary — the shell stays mounted if a panel throws.
//
// Focus: the fallback message receives focus when it appears, so keyboard and
// screen-reader users land on it instead of a now-removed panel element (focus
// alone announces it; a role="alert" on top would announce it twice). "Try
// again" removes the focused button either way — React remounts the boundary's
// children — so after the retry commits, focus goes to the re-shown message
// (retry failed) or the returned panel's first <h1> (retry succeeded).
//
// Language: the fallback is in the viewer's language (useProfileLocale, read by PanelErrorFallback —
// a class component cannot call the hook), marked lang/dir on its own root.

import React from 'react'
import { logger } from '@/lib/logger'
import { focusWithin } from '@/lib/focus-target'
import { dir, t } from '@/lib/i18n'
import { errorsT } from '@/lib/i18n-errors'
import { useProfileLocale } from '@/hooks/use-profile-locale'

type Props = { children: React.ReactNode }
type State = { hasError: boolean; error: Error | null }

export class PanelErrorBoundary extends React.Component<Props, State> {
  readonly messageRef = React.createRef<HTMLParagraphElement>()
  readonly fallbackRef = React.createRef<HTMLDivElement>()

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  // A child that throws during the boundary's FIRST render commits the fallback
  // via componentDidMount (componentDidUpdate does not run on mount).
  componentDidMount() {
    if (this.state.hasError) this.messageRef.current?.focus()
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (this.state.hasError && !prevState.hasError) this.messageRef.current?.focus()
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Persist one error row (code + capped message); the component stack stays console-only.
    logger.error('panel.error.boundary', error, { surface: 'panel' })
    console.error('Panel error component stack:', info.componentStack)
  }

  /** "Try again": clear the error, then focus the re-shown message or the returned panel. */
  readonly retry = () => {
    // The fallback renders no wrapper of its own, so its parent is the panel host,
    // which survives the retry.
    const host = this.fallbackRef.current?.parentElement ?? null
    this.setState({ hasError: false, error: null }, () => {
      focusWithin(host, this.messageRef.current)
    })
  }

  render() {
    if (this.state.hasError) {
      return <PanelErrorFallback fallbackRef={this.fallbackRef} messageRef={this.messageRef} onRetry={this.retry} />
    }
    return this.props.children
  }
}

/** The fallback's markup, in the viewer's language. The refs and the retry stay the boundary's. */
function PanelErrorFallback({
  fallbackRef,
  messageRef,
  onRetry,
}: {
  fallbackRef: React.RefObject<HTMLDivElement | null>
  messageRef: React.RefObject<HTMLParagraphElement | null>
  onRetry: () => void
}) {
  const locale = useProfileLocale()
  return (
    <div ref={fallbackRef} lang={locale} dir={dir(locale)} className="flex flex-col items-center justify-center h-64 gap-4 text-center p-6">
      <div className="text-3xl" aria-hidden="true">🌾</div>
      <p
        ref={messageRef}
        tabIndex={-1}
        className="text-stone-600 text-sm rounded focus:outline-none focus:ring-2 focus:ring-lime-700 focus:ring-offset-2"
      >
        {errorsT(locale, 'panelError')}
      </p>
      <button className="inline-flex min-h-6 items-center px-2 text-sm text-lime-700 underline" onClick={onRetry}>
        {t(locale, 'tryAgain')}
      </button>
    </div>
  )
}
