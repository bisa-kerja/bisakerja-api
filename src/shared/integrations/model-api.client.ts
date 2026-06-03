import { ZodError } from "zod";

import { logger } from "@/config/logger";
import type { AppConfig } from "@/config/env";
import {
  DownstreamError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import {
  cvAnalyzerModelPayloadSchema,
  cvAnalyzerModelResponseSchema,
  cvGenerateModelPayloadSchema,
  cvGenerateModelResponseSchema,
  jobRecommendationModelPayloadSchema,
  jobRecommendationModelResponseSchema,
  jobFitModelPayloadSchema,
  jobFitModelResponseSchema,
  type CvAnalyzerModelPayload,
  type CvAnalyzerModelResponse,
  type CvGenerateModelPayload,
  type CvGenerateModelResponse,
  type JobRecommendationModelPayload,
  type JobRecommendationModelResponse,
  type JobFitModelPayload,
  type JobFitModelResponse
} from "@/shared/integrations/model-api.schema";
import type {
  ModelApiClient,
  ModelApiClientOptions,
  ModelApiFetch
} from "@/shared/integrations/model-api.types";

const defaultJobFitPath = "/job-fit";
const defaultCvAnalyzerPath = "/internal/model/cv-analysis";
const defaultCvGeneratePath = "/cv-generate";
const defaultJobRecommendationsPath = "/job-recommendations";

export function createModelApiClient(
  config: AppConfig,
  options: ModelApiClientOptions = {}
): ModelApiClient {
  const fetchImpl = options.fetch ?? fetch;

  return {
    analyzeJobFit: async (payload) => {
      const parsedPayload = jobFitModelPayloadSchema.parse(payload);

      if (config.integrations.modelApi.enableMock) {
        const mockResponse = options.mockResponses?.jobFit;

        if (!mockResponse) {
          throw new ServiceUnavailableError(
            "Mock response Model API belum dikonfigurasi",
            "SERVICE_UNAVAILABLE",
            { dependency: "model-api", operation: "job-fit" }
          );
        }

        return jobFitModelResponseSchema.parse(mockResponse);
      }

      return requestModelApi<JobFitModelPayload, JobFitModelResponse>({
        fetchImpl,
        baseUrl: config.integrations.modelApi.baseUrl,
        endpointPath: options.jobFitPath ?? defaultJobFitPath,
        payload: parsedPayload,
        responseSchema: jobFitModelResponseSchema,
        timeoutMs: config.integrations.modelApi.timeoutMs,
        serviceToken: config.integrations.modelApi.serviceToken,
        requestIdHeader: config.observability.requestIdHeader,
        operation: "job-fit"
      });
    },
    analyzeCv: async (payload) => {
      const parsedPayload = cvAnalyzerModelPayloadSchema.parse(payload);

      if (config.integrations.modelApi.enableMock) {
        const mockResponse = options.mockResponses?.cvAnalyzer;

        if (!mockResponse) {
          throw new ServiceUnavailableError(
            "Mock response Model API belum dikonfigurasi",
            "SERVICE_UNAVAILABLE",
            { dependency: "model-api", operation: "cv-analyzer" }
          );
        }

        return cvAnalyzerModelResponseSchema.parse(mockResponse);
      }

      return requestMultipartModelApi<CvAnalyzerModelResponse>({
        fetchImpl,
        baseUrl: config.integrations.modelApi.baseUrl,
        endpointPath: options.cvAnalyzerPath ?? defaultCvAnalyzerPath,
        payload: parsedPayload,
        responseSchema: cvAnalyzerModelResponseSchema,
        timeoutMs: config.integrations.modelApi.timeoutMs,
        serviceToken: config.integrations.modelApi.serviceToken,
        requestIdHeader: config.observability.requestIdHeader,
        operation: "cv-analyzer"
      });
    },
    generateCvMarkdown: async (payload) => {
      const parsedPayload = cvGenerateModelPayloadSchema.parse(payload);

      if (config.integrations.modelApi.enableMock) {
        const mockResponse = options.mockResponses?.cvGenerate;

        if (!mockResponse) {
          throw new ServiceUnavailableError(
            "Mock response Model API belum dikonfigurasi",
            "SERVICE_UNAVAILABLE",
            { dependency: "model-api", operation: "cv-generate" }
          );
        }

        return cvGenerateModelResponseSchema.parse(mockResponse);
      }

      return requestModelApi<CvGenerateModelPayload, CvGenerateModelResponse>({
        fetchImpl,
        baseUrl: config.integrations.modelApi.baseUrl,
        endpointPath: options.cvGeneratePath ?? defaultCvGeneratePath,
        payload: parsedPayload,
        responseSchema: cvGenerateModelResponseSchema,
        timeoutMs: config.integrations.modelApi.timeoutMs,
        serviceToken: config.integrations.modelApi.serviceToken,
        requestIdHeader: config.observability.requestIdHeader,
        operation: "cv-generate"
      });
    },
    recommendJobs: async (payload) => {
      const parsedPayload = jobRecommendationModelPayloadSchema.parse(payload);

      if (config.integrations.modelApi.enableMock) {
        const mockResponse = options.mockResponses?.jobRecommendations;

        if (!mockResponse) {
          throw new ServiceUnavailableError(
            "Mock response Model API belum dikonfigurasi",
            "SERVICE_UNAVAILABLE",
            { dependency: "model-api", operation: "job-recommendations" }
          );
        }

        return jobRecommendationModelResponseSchema.parse(mockResponse);
      }

      return requestModelApi<
        JobRecommendationModelPayload,
        JobRecommendationModelResponse
      >({
        fetchImpl,
        baseUrl: config.integrations.modelApi.baseUrl,
        endpointPath:
          options.jobRecommendationsPath ?? defaultJobRecommendationsPath,
        payload: parsedPayload,
        responseSchema: jobRecommendationModelResponseSchema,
        timeoutMs: config.integrations.modelApi.timeoutMs,
        serviceToken: config.integrations.modelApi.serviceToken,
        requestIdHeader: config.observability.requestIdHeader,
        operation: "job-recommendations"
      });
    }
  };
}

type RequestModelApiOptions<TPayload, TResponse> = {
  fetchImpl: ModelApiFetch;
  baseUrl: string;
  endpointPath: string;
  payload: TPayload & { requestId: string };
  responseSchema: {
    parse: (value: unknown) => TResponse;
  };
  timeoutMs: number;
  serviceToken: string;
  requestIdHeader: string;
  operation: string;
};

async function requestModelApi<TPayload, TResponse>(
  options: RequestModelApiOptions<TPayload, TResponse>
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const url = new URL(options.endpointPath, options.baseUrl).toString();

  try {
    const response = await options.fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${options.serviceToken}`,
        [options.requestIdHeader]: options.payload.requestId
      },
      body: JSON.stringify(options.payload),
      signal: controller.signal
    });

    const rawBody = await readResponseBody(response);

    if (!response.ok) {
      throw mapModelApiHttpError(
        response.status,
        options.operation,
        options.payload.requestId
      );
    }

    const parsedJson = parseJsonBody(rawBody, options.operation);
    return options.responseSchema.parse(parsedJson);
  } catch (error) {
    if (
      error instanceof DownstreamError ||
      error instanceof ServiceUnavailableError
    ) {
      throw error;
    }

    if (error instanceof ZodError) {
      throw new DownstreamError(
        "Model API mengembalikan data response yang tidak valid",
        "DOWNSTREAM_ERROR",
        {
          dependency: "model-api",
          operation: options.operation,
          requestId: options.payload.requestId,
          issues: error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            code: issue.code,
            message: issue.message
          }))
        }
      );
    }

    if (isAbortError(error)) {
      throw new ServiceUnavailableError(
        "Request ke Model API timeout",
        "SERVICE_UNAVAILABLE",
        {
          dependency: "model-api",
          operation: options.operation,
          requestId: options.payload.requestId
        }
      );
    }

    logger.warn(
      {
        requestId: options.payload.requestId,
        dependency: "model-api",
        operation: options.operation,
        errorName: error instanceof Error ? error.name : "UnknownError"
      },
      "Model API request failed"
    );

    throw new ServiceUnavailableError(
      "Model API tidak tersedia",
      "SERVICE_UNAVAILABLE",
      {
        dependency: "model-api",
        operation: options.operation,
        requestId: options.payload.requestId
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

type RequestMultipartModelApiOptions<TResponse> = Omit<
  RequestModelApiOptions<CvAnalyzerModelPayload, TResponse>,
  "payload"
> & {
  payload: CvAnalyzerModelPayload;
};

async function requestMultipartModelApi<TResponse>(
  options: RequestMultipartModelApiOptions<TResponse>
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const url = new URL(options.endpointPath, options.baseUrl).toString();
  const form = new FormData();
  const { bytes: cvBytes, ...cvMetadata } = options.payload.cv;

  form.set("requestId", options.payload.requestId);
  form.set("language", options.payload.language.toLowerCase());
  form.set("inputMode", options.payload.inputMode);
  form.set("compareSource", options.payload.compareSource);
  for (const role of options.payload.jobRoles) {
    form.append("jobRoles", role);
  }
  form.set("cv", JSON.stringify(cvMetadata));
  form.set("jobCandidates", JSON.stringify(options.payload.jobCandidates));
  form.set("rankingPolicy", JSON.stringify(options.payload.rankingPolicy));
  form.set(
    "cvFile",
    new Blob([cvBytes ? new Uint8Array(cvBytes) : new Uint8Array()], {
      type: cvMetadata.mimeType
    }),
    cvMetadata.fileId.endsWith(".pdf")
      ? cvMetadata.fileId
      : `${cvMetadata.fileId}.pdf`
  );

  try {
    const response = await options.fetchImpl(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.serviceToken}`,
        [options.requestIdHeader]: options.payload.requestId
      },
      body: form,
      signal: controller.signal
    });

    const rawBody = await readResponseBody(response);

    if (!response.ok) {
      throw mapModelApiHttpError(
        response.status,
        options.operation,
        options.payload.requestId
      );
    }

    const parsedJson = parseJsonBody(rawBody, options.operation);
    return options.responseSchema.parse(parsedJson);
  } catch (error) {
    if (
      error instanceof DownstreamError ||
      error instanceof ServiceUnavailableError
    ) {
      throw error;
    }

    if (error instanceof ZodError) {
      throw new DownstreamError(
        "Model API mengembalikan data response yang tidak valid",
        "DOWNSTREAM_ERROR",
        {
          dependency: "model-api",
          operation: options.operation,
          requestId: options.payload.requestId,
          issues: error.issues.map((issue) => ({
            path: issue.path.map(String).join("."),
            code: issue.code,
            message: issue.message
          }))
        }
      );
    }

    if (isAbortError(error)) {
      throw new ServiceUnavailableError(
        "Request ke Model API timeout",
        "SERVICE_UNAVAILABLE",
        {
          dependency: "model-api",
          operation: options.operation,
          requestId: options.payload.requestId
        }
      );
    }

    logger.warn(
      {
        requestId: options.payload.requestId,
        dependency: "model-api",
        operation: options.operation,
        errorName: error instanceof Error ? error.name : "UnknownError"
      },
      "Model API multipart request failed"
    );

    throw new ServiceUnavailableError(
      "Model API tidak tersedia",
      "SERVICE_UNAVAILABLE",
      {
        dependency: "model-api",
        operation: options.operation,
        requestId: options.payload.requestId
      }
    );
  } finally {
    clearTimeout(timeout);
  }
}

function parseJsonBody(rawBody: string, operation: string): unknown {
  try {
    return rawBody ? (JSON.parse(rawBody) as unknown) : null;
  } catch {
    throw new DownstreamError(
      "Model API mengembalikan JSON yang tidak valid",
      "DOWNSTREAM_ERROR",
      {
        dependency: "model-api",
        operation
      }
    );
  }
}

function mapModelApiHttpError(
  statusCode: number,
  operation: string,
  requestId: string
) {
  const details = {
    dependency: "model-api",
    operation,
    requestId,
    statusCode
  };

  if (statusCode >= 500) {
    return new ServiceUnavailableError(
      "Model API tidak tersedia",
      "SERVICE_UNAVAILABLE",
      details
    );
  }

  return new DownstreamError(
    "Model API menolak request dari backend",
    "DOWNSTREAM_ERROR",
    details
  );
}

async function readResponseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
