// FEED Platform Database Types
// Auto-regenerate with: npx supabase gen types typescript --local > packages/database/types.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Enums
export type ResourceCategory =
  | 'food'
  | 'housing'
  | 'healthcare'
  | 'employment'
  | 'education'
  | 'legal'
  | 'transportation'
  | 'utilities'
  | 'clothing'
  | 'financial'
  | 'mental_health'
  | 'substance_abuse'
  | 'domestic_violence'
  | 'childcare'
  | 'senior_services'
  | 'disability_services'
  | 'veteran_services'
  | 'immigration'
  | 'other'

export type ResourceSource = 'user_submitted' | '211_api' | 'admin_added' | 'partner_org'

export type ResourceStatus = 'pending' | 'approved' | 'rejected' | 'archived'

export type FormType =
  | 'snap'
  | 'medicaid'
  | 'tanf'
  | 'wic'
  | 'housing'
  | 'utility'
  | 'unemployment'
  | 'disability'
  | 'childcare'
  | 'general'

export type SubmissionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'denied'
  | 'pending_info'
  | 'expired'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          venmo_username: string | null
          paypal_email: string | null
          location_city: string | null
          location_state: string | null
          is_verified: boolean
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          venmo_username?: string | null
          paypal_email?: string | null
          location_city?: string | null
          location_state?: string | null
          is_verified?: boolean
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          venmo_username?: string | null
          paypal_email?: string | null
          location_city?: string | null
          location_state?: string | null
          is_verified?: boolean
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      follows: {
        Row: {
          follower_id: string
          following_id: string
          created_at: string
        }
        Insert: {
          follower_id: string
          following_id: string
          created_at?: string
        }
        Update: {
          follower_id?: string
          following_id?: string
          created_at?: string
        }
      }
      posts: {
        Row: {
          id: string
          user_id: string
          content: string
          image_url: string | null
          is_pinned: boolean
          is_hidden: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          content: string
          image_url?: string | null
          is_pinned?: boolean
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          content?: string
          image_url?: string | null
          is_pinned?: boolean
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      post_likes: {
        Row: {
          user_id: string
          post_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          post_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          post_id?: string
          created_at?: string
        }
      }
      post_comments: {
        Row: {
          id: string
          post_id: string
          user_id: string
          content: string
          parent_id: string | null
          is_hidden: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          post_id: string
          user_id: string
          content: string
          parent_id?: string | null
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          user_id?: string
          content?: string
          parent_id?: string | null
          is_hidden?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      resources: {
        Row: {
          id: string
          name: string
          description: string | null
          category: ResourceCategory
          address_line1: string | null
          address_line2: string | null
          city: string | null
          state: string | null
          zip_code: string | null
          country: string
          location: unknown | null
          phone: string | null
          email: string | null
          website: string | null
          hours_of_operation: Json | null
          eligibility_requirements: string | null
          languages_served: string[] | null
          services_offered: string[] | null
          source: ResourceSource
          external_id: string | null
          submitted_by: string | null
          status: ResourceStatus
          moderated_by: string | null
          moderated_at: string | null
          rejection_reason: string | null
          is_verified: boolean
          last_verified_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          category?: ResourceCategory
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string
          location?: unknown | null
          phone?: string | null
          email?: string | null
          website?: string | null
          hours_of_operation?: Json | null
          eligibility_requirements?: string | null
          languages_served?: string[] | null
          services_offered?: string[] | null
          source?: ResourceSource
          external_id?: string | null
          submitted_by?: string | null
          status?: ResourceStatus
          moderated_by?: string | null
          moderated_at?: string | null
          rejection_reason?: string | null
          is_verified?: boolean
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          category?: ResourceCategory
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          state?: string | null
          zip_code?: string | null
          country?: string
          location?: unknown | null
          phone?: string | null
          email?: string | null
          website?: string | null
          hours_of_operation?: Json | null
          eligibility_requirements?: string | null
          languages_served?: string[] | null
          services_offered?: string[] | null
          source?: ResourceSource
          external_id?: string | null
          submitted_by?: string | null
          status?: ResourceStatus
          moderated_by?: string | null
          moderated_at?: string | null
          rejection_reason?: string | null
          is_verified?: boolean
          last_verified_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      resource_bookmarks: {
        Row: {
          user_id: string
          resource_id: string
          created_at: string
        }
        Insert: {
          user_id: string
          resource_id: string
          created_at?: string
        }
        Update: {
          user_id?: string
          resource_id?: string
          created_at?: string
        }
      }
      form_templates: {
        Row: {
          id: string
          name: string
          form_type: FormType
          description: string | null
          version: number
          is_active: boolean
          schema: Json
          field_mappings: Json | null
          required_documents: string[] | null
          agency_name: string | null
          agency_website: string | null
          estimated_time_minutes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          form_type: FormType
          description?: string | null
          version?: number
          is_active?: boolean
          schema: Json
          field_mappings?: Json | null
          required_documents?: string[] | null
          agency_name?: string | null
          agency_website?: string | null
          estimated_time_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          form_type?: FormType
          description?: string | null
          version?: number
          is_active?: boolean
          schema?: Json
          field_mappings?: Json | null
          required_documents?: string[] | null
          agency_name?: string | null
          agency_website?: string | null
          estimated_time_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      form_submissions: {
        Row: {
          id: string
          user_id: string
          template_id: string
          form_data: Json
          status: SubmissionStatus
          submitted_at: string | null
          last_status_change: string
          current_step: number
          total_steps: number | null
          completion_percentage: number
          signature_data: string | null
          signed_at: string | null
          notes: string | null
          agency_reference_number: string | null
          deadline: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          template_id: string
          form_data: Json
          status?: SubmissionStatus
          submitted_at?: string | null
          last_status_change?: string
          current_step?: number
          total_steps?: number | null
          completion_percentage?: number
          signature_data?: string | null
          signed_at?: string | null
          notes?: string | null
          agency_reference_number?: string | null
          deadline?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          template_id?: string
          form_data?: Json
          status?: SubmissionStatus
          submitted_at?: string | null
          last_status_change?: string
          current_step?: number
          total_steps?: number | null
          completion_percentage?: number
          signature_data?: string | null
          signed_at?: string | null
          notes?: string | null
          agency_reference_number?: string | null
          deadline?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_secure_profiles: {
        Row: {
          id: string
          encrypted_ssn: string | null
          encrypted_dob: string | null
          encrypted_income: string | null
          household_size: number | null
          household_members: Json | null
          employment_status: string | null
          employer_info: Json | null
          mailing_address: Json | null
          residential_address: Json | null
          current_benefits: string[] | null
          emergency_contact: Json | null
          encryption_version: number
          last_decrypted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          encrypted_ssn?: string | null
          encrypted_dob?: string | null
          encrypted_income?: string | null
          household_size?: number | null
          household_members?: Json | null
          employment_status?: string | null
          employer_info?: Json | null
          mailing_address?: Json | null
          residential_address?: Json | null
          current_benefits?: string[] | null
          emergency_contact?: Json | null
          encryption_version?: number
          last_decrypted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          encrypted_ssn?: string | null
          encrypted_dob?: string | null
          encrypted_income?: string | null
          household_size?: number | null
          household_members?: Json | null
          employment_status?: string | null
          employer_info?: Json | null
          mailing_address?: Json | null
          residential_address?: Json | null
          current_benefits?: string[] | null
          emergency_contact?: Json | null
          encryption_version?: number
          last_decrypted_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      user_documents: {
        Row: {
          id: string
          user_id: string
          submission_id: string | null
          name: string
          document_type: string
          file_path: string
          file_size: number | null
          mime_type: string | null
          category: string | null
          expires_at: string | null
          is_verified: boolean
          verified_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          submission_id?: string | null
          name: string
          document_type: string
          file_path: string
          file_size?: number | null
          mime_type?: string | null
          category?: string | null
          expires_at?: string | null
          is_verified?: boolean
          verified_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          submission_id?: string | null
          name?: string
          document_type?: string
          file_path?: string
          file_size?: number | null
          mime_type?: string | null
          category?: string | null
          expires_at?: string | null
          is_verified?: boolean
          verified_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      nearby_resources: {
        Args: {
          lat: number
          lng: number
          radius_miles?: number
        }
        Returns: Database['public']['Tables']['resources']['Row'][]
      }
    }
    Enums: {
      resource_category: ResourceCategory
      resource_source: ResourceSource
      resource_status: ResourceStatus
      form_type: FormType
      submission_status: SubmissionStatus
    }
  }
}

// Utility types
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

export type Enums<T extends keyof Database['public']['Enums']> =
  Database['public']['Enums'][T]

// Convenience type aliases
export type Profile = Tables<'profiles'>
export type Post = Tables<'posts'>
export type PostComment = Tables<'post_comments'>
export type Resource = Tables<'resources'>
export type FormTemplate = Tables<'form_templates'>
export type FormSubmission = Tables<'form_submissions'>
export type UserSecureProfile = Tables<'user_secure_profiles'>
export type UserDocument = Tables<'user_documents'>
