import {
  DownstreamError,
  NotFoundError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import { aiCvGenerateErrorCodes } from "@/modules/ai-cv-generate/ai-cv-generate.constants";
import type { GenerateCvMarkdownInput } from "@/modules/ai-cv-generate/ai-cv-generate.schema";
import type {
  AiCvGenerateServiceOptions,
  CvMarkdownResource
} from "@/modules/ai-cv-generate/ai-cv-generate.types";
import type { AiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer";
import type { CvGenerateModelPayload } from "@/shared/integrations/model-api.schema";

export class AiCvGenerateService {
  private readonly now: () => Date;

  constructor(
    private readonly repository: AiCvAnalyzerRepository,
    private readonly options: AiCvGenerateServiceOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  async generateMarkdown(
    userId: string,
    requestId: string,
    input: GenerateCvMarkdownInput
  ): Promise<CvMarkdownResource> {
    const metadata = await this.repository.findCvFileMetadataById(
      input.cvFileId,
      this.now()
    );

    if (metadata?.userId !== userId) {
      throw new NotFoundError(
        "CV tidak ditemukan",
        aiCvGenerateErrorCodes.cvFileNotFound
      );
    }

    if (!this.options.modelApiClient.generateCvMarkdown) {
      throw new ServiceUnavailableError(
        "Model API generate CV belum tersedia",
        "MODEL_SERVICE_UNAVAILABLE",
        { dependency: "model-api", operation: "cv-generate" }
      );
    }

    const payload = buildCvGeneratePayload(requestId, input, metadata);
    const response =
      await this.options.modelApiClient.generateCvMarkdown(payload);
    const markdown = normalizeMarkdown(response.markdown);

    if (!isSafeMarkdown(markdown)) {
      throw new DownstreamError(
        "Model API mengembalikan markdown yang tidak valid",
        aiCvGenerateErrorCodes.modelOutputInvalid,
        { dependency: "model-api", operation: "cv-generate" }
      );
    }

    return { markdown };
  }
}

function buildCvGeneratePayload(
  requestId: string,
  input: GenerateCvMarkdownInput,
  metadata: {
    id: string;
    mimeType: string;
    sizeBytes: number;
    storageKey: string;
  }
): CvGenerateModelPayload {
  return {
    requestId,
    inputVersion: "cv-generate-v1",
    cv: {
      fileId: metadata.id,
      mimeType: metadata.mimeType,
      sizeBytes: metadata.sizeBytes,
      storageKey: metadata.storageKey
    },
    summary: input.summary.trim(),
    template: {
      markdown: null,
      html: normalizeHtmlTemplate(input.templateHtml)
    }
  };
}

function normalizeHtmlTemplate(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "")
    .trim();
}

function normalizeMarkdown(value: string): string {
  return value.trim();
}

function isSafeMarkdown(value: string): boolean {
  if (value.length === 0) {
    return false;
  }

  return !/(<script\b|<iframe\b|<object\b|<embed\b|javascript:|\son\w+\s*=)/i.test(
    value
  );
}
