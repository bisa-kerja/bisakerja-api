import type { AppConfig } from "@/config/env";
import { createAuthEmailProvider } from "@/modules/auth";
import {
  LocalCvFileStorage,
  PrismaAiCvAnalyzerRepository,
  cleanupExpiredCvFiles
} from "@/modules/ai-cv-analyzer";
import type {
  AuthEmailVerificationJobPayload,
  AuthPasswordResetJobPayload,
  AsyncJobProcessor,
  AsyncJobProcessorDependencies,
  AsyncJobRecord
} from "@/shared/async-workloads/async-workloads.types";

export function createAsyncJobProcessor(
  dependencies: AsyncJobProcessorDependencies
): AsyncJobProcessor {
  return new DefaultAsyncJobProcessor(dependencies.config);
}

class DefaultAsyncJobProcessor implements AsyncJobProcessor {
  constructor(private readonly config: AppConfig) {}

  async process(job: AsyncJobRecord): Promise<void> {
    switch (job.jobType) {
      case "auth.email-verification": {
        const payload = job.payload as AuthEmailVerificationJobPayload;

        await createAuthEmailProvider(this.config).sendEmailVerification({
          email: payload.email,
          otp: payload.otp,
          expiresAt: new Date(payload.expiresAt)
        });
        return;
      }

      case "auth.password-reset": {
        const payload = job.payload as AuthPasswordResetJobPayload;

        await createAuthEmailProvider(this.config).sendPasswordReset({
          email: payload.email,
          token: payload.token,
          expiresAt: new Date(payload.expiresAt)
        });
        return;
      }

      case "maintenance.cv-cleanup": {
        const repository = new PrismaAiCvAnalyzerRepository();
        const storage = new LocalCvFileStorage(this.config.uploads.storagePath);

        await cleanupExpiredCvFiles(repository, storage, new Date());
        return;
      }
    }
  }
}
