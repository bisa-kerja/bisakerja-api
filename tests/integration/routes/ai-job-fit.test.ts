import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("ai job fit route removal", () => {
  test("does not expose standalone job fit API", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: { "x-request-id": "req_removed_job_fit" },
      body: {
        jobId: "11111111-1111-4111-8111-111111111111"
      }
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "NOT_FOUND",
        requestId: "req_removed_job_fit"
      }
    });
  });
});
