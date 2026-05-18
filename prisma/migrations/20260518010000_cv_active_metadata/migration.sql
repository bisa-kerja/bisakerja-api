ALTER TABLE "cv_file_metadata"
ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "cv_file_metadata_user_active_idx"
ON "cv_file_metadata"("user_id", "is_active");

CREATE UNIQUE INDEX "cv_file_metadata_one_active_per_user_idx"
ON "cv_file_metadata"("user_id")
WHERE "is_active" = true AND "deleted_at" IS NULL;
