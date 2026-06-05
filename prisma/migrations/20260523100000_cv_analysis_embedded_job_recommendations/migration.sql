ALTER TABLE "cv_analysis_results"
  ADD COLUMN "job_recommendations" JSONB NOT NULL DEFAULT '[]';
