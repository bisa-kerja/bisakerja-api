-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BASIC', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "CareerStatus" AS ENUM ('FRESH_GRADUATE', 'EARLY_CAREER', 'CAREER_SWITCHER');

-- CreateEnum
CREATE TYPE "JobSeekingStatus" AS ENUM ('IMMEDIATE', 'ONE_MONTH', 'THREE_MONTHS');

-- CreateEnum
CREATE TYPE "WorkType" AS ENUM ('REMOTE', 'HYBRID', 'ONSITE');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'INTERNSHIP', 'CONTRACT', 'FREELANCE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('ENTRY_LEVEL', 'JUNIOR', 'MID_LEVEL', 'SENIOR', 'LEAD');

-- CreateEnum
CREATE TYPE "SalaryPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "JobListingStatus" AS ENUM ('ACTIVE', 'STALE', 'EXPIRED', 'CLOSED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "RequirementType" AS ENUM ('SKILL', 'EXPERIENCE', 'EDUCATION', 'RESPONSIBILITY', 'OTHER');

-- CreateEnum
CREATE TYPE "RequirementPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'INTERVIEW', 'REJECTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "ApplicationSource" AS ENUM ('MANUAL', 'EXTERNAL_APPLY_CLICK');

-- CreateEnum
CREATE TYPE "AnalysisLanguage" AS ENUM ('ID', 'EN');

-- CreateEnum
CREATE TYPE "CvInputMode" AS ENUM ('UPLOAD', 'REFERENCE');

-- CreateEnum
CREATE TYPE "CvCompareSource" AS ENUM ('BOOKMARK', 'JOB_SEARCH', 'DIRECT_JOB_DETAIL');

-- CreateEnum
CREATE TYPE "StorageDriver" AS ENUM ('LOCAL');

-- CreateEnum
CREATE TYPE "AiRequestKind" AS ENUM ('JOB_FIT', 'CV_ANALYSIS');

-- CreateEnum
CREATE TYPE "AiRequestStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "phone_number" TEXT,
    "display_name" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "email_verified_at" TIMESTAMP(3),
    "onboarding_status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_credentials" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "provider_account_id" TEXT,
    "password_hash" TEXT NOT NULL,
    "password_hash_algorithm" TEXT NOT NULL,
    "password_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "auth_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_family_id" TEXT NOT NULL,
    "replaced_by_token_id" TEXT,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "career_status" "CareerStatus",
    "latest_role" TEXT,
    "summary" TEXT,
    "profile_photo_storage_key" TEXT,
    "profile_photo_url" TEXT,
    "profile_photo_mime_type" TEXT,
    "profile_photo_size_bytes" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_experiences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "employment_type" "EmploymentType",
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_educations" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "degree" TEXT,
    "field_of_study" TEXT,
    "start_year" INTEGER,
    "end_year" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_skills" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "level" "SkillLevel",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "career_status" "CareerStatus" NOT NULL,
    "job_seeking_status" "JobSeekingStatus" NOT NULL,
    "target_roles" JSONB NOT NULL,
    "locations" JSONB NOT NULL,
    "work_types" "WorkType"[],
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_currency" TEXT NOT NULL DEFAULT 'IDR',
    "salary_period" "SalaryPeriod" NOT NULL DEFAULT 'MONTHLY',
    "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_platforms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "base_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_platforms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "logo_url" TEXT,
    "website_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" TEXT NOT NULL,
    "source_platform_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "observed_count" INTEGER NOT NULL DEFAULT 0,
    "upserted_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_listings" (
    "id" TEXT NOT NULL,
    "source_platform_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "ingestion_run_id" TEXT,
    "external_job_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT,
    "category" TEXT,
    "description" TEXT,
    "requirement_summary" TEXT,
    "work_type" "WorkType",
    "employment_type" "EmploymentType",
    "experience_level" "ExperienceLevel",
    "location_display" TEXT,
    "province" TEXT,
    "city" TEXT,
    "salary_min" INTEGER,
    "salary_max" INTEGER,
    "salary_currency" TEXT NOT NULL DEFAULT 'IDR',
    "salary_period" "SalaryPeriod",
    "salary_display" TEXT,
    "source_url" TEXT NOT NULL,
    "external_apply_url" TEXT NOT NULL,
    "source_posted_at" TIMESTAMP(3),
    "source_updated_at" TIMESTAMP(3),
    "last_seen_at" TIMESTAMP(3) NOT NULL,
    "expired_at" TIMESTAMP(3),
    "status" "JobListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_requirements" (
    "id" TEXT NOT NULL,
    "job_listing_id" TEXT NOT NULL,
    "type" "RequirementType" NOT NULL,
    "value" TEXT NOT NULL,
    "priority" "RequirementPriority",
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_skills" (
    "id" TEXT NOT NULL,
    "job_listing_id" TEXT NOT NULL,
    "skill_id" TEXT NOT NULL,
    "confidence" DECIMAL(5,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookmarks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_listing_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_records" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_listing_id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "source" "ApplicationSource" NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "application_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_status_histories" (
    "id" TEXT NOT NULL,
    "application_record_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "from_status" "ApplicationStatus",
    "to_status" "ApplicationStatus" NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fit_score_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_listing_id" TEXT NOT NULL,
    "fit_score" INTEGER NOT NULL,
    "readiness_level" TEXT NOT NULL,
    "recommendation_decision" TEXT NOT NULL,
    "recommendation_summary" TEXT NOT NULL,
    "breakdown" JSONB NOT NULL,
    "model_name" TEXT,
    "model_version" TEXT,
    "input_summary" JSONB,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fit_score_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_gap_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_listing_id" TEXT NOT NULL,
    "gaps" JSONB NOT NULL,
    "model_name" TEXT,
    "model_version" TEXT,
    "input_summary" JSONB,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_gap_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_file_metadata" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "original_file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_driver" "StorageDriver" NOT NULL DEFAULT 'LOCAL',
    "storage_key" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cv_file_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cv_analysis_results" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_listing_id" TEXT NOT NULL,
    "cv_file_metadata_id" TEXT,
    "language" "AnalysisLanguage" NOT NULL,
    "input_mode" "CvInputMode" NOT NULL,
    "compare_source" "CvCompareSource" NOT NULL DEFAULT 'JOB_SEARCH',
    "overall_impression" JSONB NOT NULL,
    "job_fit_alignment" JSONB NOT NULL,
    "ats_friendliness" JSONB NOT NULL,
    "keyword_optimization" JSONB NOT NULL,
    "experience_quantification" JSONB NOT NULL,
    "actionable_improvements" JSONB NOT NULL,
    "model_name" TEXT,
    "model_version" TEXT,
    "input_summary" JSONB,
    "analyzed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cv_analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_request_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "kind" "AiRequestKind" NOT NULL,
    "status" "AiRequestStatus" NOT NULL,
    "request_id" TEXT NOT NULL,
    "model_name" TEXT,
    "model_version" TEXT,
    "latency_ms" INTEGER,
    "error_code" TEXT,
    "input_summary" JSONB,
    "output_summary" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_request_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_unique" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "auth_credentials_user_id_unique" ON "auth_credentials"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "auth_credentials_provider_account_unique" ON "auth_credentials"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_unique" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_family_id_idx" ON "refresh_tokens"("token_family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "email_verification_tokens_user_id_idx" ON "email_verification_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_verification_tokens_otp_hash_idx" ON "email_verification_tokens"("otp_hash");

-- CreateIndex
CREATE INDEX "email_verification_tokens_expires_at_idx" ON "email_verification_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_user_id_unique" ON "user_profiles"("user_id");

-- CreateIndex
CREATE INDEX "user_experiences_user_id_idx" ON "user_experiences"("user_id");

-- CreateIndex
CREATE INDEX "user_educations_user_id_idx" ON "user_educations"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_slug_unique" ON "skills"("slug");

-- CreateIndex
CREATE INDEX "skills_name_idx" ON "skills"("name");

-- CreateIndex
CREATE INDEX "user_skills_skill_id_idx" ON "user_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_skills_user_skill_unique" ON "user_skills"("user_id", "skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_unique" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "user_preferences_career_status_idx" ON "user_preferences"("career_status");

-- CreateIndex
CREATE INDEX "user_preferences_job_seeking_status_idx" ON "user_preferences"("job_seeking_status");

-- CreateIndex
CREATE UNIQUE INDEX "source_platforms_slug_unique" ON "source_platforms"("slug");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "companies_slug_idx" ON "companies"("slug");

-- CreateIndex
CREATE INDEX "ingestion_runs_source_platform_id_idx" ON "ingestion_runs"("source_platform_id");

-- CreateIndex
CREATE INDEX "ingestion_runs_started_at_idx" ON "ingestion_runs"("started_at");

-- CreateIndex
CREATE INDEX "job_listings_source_platform_id_idx" ON "job_listings"("source_platform_id");

-- CreateIndex
CREATE INDEX "job_listings_company_id_idx" ON "job_listings"("company_id");

-- CreateIndex
CREATE INDEX "job_listings_normalized_title_idx" ON "job_listings"("normalized_title");

-- CreateIndex
CREATE INDEX "job_listings_province_idx" ON "job_listings"("province");

-- CreateIndex
CREATE INDEX "job_listings_city_idx" ON "job_listings"("city");

-- CreateIndex
CREATE INDEX "job_listings_work_type_idx" ON "job_listings"("work_type");

-- CreateIndex
CREATE INDEX "job_listings_employment_type_idx" ON "job_listings"("employment_type");

-- CreateIndex
CREATE INDEX "job_listings_experience_level_idx" ON "job_listings"("experience_level");

-- CreateIndex
CREATE INDEX "job_listings_salary_min_idx" ON "job_listings"("salary_min");

-- CreateIndex
CREATE INDEX "job_listings_salary_max_idx" ON "job_listings"("salary_max");

-- CreateIndex
CREATE INDEX "job_listings_last_seen_at_idx" ON "job_listings"("last_seen_at");

-- CreateIndex
CREATE INDEX "job_listings_source_posted_at_idx" ON "job_listings"("source_posted_at");

-- CreateIndex
CREATE INDEX "job_listings_status_idx" ON "job_listings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_listings_source_external_id_unique" ON "job_listings"("source_platform_id", "external_job_id");

-- CreateIndex
CREATE INDEX "job_requirements_job_listing_id_idx" ON "job_requirements"("job_listing_id");

-- CreateIndex
CREATE INDEX "job_requirements_type_idx" ON "job_requirements"("type");

-- CreateIndex
CREATE INDEX "job_skills_skill_id_idx" ON "job_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_skills_job_skill_unique" ON "job_skills"("job_listing_id", "skill_id");

-- CreateIndex
CREATE INDEX "bookmarks_user_id_idx" ON "bookmarks"("user_id");

-- CreateIndex
CREATE INDEX "bookmarks_created_at_idx" ON "bookmarks"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bookmarks_user_job_listing_unique" ON "bookmarks"("user_id", "job_listing_id");

-- CreateIndex
CREATE INDEX "application_records_user_id_idx" ON "application_records"("user_id");

-- CreateIndex
CREATE INDEX "application_records_status_idx" ON "application_records"("status");

-- CreateIndex
CREATE INDEX "application_records_updated_at_idx" ON "application_records"("updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "application_records_user_job_listing_unique" ON "application_records"("user_id", "job_listing_id");

-- CreateIndex
CREATE INDEX "application_status_histories_application_record_id_idx" ON "application_status_histories"("application_record_id");

-- CreateIndex
CREATE INDEX "application_status_histories_user_id_idx" ON "application_status_histories"("user_id");

-- CreateIndex
CREATE INDEX "fit_score_results_user_job_listing_idx" ON "fit_score_results"("user_id", "job_listing_id");

-- CreateIndex
CREATE INDEX "fit_score_results_analyzed_at_idx" ON "fit_score_results"("analyzed_at");

-- CreateIndex
CREATE INDEX "skill_gap_results_user_job_listing_idx" ON "skill_gap_results"("user_id", "job_listing_id");

-- CreateIndex
CREATE INDEX "skill_gap_results_analyzed_at_idx" ON "skill_gap_results"("analyzed_at");

-- CreateIndex
CREATE INDEX "cv_file_metadata_user_id_idx" ON "cv_file_metadata"("user_id");

-- CreateIndex
CREATE INDEX "cv_file_metadata_expires_at_idx" ON "cv_file_metadata"("expires_at");

-- CreateIndex
CREATE INDEX "cv_analysis_results_user_job_listing_idx" ON "cv_analysis_results"("user_id", "job_listing_id");

-- CreateIndex
CREATE INDEX "cv_analysis_results_analyzed_at_idx" ON "cv_analysis_results"("analyzed_at");

-- CreateIndex
CREATE INDEX "ai_request_logs_user_id_idx" ON "ai_request_logs"("user_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_request_id_idx" ON "ai_request_logs"("request_id");

-- CreateIndex
CREATE INDEX "ai_request_logs_kind_status_idx" ON "ai_request_logs"("kind", "status");

-- CreateIndex
CREATE INDEX "ai_request_logs_created_at_idx" ON "ai_request_logs"("created_at");

-- AddForeignKey
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_experiences" ADD CONSTRAINT "user_experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_educations" ADD CONSTRAINT "user_educations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_source_platform_id_fkey" FOREIGN KEY ("source_platform_id") REFERENCES "source_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_source_platform_id_fkey" FOREIGN KEY ("source_platform_id") REFERENCES "source_platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_listings" ADD CONSTRAINT "job_listings_ingestion_run_id_fkey" FOREIGN KEY ("ingestion_run_id") REFERENCES "ingestion_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_requirements" ADD CONSTRAINT "job_requirements_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_skills" ADD CONSTRAINT "job_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_records" ADD CONSTRAINT "application_records_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_histories" ADD CONSTRAINT "application_status_histories_application_record_id_fkey" FOREIGN KEY ("application_record_id") REFERENCES "application_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_status_histories" ADD CONSTRAINT "application_status_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_score_results" ADD CONSTRAINT "fit_score_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_score_results" ADD CONSTRAINT "fit_score_results_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gap_results" ADD CONSTRAINT "skill_gap_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_gap_results" ADD CONSTRAINT "skill_gap_results_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_file_metadata" ADD CONSTRAINT "cv_file_metadata_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_analysis_results" ADD CONSTRAINT "cv_analysis_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_analysis_results" ADD CONSTRAINT "cv_analysis_results_job_listing_id_fkey" FOREIGN KEY ("job_listing_id") REFERENCES "job_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cv_analysis_results" ADD CONSTRAINT "cv_analysis_results_cv_file_metadata_id_fkey" FOREIGN KEY ("cv_file_metadata_id") REFERENCES "cv_file_metadata"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_request_logs" ADD CONSTRAINT "ai_request_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
