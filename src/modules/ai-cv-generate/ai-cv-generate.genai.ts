import { z } from "zod";

import { logger } from "@/config/logger";
import type { AppConfig } from "@/config/env";
import {
  DownstreamError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import { cvGenerateSystemPrompt } from "@/modules/ai-cv-generate/ai-cv-generate.service";
import type {
  AiCvGenerateGenAiClient,
  AiCvGenerateGenAiInput
} from "@/modules/ai-cv-generate/ai-cv-generate.types";
import type { ModelApiFetch } from "@/shared/integrations/model-api.types";

const defaultChatCompletionsPath = "chat/completions";

const openAiChatCompletionResponseSchema = z.looseObject({
  id: z.string().optional(),
  model: z.string().optional(),
  choices: z
    .array(
      z.looseObject({
        finish_reason: z.string().nullable().optional(),
        message: z.looseObject({
          content: z.string().nullable(),
          role: z.string().optional()
        })
      })
    )
    .min(1)
});

export type AiCvGenerateGenAiClientOptions = {
  fetch?: ModelApiFetch;
  endpointPath?: string;
};

export function createAiCvGenerateGenAiClient(
  config: AppConfig,
  options: AiCvGenerateGenAiClientOptions = {}
): AiCvGenerateGenAiClient {
  const fetchImpl = options.fetch ?? fetch;
  const endpointPath = options.endpointPath ?? defaultChatCompletionsPath;

  return {
    generateMarkdown: (input) =>
      requestGeneratedCvMarkdown({
        fetchImpl,
        config,
        endpointPath,
        input
      })
  };
}

type RequestGeneratedCvMarkdownOptions = {
  fetchImpl: ModelApiFetch;
  config: AppConfig;
  endpointPath: string;
  input: AiCvGenerateGenAiInput;
};

async function requestGeneratedCvMarkdown(
  options: RequestGeneratedCvMarkdownOptions
): Promise<string> {
  const config = options.config.integrations.aiCvAnalyzerGenAi;
  const maxAttempts = config.maxRetries + 1;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestGeneratedCvMarkdownOnce(options, attempt);
    } catch (error) {
      lastError = error;
      if (!shouldRetryProviderError(error, attempt, maxAttempts)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : createProviderUnavailableError(options.input.requestId);
}

async function requestGeneratedCvMarkdownOnce(
  options: RequestGeneratedCvMarkdownOptions,
  attempt: number
): Promise<string> {
  const config = options.config.integrations.aiCvAnalyzerGenAi;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const url = new URL(
    options.endpointPath,
    ensureTrailingSlash(config.baseUrl)
  ).toString();

  try {
    const response = await options.fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
        [options.config.observability.requestIdHeader]: options.input.requestId,
        "HTTP-Referer": options.config.app.appUrl,
        "X-OpenRouter-Title": options.config.app.name
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: "system",
            content: cvGenerateSystemPrompt
          },
          {
            role: "user",
            content: buildCvGenerateUserContent(options.input)
          }
        ],
        temperature: 0.2,
        stream: false
      }),
      signal: controller.signal
    });

    const rawBody = await readResponseBody(response);

    if (!response.ok) {
      throw mapProviderHttpError(
        response.status,
        options.input.requestId,
        attempt
      );
    }

    return parseProviderMarkdownResponse(rawBody, options.input.requestId);
  } catch (error) {
    if (
      error instanceof DownstreamError ||
      error instanceof ServiceUnavailableError
    ) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new ServiceUnavailableError(
        "AI CV Generate provider request timed out",
        "SERVICE_UNAVAILABLE",
        {
          dependency: "ai-cv-generate-genai",
          operation: "generate-cv-markdown",
          requestId: options.input.requestId,
          attempt
        }
      );
    }

    logger.warn(
      {
        requestId: options.input.requestId,
        dependency: "ai-cv-generate-genai",
        operation: "generate-cv-markdown",
        errorName: error instanceof Error ? error.name : "UnknownError",
        attempt
      },
      "AI CV Generate provider request failed"
    );

    throw createProviderUnavailableError(options.input.requestId, attempt);
  } finally {
    clearTimeout(timeout);
  }
}

function buildCvGenerateUserContent(input: AiCvGenerateGenAiInput) {
  const { cvFileAttachment, evidence, ...restInput } = input;
  const { cvFileAttachment: _attachment, ...textEvidence } = evidence;
  const textInput = { ...restInput, evidence: textEvidence };

  return [
    {
      type: "text",
      text: JSON.stringify({
        task: "Read the attached original CV PDF. Return only complete, safe, ready-to-render markdown HTML using the provided template. Treat templateHtml as the strict visual and structural reference: keep all original tags, classes, styles, section order, and section labels. Fill only existing placeholders, empty text nodes, and existing section/list containers with matching CV data. Map data to the closest existing template section. If a CV fact has no matching section or obvious empty region, omit it and keep following the template. Never append loose text outside existing containers, never create new sections, and never reorder sections. Replace demo content with the user's real CV data. Do not return JSON.",
        cvGenerateInput: textInput
      })
    },
    {
      type: "file",
      file: {
        filename: cvFileAttachment.filename,
        file_data: cvFileAttachment.dataUrl
      }
    }
  ];
}

function parseProviderMarkdownResponse(rawBody: string, requestId: string) {
  let parsedBody: unknown;

  try {
    parsedBody = rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    throw new DownstreamError(
      "AI CV Generate provider returned invalid JSON",
      "DOWNSTREAM_ERROR",
      {
        dependency: "ai-cv-generate-genai",
        operation: "generate-cv-markdown",
        requestId
      }
    );
  }

  const parsed = openAiChatCompletionResponseSchema.safeParse(parsedBody);
  if (!parsed.success) {
    throw new DownstreamError(
      "AI CV Generate provider returned an invalid response payload",
      "DOWNSTREAM_ERROR",
      {
        dependency: "ai-cv-generate-genai",
        operation: "generate-cv-markdown",
        requestId,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join("."),
          code: issue.code,
          message: issue.message
        }))
      }
    );
  }

  const content = parsed.data.choices[0]?.message.content;
  if (!content) {
    throw new DownstreamError(
      "AI CV Generate provider returned empty content",
      "DOWNSTREAM_ERROR",
      {
        dependency: "ai-cv-generate-genai",
        operation: "generate-cv-markdown",
        requestId
      }
    );
  }

  return content;
}

function mapProviderHttpError(
  statusCode: number,
  requestId: string,
  attempt: number
) {
  const details = {
    dependency: "ai-cv-generate-genai",
    operation: "generate-cv-markdown",
    requestId,
    statusCode,
    attempt
  };

  if (statusCode === 429 || statusCode >= 500) {
    return new ServiceUnavailableError(
      "AI CV Generate provider is unavailable",
      "SERVICE_UNAVAILABLE",
      details
    );
  }

  return new DownstreamError(
    "AI CV Generate provider request failed",
    "DOWNSTREAM_ERROR",
    details
  );
}

function shouldRetryProviderError(
  error: unknown,
  attempt: number,
  maxAttempts: number
) {
  return error instanceof ServiceUnavailableError && attempt < maxAttempts;
}

function createProviderUnavailableError(requestId: string, attempt?: number) {
  return new ServiceUnavailableError(
    "AI CV Generate provider is unavailable",
    "SERVICE_UNAVAILABLE",
    {
      dependency: "ai-cv-generate-genai",
      operation: "generate-cv-markdown",
      requestId,
      ...(attempt ? { attempt } : {})
    }
  );
}

async function readResponseBody(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
