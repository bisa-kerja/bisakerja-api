import { describe, expect, it } from "bun:test";

import { generateCvMarkdownSchema } from "@/modules/ai-cv-generate/ai-cv-generate.schema";

const validInput = {
  cvFileId: "11111111-1111-4111-8111-111111111111",
  summary: "Backend developer with REST API experience.",
  templateHtml: "<section><h1>{{name}}</h1><p>{{summary}}</p></section>"
};

describe("generateCvMarkdownSchema", () => {
  it("accepts valid HTML template payload", () => {
    const result = generateCvMarkdownSchema.parse(validInput);

    expect(result.cvFileId).toBe(validInput.cvFileId);
    expect(result.summary).toBe(validInput.summary);
    expect(result.templateHtml).toBe(validInput.templateHtml);
  });

  it("requires HTML template", () => {
    const result = generateCvMarkdownSchema.safeParse({
      cvFileId: validInput.cvFileId,
      summary: validInput.summary
    });

    expect(result.success).toBe(false);
  });

  it("rejects invalid cvFileId", () => {
    const result = generateCvMarkdownSchema.safeParse({
      ...validInput,
      cvFileId: "not-uuid"
    });

    expect(result.success).toBe(false);
  });
});
