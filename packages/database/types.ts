export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      account_lockouts: {
        Row: {
          attempt_count: number | null
          created_at: string | null
          email: string
          last_attempt_at: string | null
          locked_until: string
          lockout_level: number | null
        }
        Insert: {
          attempt_count?: number | null
          created_at?: string | null
          email: string
          last_attempt_at?: string | null
          locked_until: string
          lockout_level?: number | null
        }
        Update: {
          attempt_count?: number | null
          created_at?: string | null
          email?: string
          last_attempt_at?: string | null
          locked_until?: string
          lockout_level?: number | null
        }
        Relationships: []
      }
      app_logs: {
        Row: {
          context: Json | null
          created_at: string
          event: string
          id: string
          level: string
          request_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string
          event: string
          id?: string
          level: string
          request_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string
          event?: string
          id?: string
          level?: string
          request_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          event_category: string
          event_type: string
          id: string
          ip_address: unknown
          resource_id: string | null
          resource_type: string | null
          session_id: string | null
          severity: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          event_category: string
          event_type: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          event_category?: string
          event_type?: string
          id?: string
          ip_address?: unknown
          resource_id?: string | null
          resource_type?: string | null
          session_id?: string | null
          severity?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      auth_login_attempts: {
        Row: {
          created_at: string | null
          email: string
          failure_reason: string | null
          id: string
          ip_address: unknown
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          success: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          failure_reason?: string | null
          id?: string
          ip_address?: unknown
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      community_stats: {
        Row: {
          active_users: number
          applications_submitted: number
          id: string
          posts_created: number
          resources_accessed: number
          stat_date: string
          updated_at: string
        }
        Insert: {
          active_users?: number
          applications_submitted?: number
          id?: string
          posts_created?: number
          resources_accessed?: number
          stat_date: string
          updated_at?: string
        }
        Update: {
          active_users?: number
          applications_submitted?: number
          id?: string
          posts_created?: number
          resources_accessed?: number
          stat_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          requester_id: string
          resource_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
          volunteer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          requester_id: string
          resource_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
          volunteer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          requester_id?: string
          resource_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      federated_instances: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          instance_url: string
          is_local: boolean
          last_seen_at: string | null
          metadata: Json | null
          public_key: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          instance_url: string
          is_local?: boolean
          last_seen_at?: string | null
          metadata?: Json | null
          public_key: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          instance_url?: string
          is_local?: boolean
          last_seen_at?: string | null
          metadata?: Json | null
          public_key?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      federated_resources: {
        Row: {
          address_line1: string | null
          city: string | null
          created_at: string
          description: string | null
          hours_of_operation: Json | null
          id: string
          is_verified: boolean | null
          last_synced_at: string
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          name: string
          phone: string | null
          resource_type: string
          source_instance_id: string
          source_resource_id: string
          state: string | null
          trust_score: number | null
          updated_at: string
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          hours_of_operation?: Json | null
          id?: string
          is_verified?: boolean | null
          last_synced_at?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          name: string
          phone?: string | null
          resource_type: string
          source_instance_id: string
          source_resource_id: string
          state?: string | null
          trust_score?: number | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          hours_of_operation?: Json | null
          id?: string
          is_verified?: boolean | null
          last_synced_at?: string
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          name?: string
          phone?: string | null
          resource_type?: string
          source_instance_id?: string
          source_resource_id?: string
          state?: string | null
          trust_score?: number | null
          updated_at?: string
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "federated_resources_source_instance_id_fkey"
            columns: ["source_instance_id"]
            isOneToOne: false
            referencedRelation: "federated_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federated_resources_source_instance_id_fkey"
            columns: ["source_instance_id"]
            isOneToOne: false
            referencedRelation: "federation_trust_overview"
            referencedColumns: ["instance_id"]
          },
        ]
      }
      federation_health_checks: {
        Row: {
          check_status: string
          checked_at: string
          error_message: string | null
          id: string
          instance_id: string
          response_time_ms: number | null
        }
        Insert: {
          check_status: string
          checked_at?: string
          error_message?: string | null
          id?: string
          instance_id: string
          response_time_ms?: number | null
        }
        Update: {
          check_status?: string
          checked_at?: string
          error_message?: string | null
          id?: string
          instance_id?: string
          response_time_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "federation_health_checks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "federated_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federation_health_checks_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "federation_trust_overview"
            referencedColumns: ["instance_id"]
          },
        ]
      }
      federation_peers: {
        Row: {
          auto_sync_enabled: boolean
          created_at: string
          federation_enabled: boolean
          id: string
          local_instance_id: string
          notes: string | null
          remote_instance_id: string
          shared_resource_categories: string[] | null
          sync_interval_minutes: number
          trust_level: string
          trust_score: number
          updated_at: string
          webhook_enabled: boolean
        }
        Insert: {
          auto_sync_enabled?: boolean
          created_at?: string
          federation_enabled?: boolean
          id?: string
          local_instance_id: string
          notes?: string | null
          remote_instance_id: string
          shared_resource_categories?: string[] | null
          sync_interval_minutes?: number
          trust_level?: string
          trust_score?: number
          updated_at?: string
          webhook_enabled?: boolean
        }
        Update: {
          auto_sync_enabled?: boolean
          created_at?: string
          federation_enabled?: boolean
          id?: string
          local_instance_id?: string
          notes?: string | null
          remote_instance_id?: string
          shared_resource_categories?: string[] | null
          sync_interval_minutes?: number
          trust_level?: string
          trust_score?: number
          updated_at?: string
          webhook_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "federation_peers_local_instance_id_fkey"
            columns: ["local_instance_id"]
            isOneToOne: false
            referencedRelation: "federated_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federation_peers_local_instance_id_fkey"
            columns: ["local_instance_id"]
            isOneToOne: false
            referencedRelation: "federation_trust_overview"
            referencedColumns: ["instance_id"]
          },
          {
            foreignKeyName: "federation_peers_remote_instance_id_fkey"
            columns: ["remote_instance_id"]
            isOneToOne: false
            referencedRelation: "federated_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federation_peers_remote_instance_id_fkey"
            columns: ["remote_instance_id"]
            isOneToOne: false
            referencedRelation: "federation_trust_overview"
            referencedColumns: ["instance_id"]
          },
        ]
      }
      federation_sync_log: {
        Row: {
          completed_at: string | null
          error_message: string | null
          id: string
          peer_id: string
          resources_created: number | null
          resources_deleted: number | null
          resources_fetched: number | null
          resources_updated: number | null
          started_at: string
          sync_duration_ms: number | null
          sync_status: string
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          peer_id: string
          resources_created?: number | null
          resources_deleted?: number | null
          resources_fetched?: number | null
          resources_updated?: number | null
          started_at?: string
          sync_duration_ms?: number | null
          sync_status: string
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          id?: string
          peer_id?: string
          resources_created?: number | null
          resources_deleted?: number | null
          resources_fetched?: number | null
          resources_updated?: number | null
          started_at?: string
          sync_duration_ms?: number | null
          sync_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "federation_sync_log_peer_id_fkey"
            columns: ["peer_id"]
            isOneToOne: false
            referencedRelation: "federation_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federation_sync_log_peer_id_fkey"
            columns: ["peer_id"]
            isOneToOne: false
            referencedRelation: "federation_trust_overview"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      federation_trust_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          metadata: Json | null
          new_trust_level: string | null
          new_trust_score: number
          old_trust_level: string | null
          old_trust_score: number
          peer_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          new_trust_level?: string | null
          new_trust_score: number
          old_trust_level?: string | null
          old_trust_score: number
          peer_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          new_trust_level?: string | null
          new_trust_score?: number
          old_trust_level?: string | null
          old_trust_score?: number
          peer_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "federation_trust_events_peer_id_fkey"
            columns: ["peer_id"]
            isOneToOne: false
            referencedRelation: "federation_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federation_trust_events_peer_id_fkey"
            columns: ["peer_id"]
            isOneToOne: false
            referencedRelation: "federation_trust_overview"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      federation_webhook_log: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          delivery_status: string
          error_message: string | null
          event_type: string
          http_status_code: number | null
          id: string
          peer_id: string
          resource_id: string
          resource_type: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          error_message?: string | null
          event_type: string
          http_status_code?: number | null
          id?: string
          peer_id: string
          resource_id: string
          resource_type: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          error_message?: string | null
          event_type?: string
          http_status_code?: number | null
          id?: string
          peer_id?: string
          resource_id?: string
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "federation_webhook_log_peer_id_fkey"
            columns: ["peer_id"]
            isOneToOne: false
            referencedRelation: "federation_peers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "federation_webhook_log_peer_id_fkey"
            columns: ["peer_id"]
            isOneToOne: false
            referencedRelation: "federation_trust_overview"
            referencedColumns: ["peer_id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string | null
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string | null
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          agency_name: string | null
          agency_reference_number: string | null
          case_number: string | null
          completion_percentage: number | null
          created_at: string | null
          current_step: number | null
          deadline: string | null
          encrypted_form_data: string | null
          encrypted_signature_data: string | null
          encryption_migrated: boolean | null
          encryption_migrated_at: string | null
          form_data: Json | null
          form_data_iv: string | null
          id: string
          last_status_change: string | null
          notes: string | null
          signature_data: string | null
          signature_data_iv: string | null
          signed_at: string | null
          status: Database["public"]["Enums"]["submission_status"] | null
          submitted_at: string | null
          template_id: string
          total_steps: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          agency_name?: string | null
          agency_reference_number?: string | null
          case_number?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          deadline?: string | null
          encrypted_form_data?: string | null
          encrypted_signature_data?: string | null
          encryption_migrated?: boolean | null
          encryption_migrated_at?: string | null
          form_data?: Json | null
          form_data_iv?: string | null
          id?: string
          last_status_change?: string | null
          notes?: string | null
          signature_data?: string | null
          signature_data_iv?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          submitted_at?: string | null
          template_id: string
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          agency_name?: string | null
          agency_reference_number?: string | null
          case_number?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          deadline?: string | null
          encrypted_form_data?: string | null
          encrypted_signature_data?: string | null
          encryption_migrated?: boolean | null
          encryption_migrated_at?: string | null
          form_data?: Json | null
          form_data_iv?: string | null
          id?: string
          last_status_change?: string | null
          notes?: string | null
          signature_data?: string | null
          signature_data_iv?: string | null
          signed_at?: string | null
          status?: Database["public"]["Enums"]["submission_status"] | null
          submitted_at?: string | null
          template_id?: string
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          agency_name: string | null
          agency_website: string | null
          created_at: string | null
          description: string | null
          estimated_time_minutes: number | null
          field_mappings: Json | null
          form_type: Database["public"]["Enums"]["form_type"]
          id: string
          is_active: boolean | null
          name: string
          required_documents: string[] | null
          schema: Json
          updated_at: string | null
          version: number | null
        }
        Insert: {
          agency_name?: string | null
          agency_website?: string | null
          created_at?: string | null
          description?: string | null
          estimated_time_minutes?: number | null
          field_mappings?: Json | null
          form_type: Database["public"]["Enums"]["form_type"]
          id: string
          is_active?: boolean | null
          name: string
          required_documents?: string[] | null
          schema: Json
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          agency_name?: string | null
          agency_website?: string | null
          created_at?: string | null
          description?: string | null
          estimated_time_minutes?: number | null
          field_mappings?: Json | null
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          is_active?: boolean | null
          name?: string
          required_documents?: string[] | null
          schema?: Json
          updated_at?: string | null
          version?: number | null
        }
        Relationships: []
      }
      impact_metrics: {
        Row: {
          actions_completed: number
          co2_saved_kg: number
          events_joined: number
          id: string
          trees_planted: number
          updated_at: string
          user_id: string
          waste_reduced_kg: number
        }
        Insert: {
          actions_completed?: number
          co2_saved_kg?: number
          events_joined?: number
          id?: string
          trees_planted?: number
          updated_at?: string
          user_id: string
          waste_reduced_kg?: number
        }
        Update: {
          actions_completed?: number
          co2_saved_kg?: number
          events_joined?: number
          id?: string
          trees_planted?: number
          updated_at?: string
          user_id?: string
          waste_reduced_kg?: number
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_backup_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          application_id: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          message: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          message?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      password_history: {
        Row: {
          created_at: string | null
          id: string
          password_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      post_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_hidden: boolean | null
          parent_id: string | null
          post_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          parent_id?: string | null
          post_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_hidden?: boolean | null
          parent_id?: string | null
          post_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string | null
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          image_url: string | null
          is_hidden: boolean | null
          is_pinned: boolean | null
          max_seekers: number | null
          resource_id: string | null
          slots_remaining: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          max_seekers?: number | null
          resource_id?: string | null
          slots_remaining?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          is_hidden?: boolean | null
          is_pinned?: boolean | null
          max_seekers?: number | null
          resource_id?: string | null
          slots_remaining?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          harmony_reviews_count: number
          harmony_score: number | null
          id: string
          is_admin: boolean | null
          is_staff: boolean
          is_verified: boolean | null
          latitude: number | null
          /** Trigger-derived geography(POINT,4326). PostgREST serializes as WKT string. Read-only for clients. */
          location: string | null
          location_city: string | null
          location_state: string | null
          longitude: number | null
          needs: Json | null
          onboarding_completed: boolean | null
          paypal_email: string | null
          phone: string | null
          updated_at: string | null
          user_role: string | null
          username: string | null
          venmo_username: string | null
          zip_code: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          harmony_reviews_count?: number
          harmony_score?: number | null
          id: string
          is_admin?: boolean | null
          is_staff?: boolean
          is_verified?: boolean | null
          latitude?: number | null
          location_city?: string | null
          location_state?: string | null
          longitude?: number | null
          needs?: Json | null
          onboarding_completed?: boolean | null
          paypal_email?: string | null
          phone?: string | null
          updated_at?: string | null
          user_role?: string | null
          username?: string | null
          venmo_username?: string | null
          zip_code?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          harmony_reviews_count?: number
          harmony_score?: number | null
          id?: string
          is_admin?: boolean | null
          is_staff?: boolean
          is_verified?: boolean | null
          latitude?: number | null
          location_city?: string | null
          location_state?: string | null
          longitude?: number | null
          needs?: Json | null
          onboarding_completed?: boolean | null
          paypal_email?: string | null
          phone?: string | null
          updated_at?: string | null
          user_role?: string | null
          username?: string | null
          venmo_username?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      reminders: {
        Row: {
          application_id: string | null
          created_at: string
          description: string | null
          id: string
          is_completed: boolean
          remind_at: string
          title: string
          user_id: string
        }
        Insert: {
          application_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          remind_at: string
          title: string
          user_id: string
        }
        Update: {
          application_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_completed?: boolean
          remind_at?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_bookmarks: {
        Row: {
          created_at: string | null
          resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_bookmarks_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_bookmarks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          application_form_url: string | null
          application_url: string | null
          category: Database["public"]["Enums"]["resource_category"]
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          eligibility_requirements: string | null
          email: string | null
          external_id: string | null
          hours_of_operation: Json | null
          id: string
          is_verified: boolean | null
          is_volunteer_resource: boolean
          languages_served: string[] | null
          last_verified_at: string | null
          location: unknown
          moderated_at: string | null
          moderated_by: string | null
          name: string
          phone: string | null
          rejection_reason: string | null
          services_offered: string[] | null
          source: Database["public"]["Enums"]["resource_source"] | null
          state: string | null
          status: Database["public"]["Enums"]["resource_status"] | null
          submitted_by: string | null
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          application_form_url?: string | null
          application_url?: string | null
          category?: Database["public"]["Enums"]["resource_category"]
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          eligibility_requirements?: string | null
          email?: string | null
          external_id?: string | null
          hours_of_operation?: Json | null
          id?: string
          is_verified?: boolean | null
          is_volunteer_resource?: boolean
          languages_served?: string[] | null
          last_verified_at?: string | null
          location?: unknown
          moderated_at?: string | null
          moderated_by?: string | null
          name: string
          phone?: string | null
          rejection_reason?: string | null
          services_offered?: string[] | null
          source?: Database["public"]["Enums"]["resource_source"] | null
          state?: string | null
          status?: Database["public"]["Enums"]["resource_status"] | null
          submitted_by?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          application_form_url?: string | null
          application_url?: string | null
          category?: Database["public"]["Enums"]["resource_category"]
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          eligibility_requirements?: string | null
          email?: string | null
          external_id?: string | null
          hours_of_operation?: Json | null
          id?: string
          is_verified?: boolean | null
          is_volunteer_resource?: boolean
          languages_served?: string[] | null
          last_verified_at?: string | null
          location?: unknown
          moderated_at?: string | null
          moderated_by?: string | null
          name?: string
          phone?: string | null
          rejection_reason?: string | null
          services_offered?: string[] | null
          source?: Database["public"]["Enums"]["resource_source"] | null
          state?: string | null
          status?: Database["public"]["Enums"]["resource_status"] | null
          submitted_by?: string | null
          updated_at?: string | null
          website?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_opt_ins: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          post_id: string
          resource_id: string | null
          seeker_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          post_id: string
          resource_id?: string | null
          seeker_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          post_id?: string
          resource_id?: string | null
          seeker_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_opt_ins_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_opt_ins_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_opt_ins_seeker_id_fkey"
            columns: ["seeker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          opt_in_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          updated_at: string
          would_recommend: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          opt_in_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          updated_at?: string
          would_recommend?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          opt_in_id?: string
          rating?: number
          reviewee_id?: string
          reviewer_id?: string
          updated_at?: string
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_opt_in_id_fkey"
            columns: ["opt_in_id"]
            isOneToOne: false
            referencedRelation: "resource_opt_ins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_resource_documents: {
        Row: {
          created_at: string | null
          encrypted: boolean | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          saved_resource_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          encrypted?: boolean | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          saved_resource_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          encrypted?: boolean | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          saved_resource_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_resource_documents_saved_resource_id_fkey"
            columns: ["saved_resource_id"]
            isOneToOne: false
            referencedRelation: "saved_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_resource_events: {
        Row: {
          created_at: string | null
          event_date: string
          event_time: string | null
          id: string
          reminder: boolean | null
          saved_resource_id: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          reminder?: boolean | null
          saved_resource_id: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          reminder?: boolean | null
          saved_resource_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_resource_events_saved_resource_id_fkey"
            columns: ["saved_resource_id"]
            isOneToOne: false
            referencedRelation: "saved_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_resource_tasks: {
        Row: {
          created_at: string | null
          id: string
          is_completed: boolean | null
          saved_resource_id: string
          sort_order: number | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          saved_resource_id: string
          sort_order?: number | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_completed?: boolean | null
          saved_resource_id?: string
          sort_order?: number | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_resource_tasks_saved_resource_id_fkey"
            columns: ["saved_resource_id"]
            isOneToOne: false
            referencedRelation: "saved_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_resources: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          resource_address: string | null
          resource_category: string | null
          resource_id: string | null
          resource_name: string
          resource_phone: string | null
          resource_website: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          resource_address?: string | null
          resource_category?: string | null
          resource_id?: string | null
          resource_name: string
          resource_phone?: string | null
          resource_website?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          resource_address?: string | null
          resource_category?: string | null
          resource_id?: string | null
          resource_name?: string
          resource_phone?: string | null
          resource_website?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_resources_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      snap_retailers: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          incentive_program: string | null
          last_synced_at: string
          location: unknown
          retailer_id: string | null
          retailer_name: string
          retailer_type: string | null
          state: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          incentive_program?: string | null
          last_synced_at?: string
          location?: unknown
          retailer_id?: string | null
          retailer_name: string
          retailer_type?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          incentive_program?: string | null
          last_synced_at?: string
          location?: unknown
          retailer_id?: string | null
          retailer_name?: string
          retailer_type?: string | null
          state?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          annotations_iv: string | null
          category: string | null
          created_at: string | null
          document_type: string
          encrypted_annotations: string | null
          encrypted_name_iv: string | null
          encrypted_original_name: string | null
          encryption_iv: string | null
          expires_at: string | null
          file_path: string
          file_size: number | null
          id: string
          is_encrypted: boolean | null
          is_verified: boolean | null
          mime_type: string | null
          name: string
          notes: string | null
          original_size: number | null
          submission_id: string | null
          updated_at: string | null
          user_id: string
          verified_at: string | null
        }
        Insert: {
          annotations_iv?: string | null
          category?: string | null
          created_at?: string | null
          document_type: string
          encrypted_annotations?: string | null
          encrypted_name_iv?: string | null
          encrypted_original_name?: string | null
          encryption_iv?: string | null
          expires_at?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_encrypted?: boolean | null
          is_verified?: boolean | null
          mime_type?: string | null
          name: string
          notes?: string | null
          original_size?: number | null
          submission_id?: string | null
          updated_at?: string | null
          user_id: string
          verified_at?: string | null
        }
        Update: {
          annotations_iv?: string | null
          category?: string | null
          created_at?: string | null
          document_type?: string
          encrypted_annotations?: string | null
          encrypted_name_iv?: string | null
          encrypted_original_name?: string | null
          encryption_iv?: string | null
          expires_at?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_encrypted?: boolean | null
          is_verified?: boolean | null
          mime_type?: string | null
          name?: string
          notes?: string | null
          original_size?: number | null
          submission_id?: string | null
          updated_at?: string | null
          user_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_documents_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_secure_profiles: {
        Row: {
          created_at: string | null
          current_benefits: string[] | null
          current_benefits_iv: string | null
          dek_iv: string | null
          emergency_contact: Json | null
          emergency_contact_iv: string | null
          employer_info: Json | null
          employer_info_iv: string | null
          employment_status: string | null
          encrypted_current_benefits: string | null
          encrypted_dob: string | null
          encrypted_emergency_contact: string | null
          encrypted_employer_info: string | null
          encrypted_household_members: string | null
          encrypted_income: string | null
          encrypted_mailing_address: string | null
          encrypted_residential_address: string | null
          encrypted_ssn: string | null
          encryption_migrated: boolean | null
          encryption_migrated_at: string | null
          encryption_salt: string | null
          encryption_version: number | null
          household_members: Json | null
          household_members_iv: string | null
          household_size: number | null
          id: string
          last_decrypted_at: string | null
          mailing_address: Json | null
          mailing_address_iv: string | null
          residential_address: Json | null
          residential_address_iv: string | null
          updated_at: string | null
          vault_created_at: string | null
          verification_ciphertext: string | null
          verification_iv: string | null
          wrapped_dek: string | null
        }
        Insert: {
          created_at?: string | null
          current_benefits?: string[] | null
          current_benefits_iv?: string | null
          dek_iv?: string | null
          emergency_contact?: Json | null
          emergency_contact_iv?: string | null
          employer_info?: Json | null
          employer_info_iv?: string | null
          employment_status?: string | null
          encrypted_current_benefits?: string | null
          encrypted_dob?: string | null
          encrypted_emergency_contact?: string | null
          encrypted_employer_info?: string | null
          encrypted_household_members?: string | null
          encrypted_income?: string | null
          encrypted_mailing_address?: string | null
          encrypted_residential_address?: string | null
          encrypted_ssn?: string | null
          encryption_migrated?: boolean | null
          encryption_migrated_at?: string | null
          encryption_salt?: string | null
          encryption_version?: number | null
          household_members?: Json | null
          household_members_iv?: string | null
          household_size?: number | null
          id: string
          last_decrypted_at?: string | null
          mailing_address?: Json | null
          mailing_address_iv?: string | null
          residential_address?: Json | null
          residential_address_iv?: string | null
          updated_at?: string | null
          vault_created_at?: string | null
          verification_ciphertext?: string | null
          verification_iv?: string | null
          wrapped_dek?: string | null
        }
        Update: {
          created_at?: string | null
          current_benefits?: string[] | null
          current_benefits_iv?: string | null
          dek_iv?: string | null
          emergency_contact?: Json | null
          emergency_contact_iv?: string | null
          employer_info?: Json | null
          employer_info_iv?: string | null
          employment_status?: string | null
          encrypted_current_benefits?: string | null
          encrypted_dob?: string | null
          encrypted_emergency_contact?: string | null
          encrypted_employer_info?: string | null
          encrypted_household_members?: string | null
          encrypted_income?: string | null
          encrypted_mailing_address?: string | null
          encrypted_residential_address?: string | null
          encrypted_ssn?: string | null
          encryption_migrated?: boolean | null
          encryption_migrated_at?: string | null
          encryption_salt?: string | null
          encryption_version?: number | null
          household_members?: Json | null
          household_members_iv?: string | null
          household_size?: number | null
          id?: string
          last_decrypted_at?: string | null
          mailing_address?: Json | null
          mailing_address_iv?: string | null
          residential_address?: Json | null
          residential_address_iv?: string | null
          updated_at?: string | null
          vault_created_at?: string | null
          verification_ciphertext?: string | null
          verification_iv?: string | null
          wrapped_dek?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_secure_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_secure_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: string | null
          id: string
          ip_address: unknown
          is_current: boolean | null
          last_active_at: string | null
          location_info: Json | null
          session_token: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean | null
          last_active_at?: string | null
          location_info?: Json | null
          session_token?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: string | null
          id?: string
          ip_address?: unknown
          is_current?: boolean | null
          last_active_at?: string | null
          location_info?: Json | null
          session_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      zip_centroids: {
        Row: {
          lat: number
          lng: number
          zip: string
        }
        Insert: {
          lat: number
          lng: number
          zip: string
        }
        Update: {
          lat?: number
          lng?: number
          zip?: string
        }
        Relationships: []
      }
    }
    Views: {
      federation_trust_overview: {
        Row: {
          failed_syncs: number | null
          federation_enabled: boolean | null
          instance_id: string | null
          instance_name: string | null
          instance_url: string | null
          last_sync_at: string | null
          peer_id: string | null
          registered_at: string | null
          resource_count: number | null
          status: string | null
          successful_syncs: number | null
          sync_success_rate: number | null
          total_syncs: number | null
          trust_level: string | null
          trust_score: number | null
        }
        Relationships: []
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          is_verified: boolean | null
          location_city: string | null
          location_state: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          location_city?: string | null
          location_state?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          is_verified?: boolean | null
          location_city?: string | null
          location_state?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      calculate_trust_score: {
        Args: {
          community_score: number
          data_quality_score: number
          longevity_days: number
          moderation_score: number
          uptime_score: number
        }
        Returns: number
      }
      cleanup_expired_lockouts: { Args: never; Returns: undefined }
      cleanup_inactive_sessions: { Args: never; Returns: undefined }
      cleanup_old_login_attempts: { Args: never; Returns: undefined }
      cleanup_old_webhook_logs: { Args: never; Returns: number }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
      dropgeometrytable:
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
      earth: { Args: never; Returns: number }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      find_duplicate_resource: {
        Args: {
          p_address?: string
          p_name: string
          p_phone?: string
          p_threshold?: number
        }
        Returns: {
          address_line1: string
          id: string
          name: string
          phone: string
          similarity_score: number
          source: Database["public"]["Enums"]["resource_source"]
        }[]
      }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_donation_handles: {
        Args: { target_id: string }
        Returns: {
          paypal_email: string
          venmo_username: string
        }[]
      }
      get_instance_uptime: { Args: { p_instance_id: string }; Returns: number }
      get_my_private_profile: {
        Args: never
        Returns: {
          paypal_email: string
          phone: string
          venmo_username: string
        }[]
      }
      get_recent_webhook_failures: {
        Args: { p_limit?: number }
        Returns: {
          attempts: number
          created_at: string
          error_message: string
          event_type: string
          peer_name: string
          resource_id: string
        }[]
      }
      get_stale_federated_resources: {
        Args: { hours_threshold?: number }
        Returns: {
          hours_since_sync: number
          resource_id: string
          source_instance_url: string
        }[]
      }
      get_webhook_stats: {
        Args: { p_hours_ago?: number; p_peer_id: string }
        Returns: {
          avg_attempts: number
          failed_deliveries: number
          retried_deliveries: number
          success_rate: number
          successful_deliveries: number
          total_deliveries: number
        }[]
      }
      gettransactionid: { Args: never; Returns: unknown }
      is_account_locked: {
        Args: { p_email: string }
        Returns: {
          is_locked: boolean
          locked_until: string
          lockout_level: number
        }[]
      }
      is_current_user_admin: { Args: never; Returns: boolean }
      opt_in_to_post: {
        Args: { p_post_id: string }
        Returns: {
          completed_at: string | null
          created_at: string
          id: string
          post_id: string
          resource_id: string | null
          seeker_id: string
          status: string
          updated_at: string
        }
      }
      withdraw_opt_in: {
        Args: { p_post_id: string }
        Returns: boolean
      }
      submit_review: {
        Args: {
          p_opt_in_id: string
          p_rating: number
          p_would_recommend?: boolean | null
          p_comment?: string | null
        }
        Returns: {
          comment: string | null
          created_at: string
          id: string
          opt_in_id: string
          rating: number
          reviewee_id: string
          reviewer_id: string
          updated_at: string
          would_recommend: boolean | null
        }
      }
      log_audit_event: {
        Args: {
          p_action: string
          p_details?: Json
          p_event_category: string
          p_event_type: string
          p_ip_address?: unknown
          p_resource_id?: string
          p_resource_type?: string
          p_session_id?: string
          p_severity?: string
          p_user_agent?: string
          p_user_id: string
        }
        Returns: string
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      nearby_federated_resources: {
        Args: {
          radius_miles?: number
          resource_category?: string
          result_limit?: number
          search_lat: number
          search_lng: number
        }
        Returns: {
          address_line1: string
          city: string
          description: string
          distance_miles: number
          id: string
          latitude: number
          longitude: number
          name: string
          phone: string
          resource_type: string
          source_instance_id: string
          state: string
          trust_score: number
          website: string
          zip_code: string
        }[]
      }
      notify_seekers_near_resource: {
        Args: { p_post_id: string; p_radius_miles: number }
        Returns: number
      }
      seekers_within_radius: {
        Args: { p_resource_id: string; p_radius_miles: number }
        Returns: number
      }
      nearby_resources: {
        Args: { lat: number; lng: number; radius_miles?: number }
        Returns: {
          address_line1: string | null
          address_line2: string | null
          application_form_url: string | null
          application_url: string | null
          category: Database["public"]["Enums"]["resource_category"]
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          eligibility_requirements: string | null
          email: string | null
          external_id: string | null
          hours_of_operation: Json | null
          id: string
          is_verified: boolean | null
          is_volunteer_resource: boolean
          languages_served: string[] | null
          last_verified_at: string | null
          location: unknown
          moderated_at: string | null
          moderated_by: string | null
          name: string
          phone: string | null
          rejection_reason: string | null
          services_offered: string[] | null
          source: Database["public"]["Enums"]["resource_source"] | null
          state: string | null
          status: Database["public"]["Enums"]["resource_status"] | null
          submitted_by: string | null
          updated_at: string | null
          website: string | null
          zip_code: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "resources"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      notify_federation_webhook: {
        Args: {
          p_event_type: string
          p_resource_id: string
          p_resource_type: string
        }
        Returns: undefined
      }
      populate_geometry_columns:
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
        | { Args: { use_typmod?: boolean }; Returns: string }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      refresh_federation_trust_overview: { Args: never; Returns: undefined }
      resources_in_bounds: {
        Args: {
          east: number
          max_results?: number
          north: number
          south: number
          west: number
        }
        Returns: {
          address_line1: string
          category: string
          city: string
          description: string
          hours_of_operation: Json
          id: string
          is_volunteer_resource: boolean
          location: unknown
          name: string
          phone: string
          state: string
          website: string
        }[]
      }
      set_resource_location: {
        Args: {
          p_external_id: string
          p_lat: number
          p_lng: number
          p_source: string
        }
        Returns: undefined
      }
      set_resource_location_by_id: {
        Args: { p_id: string; p_lat: number; p_lng: number }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
      st_askml:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geog: unknown }; Returns: number }
        | { Args: { geom: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      trust_score_to_level: { Args: { score: number }; Returns: string }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
    }
    Enums: {
      conversation_status: "pending" | "active" | "declined" | "cancelled"
      form_type:
        | "snap"
        | "medicaid"
        | "tanf"
        | "wic"
        | "housing"
        | "utility"
        | "unemployment"
        | "disability"
        | "childcare"
        | "general"
      notification_type:
        | "status_update"
        | "deadline_reminder"
        | "action_required"
        | "document_request"
        | "approval"
        | "denial"
        | "general"
      resource_category:
        | "food"
        | "housing"
        | "healthcare"
        | "employment"
        | "education"
        | "legal"
        | "transportation"
        | "utilities"
        | "clothing"
        | "financial"
        | "mental_health"
        | "substance_abuse"
        | "domestic_violence"
        | "childcare"
        | "senior_services"
        | "disability_services"
        | "veteran_services"
        | "immigration"
        | "other"
      resource_source:
        | "user_submitted"
        | "211_api"
        | "admin_added"
        | "partner_org"
        | "osm"
        | "snap"
        | "hrsa"
        | "hud"
        | "headstart"
        | "cdc"
        | "samhsa"
        | "imls"
        | "dol"
        | "cms"
        | "npi"
        | "usajobs"
      resource_status: "pending" | "approved" | "rejected" | "archived"
      submission_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "under_review"
        | "approved"
        | "denied"
        | "pending_info"
        | "expired"
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      conversation_status: ["pending", "active", "declined", "cancelled"],
      form_type: [
        "snap",
        "medicaid",
        "tanf",
        "wic",
        "housing",
        "utility",
        "unemployment",
        "disability",
        "childcare",
        "general",
      ],
      notification_type: [
        "status_update",
        "deadline_reminder",
        "action_required",
        "document_request",
        "approval",
        "denial",
        "general",
      ],
      resource_category: [
        "food",
        "housing",
        "healthcare",
        "employment",
        "education",
        "legal",
        "transportation",
        "utilities",
        "clothing",
        "financial",
        "mental_health",
        "substance_abuse",
        "domestic_violence",
        "childcare",
        "senior_services",
        "disability_services",
        "veteran_services",
        "immigration",
        "other",
      ],
      resource_source: [
        "user_submitted",
        "211_api",
        "admin_added",
        "partner_org",
        "osm",
        "snap",
        "hrsa",
        "hud",
        "headstart",
        "cdc",
        "samhsa",
        "imls",
        "dol",
        "cms",
        "npi",
        "usajobs",
      ],
      resource_status: ["pending", "approved", "rejected", "archived"],
      submission_status: [
        "draft",
        "in_progress",
        "submitted",
        "under_review",
        "approved",
        "denied",
        "pending_info",
        "expired",
      ],
    },
  },
} as const
