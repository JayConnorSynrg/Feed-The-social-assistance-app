/**
 * Minimal iframe-safe layout for the embed widget route.
 *
 * The parent (social)/layout.tsx wraps content in a full-page gradient with
 * max-width centering — acceptable on desktop but heavy for a 220px iframe.
 * This per-route layout provides a bare wrapper so the card fills the frame
 * without padding artifacts or background bleed from the outer shell.
 */
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white min-h-0">
      {children}
    </div>
  )
}
