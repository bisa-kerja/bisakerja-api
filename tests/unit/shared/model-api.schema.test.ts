import { describe, expect, test } from "bun:test";

import {
  cvAnalyzerModelPayloadSchema,
  cvAnalyzerModelResponseSchema,
  jobFitModelPayloadSchema,
  jobFitModelResponseSchema
} from "@/shared/integrations/model-api.schema";
import { modelApiFixtures } from "../../fixtures/model-api";

describe("model api schemas", () => {
  test("accepts valid job fit payload and rejects unknown sensitive fields", () => {
    const result = jobFitModelPayloadSchema.safeParse({
      requestId: "req_job_fit_payload",
      inputVersion: "job-fit-v1",
      user: {
        careerStatus: "EARLY_CAREER",
        skills: [{ name: "TypeScript", level: "INTERMEDIATE" }],
        experience: [
          {
            title: "Backend Intern",
            description: "Built REST APIs",
            isCurrent: false
          }
        ]
      },
      preferences: {
        targetRoles: ["Backend Developer"],
        locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
        workTypes: ["REMOTE"],
        salaryExpectation: {
          min: 5000000,
          max: 9000000,
          currency: "IDR",
          period: "MONTHLY"
        }
      },
      job: {
        id: "job-1",
        title: "Backend Developer",
        description: "Build backend APIs",
        requirements: [
          { type: "SKILL", value: "TypeScript", priority: "HIGH" }
        ],
        skills: ["TypeScript"],
        workType: "REMOTE",
        experienceLevel: "ENTRY_LEVEL",
        location: { province: "DKI Jakarta", city: "Jakarta Selatan" },
        salary: {
          min: 5000000,
          max: 9000000,
          currency: "IDR",
          period: "MONTHLY"
        }
      }
    });

    expect(result.success).toBe(true);

    expect(
      jobFitModelPayloadSchema.safeParse({
        requestId: "req_job_fit_payload",
        inputVersion: "job-fit-v1",
        user: {
          careerStatus: "EARLY_CAREER",
          skills: [],
          experience: [],
          password: "secret"
        },
        preferences: {
          targetRoles: ["Backend Developer"],
          locations: [{ province: "DKI Jakarta" }],
          workTypes: ["REMOTE"],
          salaryExpectation: null
        },
        job: {
          id: "job-1",
          title: "Backend Developer",
          description: "Build backend APIs",
          requirements: [],
          skills: [],
          workType: "REMOTE",
          experienceLevel: "ENTRY_LEVEL",
          location: null,
          salary: null
        }
      }).success
    ).toBe(false);
  });

  test("accepts valid cv analyzer payload and rejects unsupported language", () => {
    expect(
      cvAnalyzerModelPayloadSchema.safeParse({
        requestId: "req_cv_payload",
        inputVersion: "cv-analyzer-v1",
        language: "ID",
        inputMode: "UPLOAD",
        compareSource: "JOB_SEARCH",
        cv: {
          fileId: "cv-1",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          storageKey: "cv/user-1/cv-1.pdf"
        },
        job: {
          id: "job-1",
          title: "Backend Developer",
          description: "Build backend APIs",
          requirements: [],
          skills: ["TypeScript"],
          experienceLevel: "ENTRY_LEVEL"
        }
      }).success
    ).toBe(true);

    expect(
      cvAnalyzerModelPayloadSchema.safeParse({
        requestId: "req_cv_payload",
        inputVersion: "cv-analyzer-v1",
        language: "id",
        inputMode: "UPLOAD",
        compareSource: "JOB_SEARCH",
        cv: {
          fileId: "cv-1",
          mimeType: "application/pdf",
          sizeBytes: 1024,
          storageKey: "cv/user-1/cv-1.pdf"
        },
        job: {
          id: "job-1",
          title: "Backend Developer",
          description: "Build backend APIs",
          requirements: [],
          skills: ["TypeScript"],
          experienceLevel: "ENTRY_LEVEL"
        }
      }).success
    ).toBe(false);
  });

  test("accepts valid model responses and rejects out-of-range scores", () => {
    expect(
      jobFitModelResponseSchema.safeParse(modelApiFixtures.validJobFitResponse)
        .success
    ).toBe(true);
    expect(
      cvAnalyzerModelResponseSchema.safeParse(
        modelApiFixtures.validCvAnalyzerResponse
      ).success
    ).toBe(true);

    expect(
      jobFitModelResponseSchema.safeParse({
        ...modelApiFixtures.validJobFitResponse,
        fitScore: 101
      }).success
    ).toBe(false);

    expect(
      cvAnalyzerModelResponseSchema.safeParse({
        ...modelApiFixtures.validCvAnalyzerResponse,
        overallImpression: {
          ...modelApiFixtures.validCvAnalyzerResponse.overallImpression,
          score: -1
        }
      }).success
    ).toBe(false);
  });
});
