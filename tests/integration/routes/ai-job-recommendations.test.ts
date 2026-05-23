import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("ai job recommendations route removal", () => {
  test("does not expose standalone job recommendations API", async () => {
    const response = await injectRoute(createApp(testConfig()), {
      method: "POST",
      url: "/api/v1/ai/job-recommendations",
      headers: { "x-request-id": "req_removed_job_recommendations" },
      body: {
        limit: 10
      }
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "NOT_FOUND",
        requestId: "req_removed_job_recommendations"
      }
    });
  });
});
