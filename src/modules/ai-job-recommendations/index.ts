export {
  AiJobRecommendationsService,
  buildRecommendationPayload,
  buildTalentProfile
} from "@/modules/ai-job-recommendations/ai-job-recommendations.service";
export { PrismaAiJobRecommendationsRepository } from "@/modules/ai-job-recommendations/ai-job-recommendations.repository";
export type {
  AiJobRecommendationsRepository,
  CvAnalysisResolverRecord,
  JobRecommendationRunSnapshotInput,
  JobRecommendationResource,
  JobRecommendationRunDetailRecord,
  RecommendationCandidateRecord
} from "@/modules/ai-job-recommendations/ai-job-recommendations.types";
