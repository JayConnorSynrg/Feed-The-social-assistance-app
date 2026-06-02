-- Add encrypted annotations sidecar columns to user_documents
-- These columns store client-side AES-GCM encrypted annotation data for
-- the PDF true-edit feature. Encryption/decryption happens entirely in the
-- browser; the server never sees plaintext PII.
--
-- RLS note: no policy change is required. The existing four policies on
-- user_documents (user_documents_select_own, user_documents_insert_own,
-- user_documents_update_own, user_documents_delete_own) all gate access by
-- auth.uid() = user_id and automatically cover these new columns.

ALTER TABLE public.user_documents
  ADD COLUMN IF NOT EXISTS encrypted_annotations text,
  ADD COLUMN IF NOT EXISTS annotations_iv text;

COMMENT ON COLUMN public.user_documents.encrypted_annotations IS
  'Base64-encoded AES-GCM ciphertext of the annotations JSON envelope (client-encrypted). NULL for legacy or flattened documents that carry no editable annotation sidecar.';

COMMENT ON COLUMN public.user_documents.annotations_iv IS
  'Base64-encoded AES-GCM initialization vector paired with encrypted_annotations. NULL when encrypted_annotations is NULL.';
