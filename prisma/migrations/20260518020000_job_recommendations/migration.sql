ALTER TYPE "AiRequestKind"
ADD VALUE IF NOT EXISTS 'JOB_RECOMMENDATIONS';

CREATE TYPE "JobRecommendationRunStatus" AS ENUM ('SUCCEEDED', 'FAILED');
CREATE TYPE "JobRecommendationMatchLevel" AS ENUM ('STRONG', 'GOOD', 'STRETCH');

CREATE TABLE "job_recommendation_runs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "cv_analysis_result_id" TEXT NOT NULL,
  "idempotency_key" TEXT,
  "requested_limit" INTEGER NOT NULL,
  "candidate_count" INTEGER NOT NULL,
  "recommendation_count" INTEGER NOT NULL,
  "model_name" TEXT NOT NULL,
  "model_version" TEXT NOT NULL,
  "status" "JobRecommendationRunStatus" NOT NULL DEFAULT 'SUCCEEDED',
  "error_code" TEXT,
  "filters_snapshot" JSONB,
  "input_summary" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3),
  CONSTRAINT "job_recommendation_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_recommendation_runs_requested_limit_check" CHECK ("requested_limit" >= 1 AND "requested_limit" <= 20),
  CONSTRAINT "job_recommendation_runs_candidate_count_check" CHECK ("candidate_count" >= 0),
  CONSTRAINT "job_recommendation_runs_recommendation_count_check" CHECK ("recommendation_count" >= 0),
  CONSTRAINT "job_recommendation_runs_recommendation_vs_limit_check" CHECK ("recommendation_count" <= "requested_limit")
);

CREATE TABLE "job_recommendation_items" (
  "id" TEXT NOT NULL,
  "run_id" TEXT NOT NULL,
  "job_listing_id" TEXT NOT NULL,
  "rank" INTEGER NOT NULL,
  "match_score" INTEGER NOT NULL,
  "match_level" "JobRecommendationMatchLevel" NOT NULL,
  "reasons" JSONB NOT NULL,
  "matched_skills" JSONB NOT NULL,
  "missing_skills" JSONB NOT NULL,
  "next_steps" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_recommendation_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "job_recommendation_items_rank_check" CHECK ("rank" > 0),
  CONSTRAINT "job_recommendation_items_match_score_check" CHECK ("match_score" >= 0 AND "match_score" <= 100)
);

CREATE UNIQUE INDEX "job_recommendation_runs_user_idempotency_unique"
ON "job_recommendation_runs"("user_id", "idempotency_key");

CREATE INDEX "job_recommendation_runs_user_created_at_idx"
ON "job_recommendation_runs"("user_id", "created_at");

CREATE INDEX "job_recommendation_runs_cv_analysis_result_id_idx"
ON "job_recommendation_runs"("cv_analysis_result_id");

CREATE UNIQUE INDEX "job_recommendation_items_run_rank_unique"
ON "job_recommendation_items"("run_id", "rank");

CREATE UNIQUE INDEX "job_recommendation_items_run_job_unique"
ON "job_recommendation_items"("run_id", "job_listing_id");

CREATE INDEX "job_recommendation_items_job_listing_id_idx"
ON "job_recommendation_items"("job_listing_id");

ALTER TABLE "job_recommendation_runs"
ADD CONSTRAINT "job_recommendation_runs_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "job_recommendation_runs"
ADD CONSTRAINT "job_recommendation_runs_cv_analysis_result_id_fkey"
FOREIGN KEY ("cv_analysis_result_id")
REFERENCES "cv_analysis_results"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

ALTER TABLE "job_recommendation_items"
ADD CONSTRAINT "job_recommendation_items_run_id_fkey"
FOREIGN KEY ("run_id")
REFERENCES "job_recommendation_runs"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "job_recommendation_items"
ADD CONSTRAINT "job_recommendation_items_job_listing_id_fkey"
FOREIGN KEY ("job_listing_id")
REFERENCES "job_listings"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
