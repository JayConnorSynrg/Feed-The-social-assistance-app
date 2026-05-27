'use client'

// apps/web/src/components/panels/index.tsx
// Panel exports and dynamic panel renderer

// Core panels (available to all users)
export { ChatPanel } from './chat-panel'
export { MapPanel } from './map-panel'
export { OverviewPanel } from './overview-panel'
export { FeedPanel } from './feed-panel'
export { SettingsPanel } from './settings-panel'
export { DocumentsPanel } from './documents-panel'

// Role-restricted panels (Phase 2)
export { ApplicationsPanel } from './applications-panel'
export { FormsPanel } from './forms-panel'
export { ProgramsPanel } from './programs-panel'
