-- CreateEnum
CREATE TYPE "AsyncJobType" AS ENUM (
    'AUTH_EMAIL_VERIFICATION',
    'AUTH_PASSWORD_RESET',
    'MAINTENANCE_CV_CLEANUP'
);

-- CreateEnum
CREATE TYPE "AsyncJobStatus" AS ENUM (
    'PENDING',
    'QUEUED',
    'PROCESSING',
    'SUCCEEDED',
    'DEAD_LETTER'
);

-- CreateTable
CREATE TABLE "async_job_outbox" (
    "id" TEXT NOT NULL,
    "job_type" "AsyncJobType" NOT NULL,
    "status" "AsyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "request_id" TEXT,
    "actor_id" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "processing_started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "dead_lettered_at" TIMESTAMP(3),
    "last_error_code" TEXT,
    "last_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "async_job_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "async_job_outbox_idempotency_key_unique" ON "async_job_outbox"("idempotency_key");

-- CreateIndex
CREATE INDEX "async_job_outbox_status_scheduled_at_idx" ON "async_job_outbox"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "async_job_outbox_job_type_status_idx" ON "async_job_outbox"("job_type", "status");
