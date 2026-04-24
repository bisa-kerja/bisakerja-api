import { z } from "zod";

import {
  allowedEmploymentTypes,
  allowedExperienceLevels,
  allowedWorkTypes,
  allowedCareerStatuses
} from "@/shared/constants/domain-vocabulary";
import { allowedSkillGapPriorities } from "@/shared/integrations/model-api.constants";
import {
  allowedAnalysisLanguages,
  allowedCvCompareSources,
  allowedCvInputModes,
  allowedJobFitReadinessLevels,
  allowedJobFitRecommendationDecisions,
  allowedRequirementPriorities,
  allowedRequirementTypes,
  modelApiInputVersions
} from "@/shared/integrations/model-api.constants";

const scoreSchema = z.int().min(0).max(100);
const isoDatetimeSchema = z.iso.datetime({ offset: true });

const locationSchema = z.strictObject({
  province: z.string().min(1).max(120),
  city: z.string().min(1).max(120).nullable().optional()
});

const salaryExpectationSchema = z.strictObject({
  min: z.int().nonnegative().nullable(),
  max: z.int().nonnegative().nullable(),
  currency: z.string().trim().min(3).max(3),
  period: z.enum(["MONTHLY", "YEARLY"])
});

const jobRequirementSchema = z.strictObject({
  type: z.enum(allowedRequirementTypes),
  value: z.string().min(1).max(500),
  priority: z.enum(allowedRequirementPriorities)
});

const jobFitUserSkillSchema = z.strictObject({
  name: z.string().min(1).max(80),
  level: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]).nullable().optional()
});

const jobFitUserExperienceSchema = z.strictObject({
  title: z.string().min(1).max(120),
  company: z.string().min(1).max(120).nullable().optional(),
  employmentType: z.enum(allowedEmploymentTypes).nullable().optional(),
  startDate: z.iso.date().nullable().optional(),
  endDate: z.iso.date().nullable().optional(),
  isCurrent: z.boolean().optional(),
  description: z.string().min(1).max(2000).nullable().optional()
});

export const jobFitModelPayloadSchema = z.strictObject({
  requestId: z.string().min(1).max(200),
  inputVersion: z.literal(modelApiInputVersions.jobFit),
  user: z.strictObject({
    careerStatus: z.enum(allowedCareerStatuses).nullable(),
    skills: z.array(jobFitUserSkillSchema).max(100),
    experience: z.array(jobFitUserExperienceSchema).max(100)
  }),
  preferences: z.strictObject({
    targetRoles: z.array(z.string().min(1).max(120)).min(1).max(20),
    locations: z.array(locationSchema).min(1).max(20),
    workTypes: z.array(z.enum(allowedWorkTypes)).min(1).max(3),
    salaryExpectation: salaryExpectationSchema.nullable()
  }),
  job: z.strictObject({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(20000).nullable(),
    requirements: z.array(jobRequirementSchema).max(200),
    skills: z.array(z.string().min(1).max(80)).max(200),
    workType: z.enum(allowedWorkTypes).nullable(),
    experienceLevel: z.enum(allowedExperienceLevels).nullable(),
    location: locationSchema.nullable(),
    salary: salaryExpectationSchema.nullable()
  })
});

export const jobFitModelResponseSchema = z.strictObject({
  fitScore: scoreSchema,
  readinessLevel: z.enum(allowedJobFitReadinessLevels),
  recommendation: z.strictObject({
    decision: z.enum(allowedJobFitRecommendationDecisions),
    summary: z.string().min(1).max(2000),
    nextSteps: z.array(z.string().min(1).max(500)).max(20),
    successProbability: z.number().min(0).max(1).nullable().optional()
  }),
  breakdown: z.strictObject({
    skillMatch: z.strictObject({
      score: scoreSchema,
      matchedSkills: z.array(z.string().min(1).max(80)).max(200),
      missingSkills: z.array(z.string().min(1).max(80)).max(200)
    }),
    experienceMatch: z.strictObject({
      score: scoreSchema,
      reason: z.string().min(1).max(2000)
    }),
    preferenceMatch: z.strictObject({
      score: scoreSchema,
      matchedPreferences: z.array(z.string().min(1).max(120)).max(50),
      unmatchedPreferences: z.array(z.string().min(1).max(120)).max(50)
    })
  }),
  skillGaps: z.array(
    z.strictObject({
      skill: z.string().min(1).max(120),
      priority: z.enum(allowedSkillGapPriorities),
      reason: z.string().min(1).max(1000)
    })
  ),
  model: z.strictObject({
    name: z.string().min(1).max(120),
    version: z.string().min(1).max(120)
  }),
  analyzedAt: isoDatetimeSchema
});

export const cvAnalyzerModelPayloadSchema = z.strictObject({
  requestId: z.string().min(1).max(200),
  inputVersion: z.literal(modelApiInputVersions.cvAnalyzer),
  language: z.enum(allowedAnalysisLanguages),
  inputMode: z.enum(allowedCvInputModes),
  compareSource: z.enum(allowedCvCompareSources),
  cv: z.strictObject({
    fileId: z.string().min(1).max(200),
    mimeType: z.string().min(1).max(100),
    sizeBytes: z.int().positive(),
    storageKey: z.string().min(1).max(512)
  }),
  job: z.strictObject({
    id: z.string().min(1).max(200),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(20000).nullable(),
    requirements: z.array(jobRequirementSchema).max(200),
    skills: z.array(z.string().min(1).max(80)).max(200),
    experienceLevel: z.enum(allowedExperienceLevels).nullable()
  })
});

export const cvAnalyzerModelResponseSchema = z.strictObject({
  overallImpression: z.strictObject({
    score: scoreSchema,
    summary: z.string().min(1).max(2000)
  }),
  jobFitAlignment: z.strictObject({
    score: scoreSchema,
    summary: z.string().min(1).max(2000),
    matchedSignals: z.array(z.string().min(1).max(200)).max(100),
    missingSignals: z.array(z.string().min(1).max(200)).max(100)
  }),
  atsFriendliness: z.strictObject({
    score: scoreSchema,
    issues: z.array(z.string().min(1).max(500)).max(50)
  }),
  keywordOptimization: z.strictObject({
    recommendedKeywords: z.array(z.string().min(1).max(120)).max(100),
    reason: z.string().min(1).max(2000)
  }),
  experienceQuantification: z.strictObject({
    score: scoreSchema,
    suggestions: z.array(z.string().min(1).max(500)).max(50)
  }),
  actionableImprovements: z.array(z.string().min(1).max(500)).max(50),
  model: z.strictObject({
    name: z.string().min(1).max(120),
    version: z.string().min(1).max(120)
  }),
  analyzedAt: isoDatetimeSchema
});

export type JobFitModelPayload = z.infer<typeof jobFitModelPayloadSchema>;
export type JobFitModelResponse = z.infer<typeof jobFitModelResponseSchema>;
export type CvAnalyzerModelPayload = z.infer<
  typeof cvAnalyzerModelPayloadSchema
>;
export type CvAnalyzerModelResponse = z.infer<
  typeof cvAnalyzerModelResponseSchema
>;
