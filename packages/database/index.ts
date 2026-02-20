// Database package - Supabase client and types
export * from './types';
export * from './client';

// Convenience type aliases used across the app
import type { Tables, Database } from './types';
export type Post = Tables<'posts'>;
export type Profile = Tables<'profiles'>;
export type AuditLogTable = Database['public']['Tables']['audit_log'];
