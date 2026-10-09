import { AdminShell } from './admin-shell'
import { AdminFocusTabGate } from './admin-focus-tab-gate'

export default function ModerationPage() {
  return (
    <>
      <AdminShell />
      {/* Answers an "Edit in admin" link whose tab this tier does not show (admin-focus-tab-gate.tsx). */}
      <AdminFocusTabGate />
    </>
  )
}
