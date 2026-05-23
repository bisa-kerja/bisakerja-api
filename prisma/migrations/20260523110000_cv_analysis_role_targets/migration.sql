ALTER TABLE "cv_analysis_results"
  ALTER COLUMN "job_listing_id" DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS "cv_analysis_results_job_listing_id_fkey",
  ADD CONSTRAINT "cv_analysis_results_job_listing_id_fkey"
    FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
