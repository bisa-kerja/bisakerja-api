import {
  DownstreamError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError
} from "@/core/errors/app.error";
import {
  aiJobRecommendationsErrorCodes,
  defaultJobRecommendationLimit,
  maxModelCandidateJobs
} from "@/modules/ai-job-recommendations/ai-job-recommendations.constants";
import type {
  GenerateJobRecommendationsInput,
  GetJobRecommendationsQueryInput
} from "@/modules/ai-job-recommendations/ai-job-recommendations.schema";
import type {
  AiJobRecommendationsRepository,
  AiJobRecommendationsServiceOptions,
  BuildRecommendationPayloadInput,
  BuildTalentProfileInput,
  CandidatePayloadItem,
  CvAnalysisResolverRecord,
  JobRecommendationModelOutput,
  JobRecommendationRequestContext,
  JobRecommendationResource,
  JobRecommendationRunDetailRecord,
  RecommendationCandidateRecord,
  TalentProfileResource
} from "@/modules/ai-job-recommendations/ai-job-recommendations.types";
import type {
  JobRecommendationModelPayload,
  JobRecommendationModelResponse
} from "@/shared/integrations/model-api.schema";

export class AiJobRecommendationsService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: AiJobRecommendationsRepository,
    private readonly options: AiJobRecommendationsServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async generateRecommendations(
    userId: string,
    requestId: string,
    input: GenerateJobRecommendationsInput
  ): Promise<JobRecommendationResource> {
    if (input.idempotencyKey) {
      const existingRun =
        await this.repository.findRecommendationRunByUserAndIdempotencyKey(
          userId,
          input.idempotencyKey
        );

      if (existingRun) {
        return toRecommendationResource(existingRun, input.limit);
      }
    }

    const cvAnalysisResult = await resolveCvAnalysisResult(
      this.repository,
      userId,
      input.cvAnalysisResultId
    );
    const preference = await this.repository.findUserPreference(userId);
    const candidates =
      await this.repository.findCandidateJobsForRecommendations({
        userId,
        cvAnalysisResult,
        filters: input.filters,
        limit: maxModelCandidateJobs
      });

    const context: JobRecommendationRequestContext = {
      userId,
      cvAnalysisResult,
      preference,
      candidates
    };

    if (candidates.length === 0) {
      const emptyRun = await this.repository.createRecommendationRunSnapshot({
        userId,
        cvAnalysisResultId: cvAnalysisResult.id,
        idempotencyKey: input.idempotencyKey ?? null,
        requestedLimit: input.limit,
        candidateCount: 0,
        recommendationCount: 0,
        modelName: "no-candidates",
        modelVersion: "v1",
        filtersSnapshot: input.filters ?? null,
        inputSummary: buildRecommendationPayload({
          requestId,
          context,
          limit: input.limit
        }),
        createdAt: this.now(),
        items: []
      });

      return toRecommendationResource(emptyRun, input.limit);
    }

    const payload = buildRecommendationPayload({
      requestId,
      context,
      limit: input.limit
    });
    if (!this.options.modelApiClient.recommendJobs) {
      throw new ServiceUnavailableError(
        "Client Model API rekomendasi pekerjaan belum tersedia",
        aiJobRecommendationsErrorCodes.modelServiceUnavailable
      );
    }

    const modelResponse = await callRecommendationModelApi(
      this.options.modelApiClient.recommendJobs(payload)
    );
    const selectedRecommendations = validateAndSelectRecommendations(
      modelResponse,
      context.candidates,
      input.limit
    );

    const run = await this.repository.createRecommendationRunSnapshot({
      userId,
      cvAnalysisResultId: cvAnalysisResult.id,
      idempotencyKey: input.idempotencyKey ?? null,
      requestedLimit: input.limit,
      candidateCount: context.candidates.length,
      recommendationCount: selectedRecommendations.length,
      modelName: modelResponse.model.name,
      modelVersion: modelResponse.model.version,
      filtersSnapshot: input.filters ?? null,
      inputSummary: payload,
      createdAt: new Date(modelResponse.analyzedAt),
      items: selectedRecommendations.map((item, index) => ({
        jobListingId: item.jobId,
        rank: index + 1,
        matchScore: item.matchScore,
        matchLevel: toPersistenceMatchLevel(item.matchLevel),
        reasons: item.reasons,
        matchedSkills: item.matchedSkills,
        missingSkills: item.missingSkills,
        nextSteps: item.nextSteps
      }))
    });

    return toRecommendationResource(run, input.limit);
  }

  async getLatestRecommendations(
    userId: string,
    query: GetJobRecommendationsQueryInput
  ): Promise<JobRecommendationResource> {
    const run =
      await this.repository.findLatestRecommendationRunForUser(userId);

    if (!run) {
      throw new NotFoundError(
        "Rekomendasi pekerjaan belum tersedia",
        aiJobRecommendationsErrorCodes.jobRecommendationNotFound
      );
    }

    return toRecommendationResource(run, query.limit);
  }

  async getRecommendationRunDetail(
    userId: string,
    recommendationRunId: string,
    query: GetJobRecommendationsQueryInput
  ): Promise<JobRecommendationResource> {
    const run = await this.repository.findRecommendationRunByIdForUser(
      userId,
      recommendationRunId
    );

    if (!run) {
      throw new NotFoundError(
        "Rekomendasi pekerjaan tidak ditemukan",
        aiJobRecommendationsErrorCodes.jobRecommendationNotFound
      );
    }

    return toRecommendationResource(run, query.limit);
  }
}

export function buildRecommendationPayload(
  input: BuildRecommendationPayloadInput
): JobRecommendationModelPayload {
  const rankedCandidates = rankCandidatesDeterministically(input.context).slice(
    0,
    maxModelCandidateJobs
  );

  return {
    requestId: input.requestId,
    inputVersion: "job-recommendations-v1",
    talentProfile: buildTalentProfile({
      cvAnalysisResult: input.context.cvAnalysisResult,
      preference: input.context.preference
    }),
    rankingPolicy: {
      maxRecommendations: Math.max(1, Math.min(input.limit, 20)),
      requireCandidateJobIds: true,
      deduplicateByJobId: true
    },
    jobCandidates: rankedCandidates.map((candidate) =>
      buildCandidatePayload(candidate)
    )
  };
}

export function buildTalentProfile(
  input: BuildTalentProfileInput
): TalentProfileResource {
  const cvAnalysisResult = input.cvAnalysisResult;
  const preference = input.preference;
  const hardSkills = dedupeCaseInsensitive([
    ...cvAnalysisResult.jobFitAlignment.matchedSignals,
    ...cvAnalysisResult.job.skills.map((skill) => skill.name)
  ]);
  const missingSkills = dedupeCaseInsensitive(
    cvAnalysisResult.jobFitAlignment.missingSignals
  );
  const toolsAndTechnologies = dedupeCaseInsensitive([
    ...cvAnalysisResult.topActionables,
    ...cvAnalysisResult.sectionReviews.flatMap(
      (section) => section.actionPoints
    )
  ]);

  return {
    targetRole:
      preference?.targetRoles.at(0) ??
      cvAnalysisResult.job.normalizedTitle ??
      cvAnalysisResult.job.title,
    seniorityLevel: cvAnalysisResult.job.experienceLevel,
    hardSkills,
    softSkills: [],
    domainSignals: dedupeCaseInsensitive([
      cvAnalysisResult.job.category ?? "",
      cvAnalysisResult.job.requirementSummary ?? ""
    ]),
    toolsAndTechnologies,
    educationSignals: [],
    experienceYearsEstimate: null,
    locationPreferences: preference?.locations ?? [],
    workTypePreferences: preference?.workTypes ?? [],
    salaryExpectation: preference?.salaryExpectation ?? null,
    redFlags: missingSkills.slice(0, 10)
  };
}

function buildCandidatePayload(
  candidate: RecommendationCandidateRecord
): CandidatePayloadItem {
  const job = candidate.job;

  return {
    jobId: job.id,
    title: job.title,
    companyName: job.company.name,
    location: {
      display: job.location.display,
      province: job.location.province,
      city: job.location.city
    },
    workType: job.workType,
    experienceLevel: job.experienceLevel,
    descriptionSummary: summarizeJobDescription(job),
    requiredSkills: dedupeCaseInsensitive([
      ...job.skills.map((skill) => skill.name),
      ...job.requirements
        .filter((requirement) => requirement.type === "SKILL")
        .map((requirement) => requirement.value)
    ]),
    postedAt: job.postedAt?.toISOString() ?? null,
    sourceUpdatedAt: job.sourceUpdatedAt?.toISOString() ?? null
  };
}

function summarizeJobDescription(job: RecommendationCandidateRecord["job"]) {
  const source = job.requirementSummary ?? job.description ?? "";
  const normalized = source.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > 1200
    ? `${normalized.slice(0, 1200)}...`
    : normalized;
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function rankCandidatesDeterministically(
  context: JobRecommendationRequestContext
): RecommendationCandidateRecord[] {
  const profile = buildTalentProfile({
    cvAnalysisResult: context.cvAnalysisResult,
    preference: context.preference
  });
  const preferredRole = profile.targetRole?.toLowerCase() ?? "";
  const preferredSkillSet = new Set(
    profile.hardSkills.map((skill) => skill.toLowerCase())
  );

  return [...context.candidates].sort((left, right) => {
    const leftScore = scoreCandidate(left, preferredRole, preferredSkillSet);
    const rightScore = scoreCandidate(right, preferredRole, preferredSkillSet);

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    const leftRecency =
      left.job.postedAt?.getTime() ?? left.job.lastSeenAt.getTime();
    const rightRecency =
      right.job.postedAt?.getTime() ?? right.job.lastSeenAt.getTime();
    if (leftRecency !== rightRecency) {
      return rightRecency - leftRecency;
    }

    return left.job.id.localeCompare(right.job.id);
  });
}

function scoreCandidate(
  candidate: RecommendationCandidateRecord,
  preferredRole: string,
  preferredSkillSet: Set<string>
): number {
  let score = 0;
  const title = candidate.job.title.toLowerCase();
  if (preferredRole && title.includes(preferredRole)) {
    score += 40;
  }

  const jobSkills = dedupeCaseInsensitive([
    ...candidate.job.skills.map((skill) => skill.name),
    ...candidate.job.requirements
      .filter((requirement) => requirement.type === "SKILL")
      .map((requirement) => requirement.value)
  ]);
  const matchedSkillCount = jobSkills.filter((skill) =>
    preferredSkillSet.has(skill.toLowerCase())
  ).length;
  score += Math.min(40, matchedSkillCount * 6);

  if (candidate.job.workType === "REMOTE") {
    score += 5;
  }
  if (candidate.isBookmarked) {
    score += 3;
  }
  if (candidate.hasApplied) {
    score -= 20;
  }

  return score;
}

function validateAndSelectRecommendations(
  response: JobRecommendationModelResponse,
  candidates: RecommendationCandidateRecord[],
  limit: number
): JobRecommendationModelOutput[] {
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.job.id, candidate])
  );
  const selected: JobRecommendationModelOutput[] = [];
  const seen = new Set<string>();

  for (const recommendation of response.recommendations) {
    if (!candidateMap.has(recommendation.jobId)) {
      throw new DownstreamError(
        "Model API mengembalikan jobId yang tidak ada pada kandidat backend",
        aiJobRecommendationsErrorCodes.modelResponseInvalid,
        {
          jobId: recommendation.jobId
        }
      );
    }

    if (seen.has(recommendation.jobId)) {
      throw new DownstreamError(
        "Model API mengembalikan duplikasi jobId pada rekomendasi",
        aiJobRecommendationsErrorCodes.modelResponseInvalid,
        {
          jobId: recommendation.jobId
        }
      );
    }

    seen.add(recommendation.jobId);
    selected.push(recommendation);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

async function resolveCvAnalysisResult(
  repository: AiJobRecommendationsRepository,
  userId: string,
  cvAnalysisResultId: string | undefined
): Promise<CvAnalysisResolverRecord> {
  if (cvAnalysisResultId) {
    const result = await repository.findCvAnalysisResultByIdForUser(
      userId,
      cvAnalysisResultId
    );

    if (!result) {
      throw new NotFoundError(
        "Hasil analisis CV tidak ditemukan",
        aiJobRecommendationsErrorCodes.cvAnalysisResultNotFound
      );
    }

    return result;
  }

  const latestResult =
    await repository.findLatestCvAnalysisResultForUser(userId);
  if (!latestResult) {
    throw new ValidationError("Hasil analisis CV belum tersedia", [
      {
        path: "cvAnalysisResultId",
        message:
          "Jalankan analisis CV terlebih dahulu sebelum meminta rekomendasi pekerjaan",
        code: aiJobRecommendationsErrorCodes.cvAnalysisRequired.toLowerCase()
      }
    ]);
  }

  return latestResult;
}

async function callRecommendationModelApi(
  promise: Promise<JobRecommendationModelResponse>
) {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw new ServiceUnavailableError(
        "Layanan model rekomendasi pekerjaan sementara tidak tersedia",
        aiJobRecommendationsErrorCodes.modelServiceUnavailable,
        error.details
      );
    }

    if (error instanceof DownstreamError) {
      throw new DownstreamError(
        "Response model rekomendasi pekerjaan tidak valid",
        aiJobRecommendationsErrorCodes.modelResponseInvalid,
        error.details
      );
    }

    throw error;
  }
}

function toRecommendationResource(
  run: JobRecommendationRunDetailRecord,
  limit: number = defaultJobRecommendationLimit
): JobRecommendationResource {
  const visibleItems = run.items.filter((item) =>
    isVisibleRecommendationJob(item.job)
  );
  const slicedItems = visibleItems.slice(0, limit);

  return {
    recommendationRun: {
      id: run.id,
      cvAnalysisResultId: run.cvAnalysisResultId,
      generatedAt: run.createdAt.toISOString(),
      modelName: run.modelName,
      modelVersion: run.modelVersion,
      candidateCount: run.candidateCount,
      recommendationCount: slicedItems.length
    },
    recommendations: slicedItems.map((item) => ({
      job: {
        id: item.job.id,
        title: item.job.title,
        companyName: item.job.company.name,
        location: item.job.location.display,
        workType: item.job.workType,
        experienceLevel: item.job.experienceLevel
      },
      matchScore: item.matchScore,
      matchLevel: toResponseMatchLevel(item.matchLevel),
      reasons: item.reasons,
      matchedSkills: item.matchedSkills,
      missingSkills: item.missingSkills,
      nextSteps: item.nextSteps,
      isBookmarked: item.isBookmarked,
      hasApplied: item.hasApplied
    }))
  };
}

function isVisibleRecommendationJob(job: RecommendationCandidateRecord["job"]) {
  if (!(job.status === "ACTIVE" || job.status === "STALE")) {
    return false;
  }

  if (job.expiredAt && job.expiredAt.getTime() <= Date.now()) {
    return false;
  }

  return true;
}

function toPersistenceMatchLevel(value: "strong" | "good" | "stretch") {
  if (value === "strong") {
    return "STRONG" as const;
  }

  if (value === "good") {
    return "GOOD" as const;
  }

  return "STRETCH" as const;
}

function toResponseMatchLevel(value: "STRONG" | "GOOD" | "STRETCH") {
  if (value === "STRONG") {
    return "strong" as const;
  }

  if (value === "GOOD") {
    return "good" as const;
  }

  return "stretch" as const;
}
