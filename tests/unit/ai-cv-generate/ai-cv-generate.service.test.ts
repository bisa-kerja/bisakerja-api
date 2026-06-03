import { describe, expect, it } from "bun:test";

import {
  DownstreamError,
  NotFoundError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import { AiCvGenerateService } from "@/modules/ai-cv-generate";
import type {
  AiCvAnalyzerRepository,
  CvFileMetadataRecord,
  CvFileStorage
} from "@/modules/ai-cv-analyzer";
import type { AiCvGenerateGenAiClient } from "@/modules/ai-cv-generate";

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
  it("checks ownership, reads CV storage, and maps markdown only without Model API", async () => {
    let providerInput: unknown;
    const readStorageKeys: string[] = [];
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage((storageKey) => {
        readStorageKeys.push(storageKey);
        return Promise.resolve(Buffer.from("Backend REST API candidate"));
      }),
      genAiEnabled: true,
      genAiClient: createGenAiClient((input) => {
        providerInput = input;
        return Promise.resolve("<section><h1>CV Baru</h1></section>");
      })
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Summary aman",
      templateHtml: '<section onclick="x()">{{summary}}</section>'
    });

    expect(result).toEqual({
      markdown: "<section><h1>CV Baru</h1></section>"
    });
    expect(readStorageKeys).toEqual([cvFile.storageKey]);
    expect(providerInput).toMatchObject({
      requestId: "req-1",
      inputVersion: "cv-generate-v1",
      summary: "Summary aman",
      templateHtml: "<section>{{summary}}</section>",
      evidence: {
        cvFile: { fileId: cvFileId },
        cvTextPreview: "Backend REST API candidate"
      }
    });
    expect(JSON.stringify(providerInput)).not.toContain(cvFile.storageKey);
  });

  it("conceals cross-user CV as not found", async () => {
    let providerCalled = false;
    const service = new AiCvGenerateService(
      createRepository({ ...cvFile, userId: "other-user" }),
      {
        now: () => now,
        storage: createStorage(),
        genAiEnabled: true,
        genAiClient: createGenAiClient(() => {
          providerCalled = true;
          return Promise.resolve("# Should not happen");
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

    expect(providerCalled).toBe(false);
  });

  it("rejects executable provider output", async () => {
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() =>
        Promise.resolve("# CV\n<script>alert(1)</script>")
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

  it("maps storage read failure to service unavailable", async () => {
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.reject(new Error("missing"))),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() =>
        Promise.resolve("<section>Should not happen</section>")
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
      expect(error).toBeInstanceOf(ServiceUnavailableError);
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

function createStorage(
  readFile: CvFileStorage["readFile"] = () =>
    Promise.resolve(Buffer.from("Safe CV text"))
): CvFileStorage {
  return {
    saveFile: () =>
      Promise.resolve({
        storageDriver: "LOCAL",
        storageKey: cvFile.storageKey
      }),
    deleteFile: () => Promise.resolve(),
    readFile
  };
}

function createGenAiClient(
  generateMarkdown: AiCvGenerateGenAiClient["generateMarkdown"]
): AiCvGenerateGenAiClient {
  return { generateMarkdown };
}
