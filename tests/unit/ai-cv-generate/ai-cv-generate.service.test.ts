import { describe, expect, it } from "bun:test";

import { DownstreamError, NotFoundError } from "@/core/errors/app.error";
import { AiCvGenerateService } from "@/modules/ai-cv-generate";
import type {
  AiCvAnalyzerRepository,
  CvFileMetadataRecord
} from "@/modules/ai-cv-analyzer";
import type { ModelApiClient } from "@/shared/integrations/model-api.types";

const userId = "user-1";
const cvFileId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-05-23T00:00:00.000Z");

const cvFile: CvFileMetadataRecord = {
  id: cvFileId,
  userId,
  originalFileName: "cv.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1234,
  storageDriver: "LOCAL",
  storageKey: "cv/user-1/file.pdf",
  isActive: true,
  uploadedAt: now,
  expiresAt: new Date("2026-05-24T00:00:00.000Z"),
  deletedAt: null
};

describe("AiCvGenerateService", () => {
  it("checks ownership before calling Model API and maps markdown only", async () => {
    let calledPayload: unknown;
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      modelApiClient: createModelClient((payload) => {
        calledPayload = payload;
        return Promise.resolve({
          markdown: "<section><h1>CV Baru</h1></section>"
        });
      })
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Summary aman",
      templateHtml: "<section>{{summary}}</section>"
    });

    expect(result).toEqual({
      markdown: "<section><h1>CV Baru</h1></section>"
    });
    expect(calledPayload).toMatchObject({
      requestId: "req-1",
      cv: { fileId: cvFileId },
      summary: "Summary aman"
    });
  });

  it("conceals cross-user CV as not found", async () => {
    let modelCalled = false;
    const service = new AiCvGenerateService(
      createRepository({ ...cvFile, userId: "other-user" }),
      {
        now: () => now,
        modelApiClient: createModelClient(() => {
          modelCalled = true;
          return Promise.resolve({ markdown: "# Should not happen" });
        })
      }
    );

    try {
      await service.generateMarkdown(userId, "req-1", {
        cvFileId,
        summary: "Summary aman",
        templateHtml: "<section>{{summary}}</section>"
      });
      throw new Error("Expected service to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundError);
    }

    expect(modelCalled).toBe(false);
  });

  it("rejects executable markdown from Model API", async () => {
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      modelApiClient: createModelClient(() =>
        Promise.resolve({ markdown: "# CV\n<script>alert(1)</script>" })
      )
    });

    try {
      await service.generateMarkdown(userId, "req-1", {
        cvFileId,
        summary: "Summary aman",
        templateHtml: "<section>{{summary}}</section>"
      });
      throw new Error("Expected service to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(DownstreamError);
    }
  });
});

function createRepository(
  record: CvFileMetadataRecord | null
): AiCvAnalyzerRepository {
  return {
    createCvFileMetadata: () => Promise.resolve(cvFile),
    findActiveCvFileMetadata: () => Promise.resolve(record),
    findCvFileMetadataById: () => Promise.resolve(record),
    markCvFileDeleted: () => Promise.resolve(),
    createSnapshot: () => Promise.resolve(),
    findExpiredActiveCvFiles: () => Promise.resolve([]),
    markCvFilesDeleted: () => Promise.resolve(0)
  };
}

function createModelClient(
  generateCvMarkdown: ModelApiClient["generateCvMarkdown"]
): ModelApiClient {
  return {
    analyzeJobFit: () => Promise.reject(new Error("Not used")),
    analyzeCv: () => Promise.reject(new Error("Not used")),
    generateCvMarkdown
  };
}
