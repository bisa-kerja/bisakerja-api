import { describe, expect, it } from "bun:test";

import {
  DownstreamError,
  NotFoundError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import {
  AiCvGenerateService,
  validateTemplateStructure
} from "@/modules/ai-cv-generate/ai-cv-generate.service";
import type {
  AiCvAnalyzerRepository,
  CvFileMetadataRecord,
  CvFileStorage
} from "@/modules/ai-cv-analyzer";
import type { CvAnalysisResultRecord } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";
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

const currentCvText = [
  "Summary",
  "Backend REST API candidate with PostgreSQL delivery experience.",
  "Experience",
  "Built Express services for job matching.",
  "Improved PostgreSQL query latency by 20%.",
  "Projects",
  "CV analyzer quality dashboard.",
  "Skills",
  "TypeScript, PostgreSQL, REST API",
  "Education",
  "BSc Computer Science",
  "Languages",
  "English, Indonesian",
  "email@example.test +62 812 3333 4444"
].join("\n");

describe("AiCvGenerateService", () => {
  it("checks ownership, reads CV storage, and sends structured evidence without raw preview or storage key", async () => {
    let providerInput: unknown;
    const readStorageKeys: string[] = [];
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage((storageKey) => {
        readStorageKeys.push(storageKey);
        return Promise.resolve(Buffer.from(currentCvText));
      }),
      genAiEnabled: true,
      genAiClient: createGenAiClient((input) => {
        providerInput = input;
        return Promise.resolve(
          '<section class="cv"><p>Backend REST API candidate with PostgreSQL delivery experience.</p></section>'
        );
      })
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Summary aman",
      templateHtml:
        '<section class="cv" onclick="x()"><p>{{summary}}</p></section>'
    });

    expect(result).toEqual({
      markdown:
        '<section class="cv"><p>Backend REST API candidate with PostgreSQL delivery experience.</p></section>'
    });
    expect(readStorageKeys).toEqual([cvFile.storageKey]);
    expect(providerInput).toMatchObject({
      requestId: "req-1",
      inputVersion: "cv-generate-v2",
      summary: "Summary aman",
      templateHtml: '<section class="cv"><p>{{summary}}</p></section>',
      evidence: {
        cvFile: { fileId: cvFileId },
        currentCv: {
          source: "backend_parser",
          candidateSummary:
            "Backend REST API candidate with PostgreSQL delivery experience.",
          experienceBullets: [
            "Built Express services for job matching.",
            "Improved PostgreSQL query latency by 20%."
          ],
          skillsByCategory: [
            {
              category: "parsed_skills",
              skills: ["typescript", "postgresql", "rest api"]
            }
          ],
          contactRedactionPolicy: "contact_data_removed"
        },
        privateCvData: {
          email: "email@example.test",
          phone: "+62 812 3333 4444",
          summary:
            "Backend REST API candidate with PostgreSQL delivery experience."
        }
      },
      templatePolicy: {
        generationStrategy:
          "direct_markdown_html_with_backend_template_validation"
      }
    });
    expect(JSON.stringify(providerInput)).not.toContain("cvTextPreview");
    expect(JSON.stringify(providerInput)).not.toContain(cvFile.storageKey);
    expect(JSON.stringify(providerInput)).toContain("email@example.test");
    expect(JSON.stringify(providerInput)).toContain("+62 812 3333 4444");
  });

  it("uses latest analyzer evidence when stored CV bytes have no usable text", async () => {
    let providerInput: unknown;
    const service = new AiCvGenerateService(
      createRepository(cvFile, createLatestAnalysisRecord()),
      {
        now: () => now,
        storage: createStorage(() =>
          Promise.resolve(Buffer.from([0, 1, 2, 3]))
        ),
        genAiEnabled: true,
        genAiClient: createGenAiClient((input) => {
          providerInput = input;
          return Promise.resolve(
            "<section><p>Strong backend profile with ATS gaps.</p></section>"
          );
        })
      }
    );

    await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Summary aman",
      templateHtml: "<section><p>{{summary}}</p></section>"
    });

    expect(providerInput).toMatchObject({
      evidence: {
        currentCv: {
          source: "latest_analysis_cache",
          candidateSummary: "Strong backend profile with ATS gaps.",
          atsAndActionableGaps: [
            "Add quantified API latency impact.",
            "ATS score needs stronger section headings."
          ],
          confidenceFlags: [
            "latest analyzer evidence available for grounding",
            "stored CV bytes did not expose reliable plain text; generation must avoid unsupported details"
          ]
        },
        latestAnalysis: {
          overallImpression: "Strong backend profile with ATS gaps."
        }
      }
    });
  });

  it("falls back to deterministic template rendering when provider changes structure", async () => {
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.resolve(Buffer.from(currentCvText))),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() =>
        Promise.resolve("<section><h2>Changed</h2></section>")
      )
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Fallback summary",
      templateHtml:
        '<section class="cv"><h1>{{name}}</h1><p>{{summary}}</p><p>{{skills}}</p></section>'
    });

    expect(result.markdown).toBe(
      '<section class="cv"><h1></h1><p>Backend REST API candidate with PostgreSQL delivery experience.</p><p>TypeScript, PostgreSQL, REST API</p></section>'
    );
  });

  it("falls back to deterministic template rendering when provider is unavailable", async () => {
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.resolve(Buffer.from(currentCvText))),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() => Promise.reject(new Error("timeout")))
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Fallback summary",
      templateHtml: "<section><p>{{summary}}</p></section>"
    });

    expect(result.markdown).toBe(
      "<section><p>Backend REST API candidate with PostgreSQL delivery experience.</p></section>"
    );
  });

  it("fills common semantic CV template regions when provider returns an empty placeholder-free template", async () => {
    const templateHtml = [
      '<div class="cv-container">',
      '<header class="cv-header"><h1 class="header-name">ALEX DOE</h1><h2 class="header-title">Senior Full-Stack Developer</h2><div class="contact-info">alex.doe@email.com | +1 (555) 123-4567</div></header>',
      '<section class="main-section"><div class="section-title">Summary</div><div class="divider-line"></div><p class="summary-text"></p></section>',
      '<section class="main-section"><div class="section-title">Professional Experience</div><div class="divider-line"></div></section>',
      '<section class="main-section"><div class="section-title">Education</div><div class="divider-line"></div></section>',
      '<section class="main-section"><div class="section-title">Projects</div><div class="divider-line"></div></section>',
      '<section class="main-section"><div class="section-title">Skills</div><div class="divider-line"></div><div class="skills-grid"></div></section>',
      "</div>"
    ].join("");
    const mvpCvText = [
      "Budi Santoso",
      "Backend Engineer",
      "budi@example.com | +62 812 9999 8888 | Jakarta, Indonesia",
      currentCvText
    ].join("\n");
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.resolve(Buffer.from(mvpCvText))),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() => Promise.resolve(templateHtml))
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Fallback summary",
      templateHtml
    });

    expect(validateTemplateStructure(templateHtml, result.markdown)).toEqual({
      valid: true,
      reasons: []
    });
    expect(result.markdown).toContain(
      '<h1 class="header-name">Budi Santoso</h1>'
    );
    expect(result.markdown).toContain(
      '<h2 class="header-title">Backend Engineer</h2>'
    );
    expect(result.markdown).toContain("budi@example.com");
    expect(result.markdown).toContain("+62 812 9999 8888");
    expect(result.markdown).toContain(
      '<p class="summary-text">Backend REST API candidate with PostgreSQL delivery experience.</p>'
    );
    expect(result.markdown).toContain(
      "Built Express services for job matching."
    );
    expect(result.markdown).toContain("BSc Computer Science");
    expect(result.markdown).toContain("CV analyzer quality dashboard.");
    expect(result.markdown).toContain("TypeScript, PostgreSQL, REST API");
  });

  it("keeps optimized CV template clean, structured, and free from binary/contact spam", async () => {
    const templateHtml = [
      '<div class="cv-container">',
      '<header class="cv-header"><h1 class="header-name"></h1><p class="header-title"></p><p class="header-contact">alex.doe@email.com | React.js | gmail.com</p></header>',
      '<section class="section-container"><h2 class="section-label">SUMMARY</h2><div class="section-content"><p class="summary-text">%PDF-1.4 %���� 1 0 obj</p></div></section>',
      '<section class="section-container"><h2 class="section-label">WORK EXPERIENCE</h2><div class="section-content"><ul><li></li><li></li></ul></div>´ÑÇ÷É¡ÉD¯Ð³xì</section>',
      '<section class="section-container"><h2 class="section-label">KEY SKILLS</h2><div class="section-content"><ul><li></li><li></li><li></li></ul></div></section>',
      "</div>"
    ].join("");
    const cvText = [
      "Salman Abdurrahman",
      "Frontend Developer",
      "salman@example.com | +6281282159360 | www.linkedin.com/in/salmanabdurrahmann | https://github.com/salmanabdurrahman",
      "Summary",
      "Frontend developer building React and Next.js products.",
      "Experience",
      "Built Socialvit frontend features with React and Next.js.",
      "Optimized Docker-based development workflows.",
      "Skills",
      "React.js, Next.js, TypeScript, Docker"
    ].join("\n");
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.resolve(Buffer.from(cvText))),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() => Promise.reject(new Error("timeout")))
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Frontend developer summary",
      templateHtml
    });

    expect(validateTemplateStructure(templateHtml, result.markdown)).toEqual({
      valid: true,
      reasons: []
    });
    expect(result.markdown).toContain(
      '<h1 class="header-name">Salman Abdurrahman</h1>'
    );
    expect(result.markdown).toContain(
      '<p class="header-title">Frontend Developer</p>'
    );
    expect(result.markdown).toContain(
      "Built Socialvit frontend features with React and Next.js."
    );
    expect(result.markdown).toContain("React.js");
    expect(result.markdown).not.toMatch(
      /%PDF|����|´ÑÇ|alex\.doe|gmail\.com \| React/i
    );
  });

  it("removes PDF byte garbage and demo identity from sparse template fallback", async () => {
    const templateHtml = [
      '<div class="cv-container">',
      '<header class="cv-header">',
      '<h1 class="header-name"></h1>',
      '<h2 class="header-title"></h2>',
      '<div class="contact-info">San Francisco, CA <span class="contact-separator">|</span> alex.doe@email.com <span class="contact-separator">|</span> linkedin.com/in/alexdoe-dev</div>',
      "</header>",
      '<section class="main-section"><div class="section-title">Summary</div><p class="summary-text">%PDF-1.4 %���� 1 0 obj</p>%PDF-1.4 %���� 1 0 obj</section>',
      "</div>"
    ].join("");
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.resolve(Buffer.from(currentCvText))),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() => Promise.reject(new Error("timeout")))
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Fallback summary",
      templateHtml
    });

    expect(validateTemplateStructure(templateHtml, result.markdown)).toEqual({
      valid: true,
      reasons: []
    });
    expect(result.markdown).not.toMatch(/%PDF|����|alex\.doe|San Francisco/i);
    expect(result.markdown).toContain(
      "Backend REST API candidate with PostgreSQL delivery experience."
    );
  });

  it("does not treat raw PDF bytes as usable CV text in fallback", async () => {
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() =>
        Promise.resolve(
          Buffer.from("%PDF-1.4\n1 0 obj\nstream\n����\nendstream\nendobj")
        )
      ),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() => Promise.reject(new Error("timeout")))
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Grounded fallback summary from user input",
      templateHtml: "<section><p>{{summary}}</p></section>"
    });

    expect(result.markdown).toBe(
      "<section><p>Grounded fallback summary from user input</p></section>"
    );
  });

  it("accepts provider markdown wrapped in a full HTML code fence", async () => {
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.resolve(Buffer.from(currentCvText))),
      genAiEnabled: true,
      genAiClient: createGenAiClient(() =>
        Promise.resolve(
          "```html\n<section><p>Backend REST API candidate with PostgreSQL delivery experience.</p></section>\n```"
        )
      )
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Summary aman",
      templateHtml: "<section><p>{{summary}}</p></section>"
    });

    expect(result.markdown).toBe(
      "<section><p>Backend REST API candidate with PostgreSQL delivery experience.</p></section>"
    );
  });

  it("keeps current user's contact data in summary and template for MVP generation", async () => {
    let providerInput: unknown;
    const service = new AiCvGenerateService(createRepository(cvFile), {
      now: () => now,
      storage: createStorage(() => Promise.resolve(Buffer.from([0, 1, 2, 3]))),
      genAiEnabled: true,
      genAiClient: createGenAiClient((input) => {
        providerInput = input;
        return Promise.reject(new Error("timeout"));
      })
    });

    const result = await service.generateMarkdown(userId, "req-1", {
      cvFileId,
      summary: "Hubungi user@example.test atau +62 812 3333 4444",
      templateHtml:
        "<section><p>Kontak: user@example.test +62 812 3333 4444</p><p>{{summary}}</p></section>"
    });

    expect(providerInput).toMatchObject({
      summary: "Hubungi user@example.test atau +62 812 3333 4444",
      templateHtml:
        "<section><p>Kontak: user@example.test +62 812 3333 4444</p><p>{{summary}}</p></section>"
    });
    expect(result.markdown).toBe(
      "<section><p>Kontak: user@example.test +62 812 3333 4444</p><p>Hubungi user@example.test atau +62 812 3333 4444</p></section>"
    );
  });

  it("rejects executable provider output instead of falling back", async () => {
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

  it("validates required template structure, attributes, and static copy", () => {
    expect(
      validateTemplateStructure(
        '<section id="cv" class="one" data-kind="cv"><h1>Name</h1><p>{{summary}}</p></section>',
        '<section id="cv" class="one" data-kind="cv"><h1>Name</h1><p>Backend</p></section>'
      )
    ).toEqual({ valid: true, reasons: [] });

    expect(
      validateTemplateStructure(
        '<section id="cv" class="one"><h1>Name</h1><p>{{summary}}</p></section>',
        '<section id="cv" class="two"><h2>Name</h2><p>Backend</p></section>'
      ).valid
    ).toBe(false);
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
  record: CvFileMetadataRecord | null,
  latestAnalysis: CvAnalysisResultRecord | null = null
): AiCvAnalyzerRepository {
  return {
    createCvFileMetadata: () => Promise.resolve(cvFile),
    findActiveCvFileMetadata: () => Promise.resolve(record),
    findCvFileMetadataById: () => Promise.resolve(record),
    markCvFileDeleted: () => Promise.resolve(),
    createSnapshot: () =>
      Promise.resolve("11111111-1111-4111-8111-111111111115"),
    findLatestAnalysisResultForUser: () => Promise.resolve(latestAnalysis),
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

function createLatestAnalysisRecord(): CvAnalysisResultRecord {
  return {
    id: "11111111-1111-4111-8111-111111111112",
    userId,
    cvFileMetadataId: cvFileId,
    language: "EN",
    inputMode: "REFERENCE",
    compareSource: "JOB_SEARCH",
    schemaVersion: "cv-analysis-v2",
    overallImpression: "Strong backend profile with ATS gaps.",
    jobFitAlignment: { score: 78, summary: "Backend fit is strong." },
    atsFriendliness: {
      score: 66,
      summary: "ATS score needs stronger section headings."
    },
    topActionables: ["Add quantified API latency impact."],
    sectionReviews: [
      {
        sectionName: "Experience",
        analysis: "Backend services are present but impact metrics are thin.",
        actionPoints: ["Add latency and reliability metrics."],
        whyItsImportantForYou: "Metrics make backend impact clearer."
      }
    ],
    jobRecommendations: [],
    modelName: "test-model",
    modelVersion: "1",
    inputSummary: {},
    analyzedAt: now,
    cvFileMetadata: cvFile
  };
}
