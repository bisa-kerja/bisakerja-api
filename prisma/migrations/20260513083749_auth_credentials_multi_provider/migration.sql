-- Allow multiple auth credentials per user and support non-password providers.

-- Drop old one-to-one user constraint.
DROP INDEX IF EXISTS "auth_credentials_user_id_unique";

-- Make password fields nullable for non-local providers.
ALTER TABLE "auth_credentials"
  ALTER COLUMN "password_hash" DROP NOT NULL,
  ALTER COLUMN "password_hash_algorithm" DROP NOT NULL,
  ALTER COLUMN "password_updated_at" DROP NOT NULL;

-- Enforce one credential per provider per user.
CREATE UNIQUE INDEX "auth_credentials_user_id_provider_unique"
  ON "auth_credentials"("user_id", "provider");

