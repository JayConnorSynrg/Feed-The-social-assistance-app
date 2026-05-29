-- Drop redundant indexes — write-amplification reduction with zero read-path loss.
-- All dropped indexes are confirmed to NOT back any PK/UNIQUE/FK constraint.

-- posts: idx_posts_created_at is identical to posts_created_at_idx (both btree created_at DESC).
-- idx_posts_user_created (user_id, created_at DESC) subsumes both single-column variants.
DROP INDEX IF EXISTS public.idx_posts_created_at;

-- posts: idx_posts_user_id is identical to posts_user_id_idx (both btree user_id).
-- idx_posts_user_created (user_id, created_at DESC) subsumes both single-column variants.
DROP INDEX IF EXISTS public.idx_posts_user_id;

-- profiles: idx_profiles_username is a plain duplicate of the UNIQUE index profiles_username_key
-- (both btree username). profiles_username_key backs the UNIQUE constraint and is kept.
DROP INDEX IF EXISTS public.idx_profiles_username;

-- resources: idx_resources_status (btree status) has low selectivity on its own.
-- The status=approved predicate is covered by the partial composite idx_resources_browse
-- (state, category, name WHERE status=approved). General status queries default to seq-scan
-- or idx_resources_category which already narrows the result set.
DROP INDEX IF EXISTS public.idx_resources_status;
