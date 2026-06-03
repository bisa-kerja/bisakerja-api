import { z } from "zod";

import { logger } from "@/config/logger";
import type { AppConfig } from "@/config/env";
import {
  DownstreamError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import { cvAnalyzerWrapperSystemPrompt } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.service";
import type {
  CvAnalyzerGenAiClient,
  CvAnalyzerWrapperInput
} from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";
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

export type CvAnalyzerGenAiClientOptions = {
  fetch?: ModelApiFetch;
  endpointPath?: string;
};

export function createCvAnalyzerGenAiClient(
  config: AppConfig,
  options: CvAnalyzerGenAiClientOptions = {}
): CvAnalyzerGenAiClient {
  const fetchImpl = options.fetch ?? fetch;
  const endpointPath = options.endpointPath ?? defaultChatCompletionsPath;

  return {
    generateCvAnalysisCopy: (input) =>
      requestCvAnalyzerCopy({
        fetchImpl,
        config,
        endpointPath,
        input
      })
  };
}

type RequestCvAnalyzerCopyOptions = {
  fetchImpl: ModelApiFetch;
  config: AppConfig;
  endpointPath: string;
  input: CvAnalyzerWrapperInput;
};

async function requestCvAnalyzerCopy(
  options: RequestCvAnalyzerCopyOptions
): Promise<unknown> {
  const config = options.config.integrations.aiCvAnalyzerGenAi;
  const maxAttempts = config.maxRetries + 1;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await requestCvAnalyzerCopyOnce(options, attempt);
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

async function requestCvAnalyzerCopyOnce(
  options: RequestCvAnalyzerCopyOptions,
  attempt: number
): Promise<unknown> {
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
            content: cvAnalyzerWrapperSystemPrompt
          },
          {
            role: "user",
            content: JSON.stringify({
              task: "Return only the public CvAnalysis analysisResult JSON object using the provided evidence.",
              wrapperInput: options.input
            })
          }
        ],
        response_format: { type: "json_object" },
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

    return parseProviderJsonResponse(rawBody, options.input.requestId);
  } catch (error) {
    if (
      error instanceof DownstreamError ||
      error instanceof ServiceUnavailableError
    ) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new ServiceUnavailableError(
        "AI CV Analyzer GenAI provider request timed out",
        "SERVICE_UNAVAILABLE",
        {
          dependency: "ai-cv-analyzer-genai",
          operation: "generate-cv-analysis-copy",
          requestId: options.input.requestId,
          attempt
        }
      );
    }

    logger.warn(
      {
        requestId: options.input.requestId,
        dependency: "ai-cv-analyzer-genai",
        operation: "generate-cv-analysis-copy",
        errorName: error instanceof Error ? error.name : "UnknownError",
        attempt
      },
      "AI CV Analyzer GenAI provider request failed"
    );

    throw createProviderUnavailableError(options.input.requestId, attempt);
  } finally {
    clearTimeout(timeout);
  }
}

function parseProviderJsonResponse(
  rawBody: string,
  requestId: string
): unknown {
  let parsedBody: unknown;

  try {
    parsedBody = rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    throw new DownstreamError(
      "AI CV Analyzer GenAI provider returned invalid JSON",
      "DOWNSTREAM_ERROR",
      {
        dependency: "ai-cv-analyzer-genai",
        operation: "generate-cv-analysis-copy",
        requestId
      }
    );
  }

  const parsed = openAiChatCompletionResponseSchema.safeParse(parsedBody);
  if (!parsed.success) {
    throw new DownstreamError(
      "AI CV Analyzer GenAI provider returned an invalid response payload",
      "DOWNSTREAM_ERROR",
      {
        dependency: "ai-cv-analyzer-genai",
        operation: "generate-cv-analysis-copy",
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
      "AI CV Analyzer GenAI provider returned empty content",
      "DOWNSTREAM_ERROR",
      {
        dependency: "ai-cv-analyzer-genai",
        operation: "generate-cv-analysis-copy",
        requestId
      }
    );
  }

  try {
    return JSON.parse(content) as unknown;
  } catch {
    throw new DownstreamError(
      "AI CV Analyzer GenAI provider returned non-JSON content",
      "DOWNSTREAM_ERROR",
      {
        dependency: "ai-cv-analyzer-genai",
        operation: "generate-cv-analysis-copy",
        requestId
      }
    );
  }
}

function mapProviderHttpError(
  statusCode: number,
  requestId: string,
  attempt: number
) {
  const details = {
    dependency: "ai-cv-analyzer-genai",
    operation: "generate-cv-analysis-copy",
    requestId,
    statusCode,
    attempt
  };

  if (statusCode === 429 || statusCode >= 500) {
    return new ServiceUnavailableError(
      "AI CV Analyzer GenAI provider is unavailable",
      "SERVICE_UNAVAILABLE",
      details
    );
  }

  return new DownstreamError(
    "AI CV Analyzer GenAI provider rejected the backend request",
    "DOWNSTREAM_ERROR",
    details
  );
}

function shouldRetryProviderError(
  error: unknown,
  attempt: number,
  maxAttempts: number
) {
  if (attempt >= maxAttempts) {
    return false;
  }

  if (error instanceof ServiceUnavailableError) {
    return true;
  }

  return false;
}

function createProviderUnavailableError(requestId: string, attempt?: number) {
  return new ServiceUnavailableError(
    "AI CV Analyzer GenAI provider is unavailable",
    "SERVICE_UNAVAILABLE",
    {
      dependency: "ai-cv-analyzer-genai",
      operation: "generate-cv-analysis-copy",
      requestId,
      attempt
    }
  );
}

async function readResponseBody(response: Response): Promise<string> {
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
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
