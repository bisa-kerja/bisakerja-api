import { ConflictError, NotFoundError } from "@/core/errors/app.error";
import { aiJobFitErrorCodes } from "@/modules/ai-job-fit/ai-job-fit.constants";
import type { AnalyzeJobFitInput } from "@/modules/ai-job-fit/ai-job-fit.schema";
import type {
  AiJobFitRepository,
  AiJobFitServiceOptions,
  AiJobFitUserContext,
  JobFitAnalysisResult,
  JobFitPayloadPreferences,
  JobFitPayloadUser,
  JobFitResource
} from "@/modules/ai-job-fit/ai-job-fit.types";
import type { JobRecord } from "@/modules/jobs";
import { jobsErrorCodes } from "@/modules/jobs/jobs.constants";
import type {
  JobFitModelPayload,
  JobFitModelResponse
} from "@/shared/integrations/model-api.schema";

export class AiJobFitService {
  constructor(
    private readonly repository: AiJobFitRepository,
    private readonly options: AiJobFitServiceOptions
  ) {}

  async analyzeJobFit(
    userId: string,
    requestId: string,
    input: AnalyzeJobFitInput
  ): Promise<JobFitAnalysisResult> {
    const context = await this.repository.findUserContext(userId);
    const job = await this.repository.findVisibleJob(input.jobId);

    if (!job) {
      throw new NotFoundError(
        "Lowongan tidak ditemukan",
        jobsErrorCodes.jobNotFound
      );
    }

    if (!context || !hasRequiredProfileContext(context)) {
      throw new ConflictError(
        "Data profil belum lengkap untuk analisis kecocokan pekerjaan",
        aiJobFitErrorCodes.profileIncomplete
      );
    }

    if (!context.preference || !hasRequiredPreferenceContext(context)) {
      throw new ConflictError(
        "Data preferensi belum lengkap untuk analisis kecocokan pekerjaan",
        aiJobFitErrorCodes.preferencesIncomplete
      );
    }

    const payload = buildJobFitPayload(requestId, context, job);
    const response = await this.options.modelApiClient.analyzeJobFit(payload);
    const persisted = input.persistResult;

    if (persisted) {
      await this.repository.createSnapshot({
        userId,
        jobId: job.id,
        payload,
        response
      });
    }

    return {
      resource: mapJobFitResource(job.id, response),
      persisted
    };
  }
}

export function hasRequiredProfileContext(
  context: AiJobFitUserContext
): boolean {
  if (!context.profile) {
    return false;
  }

  if (context.skills.length > 0 || context.experience.length > 0) {
    return true;
  }

  return Boolean(context.profile.careerStatus ?? context.profile.latestRole);
}

export function hasRequiredPreferenceContext(
  context: AiJobFitUserContext
): boolean {
  const preference = context.preference;

  if (!preference) {
    return false;
  }

  return (
    preference.targetRoles.length > 0 &&
    preference.locations.length > 0 &&
    preference.workTypes.length > 0
  );
}

export function buildJobFitPayload(
  requestId: string,
  context: AiJobFitUserContext,
  job: JobRecord
): JobFitModelPayload {
  return {
    requestId,
    inputVersion: "job-fit-v1",
    user: buildUserPayload(context),
    preferences: buildPreferencePayload(context),
    job: {
      id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements.map((requirement) => ({
        type: requirement.type,
        value: requirement.value,
        priority: requirement.priority ?? "LOW"
      })),
      skills: job.skills.map((skill) => skill.name),
      workType: job.workType,
      experienceLevel: job.experienceLevel,
      location: job.location.province
        ? {
            province: job.location.province,
            city: job.location.city
          }
        : null,
      salary: job.salary.period
        ? {
            min: job.salary.min,
            max: job.salary.max,
            currency: job.salary.currency,
            period: job.salary.period
          }
        : null
    }
  };
}

export function buildUserPayload(
  context: AiJobFitUserContext
): JobFitPayloadUser {
  return {
    careerStatus: context.profile?.careerStatus ?? null,
    skills: context.skills.map((skill) => ({
      name: skill.name,
      level: skill.level
    })),
    experience: context.experience.map((experience) => ({
      title: experience.title,
      company: experience.company,
      employmentType: experience.employmentType,
      startDate: experience.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: experience.endDate?.toISOString().slice(0, 10) ?? null,
      isCurrent: experience.isCurrent,
      description: experience.description
    }))
  };
}

export function buildPreferencePayload(
  context: AiJobFitUserContext
): JobFitPayloadPreferences {
  const preference = context.preference;

  if (!preference) {
    return {
      targetRoles: [],
      locations: [],
      workTypes: [],
      salaryExpectation: null
    };
  }

  return {
    targetRoles: preference.targetRoles,
    locations: preference.locations,
    workTypes: preference.workTypes,
    salaryExpectation: preference.salaryExpectation
  };
}

export function mapJobFitResource(
  jobId: string,
  response: JobFitModelResponse
): JobFitResource {
  return {
    jobId,
    fitScore: response.fitScore,
    readinessLevel: response.readinessLevel,
    recommendation: {
      decision: response.recommendation.decision,
      summary: response.recommendation.summary,
      nextSteps: response.recommendation.nextSteps,
      successProbability: response.recommendation.successProbability ?? null
    },
    breakdown: response.breakdown,
    skillGaps: response.skillGaps,
    model: response.model,
    analyzedAt: response.analyzedAt
  };
}
