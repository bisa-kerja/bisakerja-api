import { describe, expect, mock, test } from "bun:test";

import {
  DownstreamError,
  ServiceUnavailableError
} from "@/core/errors/app.error";
import { createModelApiClient } from "@/shared/integrations/model-api.client";
import type {
  CvAnalyzerModelPayload,
  JobFitModelPayload
} from "@/shared/integrations/model-api.schema";
import { testConfig } from "../../helpers/config";
import { modelApiFixtures } from "../../fixtures/model-api";

const jobFitPayload: JobFitModelPayload = {
  requestId: "req_job_fit_client",
  inputVersion: "job-fit-v1",
  user: {
    careerStatus: "EARLY_CAREER",
    skills: [{ name: "TypeScript", level: "INTERMEDIATE" }],
    experience: [{ title: "Backend Intern", description: "Built APIs" }]
  },
  preferences: {
    targetRoles: ["Backend Developer"],
    locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
    workTypes: ["REMOTE"],
    salaryExpectation: {
      min: 5000000,
      max: 9000000,
      currency: "IDR",
      period: "MONTHLY"
    }
  },
  job: {
    id: "job-1",
    title: "Backend Developer",
    description: "Build backend APIs",
    requirements: [{ type: "SKILL", value: "TypeScript", priority: "HIGH" }],
    skills: ["TypeScript"],
    workType: "REMOTE",
    experienceLevel: "ENTRY_LEVEL",
    location: { province: "DKI Jakarta", city: "Jakarta Selatan" },
    salary: {
      min: 5000000,
      max: 9000000,
      currency: "IDR",
      period: "MONTHLY"
    }
  }
};

const cvPayload: CvAnalyzerModelPayload = {
  requestId: "req_cv_client",
  inputVersion: "cv-analyzer-v1",
  language: "ID",
  inputMode: "UPLOAD",
  compareSource: "JOB_SEARCH",
  cv: {
    fileId: "cv-1",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    storageKey: "cv/user-1/cv-1.pdf"
  },
  job: {
    id: "job-1",
    title: "Backend Developer",
    description: "Build backend APIs",
    requirements: [{ type: "SKILL", value: "TypeScript", priority: "HIGH" }],
    skills: ["TypeScript"],
    experienceLevel: "ENTRY_LEVEL"
  }
};

describe("model api client", () => {
  test("returns validated mock responses when mock mode is enabled", async () => {
    const client = createModelApiClient(testConfig(), {
      mockResponses: {
        jobFit: modelApiFixtures.validJobFitResponse,
        cvAnalyzer: modelApiFixtures.validCvAnalyzerResponse
      }
    });

    const jobFitResponse = await client.analyzeJobFit(jobFitPayload);
    const cvResponse = await client.analyzeCv(cvPayload);

    expect(jobFitResponse).toEqual(modelApiFixtures.validJobFitResponse);
    expect(cvResponse).toEqual(modelApiFixtures.validCvAnalyzerResponse);
  });

  test("sends request id and service token to model api", async () => {
    const fetchMock = mock(
      (_url: string | URL | Request, _init?: RequestInit) =>
        Promise.resolve(
          new Response(JSON.stringify(modelApiFixtures.validJobFitResponse), {
            status: 200,
            headers: { "content-type": "application/json" }
          })
        )
    );
    const client = createModelApiClient(
      testConfig({
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: "live-model-token"
      }),
      { fetch: asFetch(fetchMock) }
    );

    await client.analyzeJobFit(jobFitPayload);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls.at(0);
    expect(call).toBeDefined();

    if (!call) {
      throw new Error("Expected fetch to be called");
    }

    const [url, init] = call;
    expect(toRequestUrl(url)).toBe("http://localhost:8000/job-fit");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      authorization: "Bearer live-model-token",
      "x-request-id": "req_job_fit_client",
      "content-type": "application/json"
    });
  });

  test("maps timeout and server failures to service unavailable", async () => {
    const timeoutFetch = mock(() =>
      Promise.reject(
        new DOMException("The operation was aborted", "AbortError")
      )
    );
    const timeoutClient = createModelApiClient(
      testConfig({
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: "live-model-token"
      }),
      { fetch: asFetch(timeoutFetch) }
    );

    await expectRejects(
      timeoutClient.analyzeJobFit(jobFitPayload),
      ServiceUnavailableError
    );

    const serverErrorFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "failed" }), {
          status: 503,
          headers: { "content-type": "application/json" }
        })
      )
    );
    const serverErrorClient = createModelApiClient(
      testConfig({
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: "live-model-token"
      }),
      { fetch: asFetch(serverErrorFetch) }
    );

    await expectRejects(
      serverErrorClient.analyzeJobFit(jobFitPayload),
      ServiceUnavailableError
    );
  });

  test("maps downstream contract drift to downstream error", async () => {
    const invalidSchemaFetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ fitScore: 120 }), {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    const invalidSchemaClient = createModelApiClient(
      testConfig({
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: "live-model-token"
      }),
      { fetch: asFetch(invalidSchemaFetch) }
    );

    await expectRejects(
      invalidSchemaClient.analyzeJobFit(jobFitPayload),
      DownstreamError
    );

    const invalidJsonFetch = mock(() =>
      Promise.resolve(
        new Response("not-json", {
          status: 200,
          headers: { "content-type": "application/json" }
        })
      )
    );
    const invalidJsonClient = createModelApiClient(
      testConfig({
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: "live-model-token"
      }),
      { fetch: asFetch(invalidJsonFetch) }
    );

    await expectRejects(
      invalidJsonClient.analyzeCv(cvPayload),
      DownstreamError
    );
  });

  test("maps downstream 4xx responses to downstream error", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "bad request" }), {
          status: 400,
          headers: { "content-type": "application/json" }
        })
      )
    );
    const client = createModelApiClient(
      testConfig({
        MODEL_API_ENABLE_MOCK: "false",
        MODEL_API_SERVICE_TOKEN: "live-model-token"
      }),
      { fetch: asFetch(fetchMock) }
    );

    await expectRejects(client.analyzeJobFit(jobFitPayload), DownstreamError);
  });
});

function asFetch(value: unknown): typeof fetch {
  return value as typeof fetch;
}

async function expectRejects(
  promise: Promise<unknown>,
  errorType: new (...args: never[]) => Error
) {
  try {
    await promise;
    throw new Error("Expected promise to reject");
  } catch (error) {
    expect(error).toBeInstanceOf(errorType);
  }
}

function toRequestUrl(input: string | URL | Request) {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.toString();
  }

  return input.url;
}
