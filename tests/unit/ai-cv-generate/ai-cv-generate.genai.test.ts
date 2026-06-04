import { describe, expect, it } from "bun:test";

import { createAiCvGenerateGenAiClient } from "@/modules/ai-cv-generate/ai-cv-generate.genai";
import type { AiCvGenerateGenAiInput } from "@/modules/ai-cv-generate";
import type { ModelApiFetch } from "@/shared/integrations/model-api.types";
import { testConfig } from "../../helpers/config";

describe("AiCvGenerateGenAiClient", () => {
  it("sends attached CV PDF as OpenRouter file content and keeps base64 out of text prompt", async () => {
    let requestBody: unknown;
    const client = createAiCvGenerateGenAiClient(
      testConfig({
        AI_CV_ANALYZER_GENAI_ENABLED: "true",
        AI_CV_ANALYZER_GENAI_API_KEY: "test-provider-key",
        AI_CV_GENERATE_GENAI_ENABLED: "true"
      }),
      {
        fetch: ((_url, init) => {
          const body = typeof init?.body === "string" ? init.body : "{}";
          requestBody = JSON.parse(body);
          return Promise.resolve(
            new Response(
              JSON.stringify({
                choices: [
                  {
                    message: {
                      content: "<section><p>Generated CV</p></section>"
                    }
                  }
                ]
              }),
              { status: 200 }
            )
          );
        }) as ModelApiFetch
      }
    );

    await client.generateMarkdown(createInput());

    expect(requestBody).toMatchObject({
      messages: [
        { role: "system" },
        {
          role: "user",
          content: [
            { type: "text" },
            {
              type: "file",
              file: {
                filename: "cv.pdf",
                file_data: "data:application/pdf;base64,JVBERi0xLjQ="
              }
            }
          ]
        }
      ]
    });
    const userContent = (requestBody as { messages: { content: unknown }[] })
      .messages[1]?.content as { text?: string }[];
    expect(userContent[0]?.text).toContain("cvGenerateInput");
    expect(userContent[0]?.text).not.toContain("JVBERi0xLjQ=");
  });
});

function createInput(): AiCvGenerateGenAiInput {
  return {
    requestId: "req-1",
    inputVersion: "cv-generate-v2",
    summary: "Generate CV",
    templateHtml: "<section><p>{{summary}}</p></section>",
    cvFileAttachment: {
      filename: "cv.pdf",
      mimeType: "application/pdf",
      dataUrl: "data:application/pdf;base64,JVBERi0xLjQ="
    },
    evidence: {
      cvFile: {
        fileId: "11111111-1111-4111-8111-111111111111",
        fileName: "cv.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12
      },
      cvFileAttachment: {
        filename: "cv.pdf",
        mimeType: "application/pdf",
        dataUrl: "data:application/pdf;base64,JVBERi0xLjQ="
      },
      privateCvData: {
        rawText: "Alex Doe Backend Engineer",
        fullName: "Alex Doe",
        headline: "Backend Engineer",
        email: "alex@example.test",
        phone: "+62 812 3333 4444",
        location: "Jakarta",
        links: [],
        summary: "Backend engineer",
        experience: [],
        projects: [],
        skills: ["TypeScript"],
        education: [],
        certifications: [],
        languages: []
      },
      currentCv: {
        schemaVersion: "shared-cv-evidence-v1",
        source: "backend_parser",
        parserOwner: "backend_mvp",
        parserVersion: "test",
        parserConfidence: "medium",
        sourceHash: "hash",
        cvFile: {
          fileId: "11111111-1111-4111-8111-111111111111",
          mimeType: "application/pdf",
          fileSize: 12
        },
        cache: {
          key: "cache-key",
          status: "bypass",
          createdAt: "2026-05-23T00:00:00.000Z",
          expiresAt: "2026-05-24T00:00:00.000Z",
          invalidationPolicy: {
            sourceHash: "hash",
            parserVersion: "test",
            analysisModelVersion: null,
            templatePolicyVersion: null,
            expiresAt: "2026-05-24T00:00:00.000Z"
          },
          retentionPolicy: {
            retainedFields: [],
            forbiddenFields: [],
            expiresAt: "2026-05-24T00:00:00.000Z"
          }
        },
        candidateSummary: "Backend engineer",
        sectionEvidence: [],
        sectionSummaries: [],
        experienceBullets: [],
        projectBullets: [],
        skillEvidence: { skillsByCategory: [], requirementCoverage: [] },
        skillsByCategory: [],
        education: [],
        certifications: [],
        languages: [],
        atsEvidence: { score: null, summary: null, actionables: [] },
        atsAndActionableGaps: [],
        confidenceFlags: [],
        contactRedactionPolicy: "contact_data_removed",
        privacy: {
          rawCvTextRetained: false,
          contactDataRetained: false,
          promptsRetained: false,
          providerPayloadRetained: false,
          storageIdentifierRetained: false
        }
      },
      latestAnalysis: null
    },
    templatePolicy: {
      generationStrategy:
        "direct_markdown_html_with_backend_template_validation",
      allowedRewriteRegions: ["{{summary}}"],
      immutableStructure: ["tag_names"],
      missingEvidenceBehavior: "leave_empty_or_use_minimal_grounded_copy"
    }
  };
}
