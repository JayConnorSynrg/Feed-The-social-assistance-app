/**
 * Temporary type definitions for audit_log table
 *
 * These types will be replaced when running:
 * npx supabase gen types typescript --linked > packages/database/types.ts
 *
 * after applying the audit_log migration
 */

export interface Database {
  public: {
    Tables: {
      audit_log: {
        Row: {
          id: string
          user_id: string | null
          session_id: string | null
          ip_address: string | null
          user_agent: string | null
          event_type: string
          event_category: string
          severity: string
          resource_type: string | null
          resource_id: string | null
          action: string
          details: Record<string, any> | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          event_type: string
          event_category: string
          severity?: string
          resource_type?: string | null
          resource_id?: string | null
          action: string
          details?: Record<string, any> | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_id?: string | null
          ip_address?: string | null
          user_agent?: string | null
          event_type?: string
          event_category?: string
          severity?: string
          resource_type?: string | null
          resource_id?: string | null
          action?: string
          details?: Record<string, any> | null
          created_at?: string
        }
      }
    }
  }
}
