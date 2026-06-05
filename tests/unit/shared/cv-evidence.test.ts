import { describe, expect, it } from "bun:test";

import {
  backendCvEvidenceParserVersion,
  buildBackendParsedSharedCvEvidence,
  buildModelApiSharedCvEvidence,
  buildSharedCvEvidenceObservability,
  cvGenerateTemplatePolicyVersion,
  hashSharedCvEvidenceSource,
  isSharedCvEvidenceFresh,
  modelApiCvEvidenceParserVersion,
  mvpCvParserOwnershipDecision
} from "@/shared/cv-evidence";
import { modelApiFixtures } from "../../fixtures/model-api";

const now = new Date("2026-06-04T00:00:00.000Z");
const metadata = {
  id: "11111111-1111-4111-8111-111111111111",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  uploadedAt: now,
  expiresAt: new Date("2026-06-05T00:00:00.000Z")
};
const cvText = [
  "Summary",
  "Backend REST API candidate with PostgreSQL delivery experience.",
  "Experience",
  "Built Express services for job matching.",
  "Skills",
  "TypeScript, PostgreSQL, REST API",
  "email@example.test +62 812 3333 4444"
].join("\n");

describe("shared CV evidence", () => {
  it("builds sanitized Backend-owned evidence cache from CV bytes", () => {
    const evidence = buildBackendParsedSharedCvEvidence({
      metadata,
      cvBytes: Buffer.from(cvText),
      latestAnalysis: null,
      now,
      retentionDays: 1,
      templatePolicyVersion: cvGenerateTemplatePolicyVersion
    });

    expect(evidence).toMatchObject({
      schemaVersion: "shared-cv-evidence-v1",
      source: "backend_parser",
      parserOwner: "backend_mvp",
      parserVersion: backendCvEvidenceParserVersion,
      parserConfidence: "medium",
      cvFile: {
        fileId: metadata.id,
        mimeType: "application/pdf",
        fileSize: 2048
      },
      candidateSummary:
        "Backend REST API candidate with PostgreSQL delivery experience.",
      skillEvidence: {
        skillsByCategory: [
          {
            category: "parsed_skills",
            skills: ["typescript", "postgresql", "rest api"]
          }
        ]
      },
      contactRedactionPolicy: "contact_data_removed",
      privacy: {
        rawCvTextRetained: false,
        contactDataRetained: false,
        storageIdentifierRetained: false
      }
    });
    expect(evidence.cache.invalidationPolicy).toMatchObject({
      parserVersion: backendCvEvidenceParserVersion,
      templatePolicyVersion: cvGenerateTemplatePolicyVersion
    });
    expect(JSON.stringify(evidence)).not.toContain("email@example.test");
    expect(JSON.stringify(evidence)).not.toContain("+62 812 3333 4444");
  });

  it("builds Model API evidence with requirement coverage for analyzer wrapper", () => {
    const evidence = buildModelApiSharedCvEvidence({
      metadata,
      cvBytes: Buffer.from(cvText),
      modelCoreResponse: modelApiFixtures.validCvAnalyzerResponse,
      now,
      retentionDays: 1
    });

    expect(evidence).toMatchObject({
      source: "model_api",
      parserOwner: "model_api_primary",
      parserVersion: modelApiCvEvidenceParserVersion,
      parserConfidence: "high",
      skillEvidence: {
        requirementCoverage: [
          {
            requirement: "TypeScript",
            status: "matched"
          },
          {
            requirement: "PostgreSQL",
            status: "matched"
          },
          {
            requirement: "Docker",
            status: "missing"
          }
        ]
      }
    });
    expect(evidence.cache.invalidationPolicy.analysisModelVersion).toBe(
      "fixture-cv-analyzer-model:test-2026-01"
    );
  });

  it("invalidates cache when source, parser, model, template, or retention changes", () => {
    const evidence = buildBackendParsedSharedCvEvidence({
      metadata,
      cvBytes: Buffer.from(cvText),
      now,
      retentionDays: 1,
      templatePolicyVersion: cvGenerateTemplatePolicyVersion
    });
    const sourceHash = hashSharedCvEvidenceSource(
      metadata,
      Buffer.from(cvText)
    );

    expect(
      isSharedCvEvidenceFresh(evidence, {
        sourceHash,
        parserVersion: backendCvEvidenceParserVersion,
        templatePolicyVersion: cvGenerateTemplatePolicyVersion,
        now
      })
    ).toBe(true);
    expect(
      isSharedCvEvidenceFresh(evidence, {
        sourceHash: "sha256:changed",
        parserVersion: backendCvEvidenceParserVersion,
        templatePolicyVersion: cvGenerateTemplatePolicyVersion,
        now
      })
    ).toBe(false);
    expect(
      isSharedCvEvidenceFresh(evidence, {
        sourceHash,
        parserVersion: "new-parser",
        templatePolicyVersion: cvGenerateTemplatePolicyVersion,
        now
      })
    ).toBe(false);
    expect(
      isSharedCvEvidenceFresh(evidence, {
        sourceHash,
        parserVersion: backendCvEvidenceParserVersion,
        templatePolicyVersion: "new-template-policy",
        now
      })
    ).toBe(false);
    expect(
      isSharedCvEvidenceFresh(evidence, {
        sourceHash,
        parserVersion: backendCvEvidenceParserVersion,
        templatePolicyVersion: cvGenerateTemplatePolicyVersion,
        now: new Date("2026-06-06T00:00:00.000Z")
      })
    ).toBe(false);
  });

  it("returns safe observability without retained CV text or storage identifiers", () => {
    const evidence = buildBackendParsedSharedCvEvidence({
      metadata,
      cvBytes: Buffer.from(cvText),
      now,
      retentionDays: 1
    });

    expect(buildSharedCvEvidenceObservability(evidence)).toEqual({
      schemaVersion: "shared-cv-evidence-v1",
      source: "backend_parser",
      parserOwner: "backend_mvp",
      parserVersion: backendCvEvidenceParserVersion,
      parserConfidence: "medium",
      cacheStatus: "miss",
      sectionCount: 3,
      skillCount: 3,
      requirementCoverageCount: 0,
      actionablesCount: 0,
      noLeakChecks: {
        rawCvTextRetained: false,
        contactDataRetained: false,
        storageIdentifierRetained: false
      }
    });
    expect(mvpCvParserOwnershipDecision.rawTextCaching).toBe("forbidden");
  });
});
