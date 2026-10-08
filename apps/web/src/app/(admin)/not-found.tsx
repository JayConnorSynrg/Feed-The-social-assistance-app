// apps/web/src/app/(admin)/not-found.tsx
// Owner: Jelal Connor / SYNRG SCALING, LLC
//
// "Not found" for the admin route group: notFound() in an admin page (e.g. /moderation/org/<id> for
// an unknown, malformed, business or — for its own admins — deactivated organization) renders this
// inside (admin)/layout.tsx, so the layout's "Back to feed" bar stays above it. It offers no link of
// its own: that bar is the one way back, and a second identical link in one view is what I1 rules out.

export default function AdminNotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: 'url(/images/wheat-field-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-lime-50/60 via-stone-50/40 to-lime-100/50" />
      <div className="relative z-10 text-center space-y-4 bg-stone-50/95 text-stone-800 backdrop-blur-sm border border-lime-200/60 rounded-2xl p-10 shadow-xl max-w-md w-full">
        <div className="text-4xl" aria-hidden="true">🌾</div>
        <h1 className="text-2xl font-bold text-stone-800">Page not found</h1>
        <p className="text-stone-600 text-sm">
          This admin page doesn’t exist, or you don’t have access to it. Use the link at the top of the page to
          return to the feed.
        </p>
      </div>
    </div>
  )
}
