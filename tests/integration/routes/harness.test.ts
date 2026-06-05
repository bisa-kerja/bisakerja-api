import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { testConfig } from "../../helpers/config";
import { assertIntegrationTestEnvironment } from "../../helpers/test-environment";
import { injectRoute } from "../../helpers/route";

describe("route test harness", () => {
  test("runs an Express app through middleware and route handling", async () => {
    const config = testConfig();

    assertIntegrationTestEnvironment(config);

    const response = await injectRoute(createApp(config), {
      url: "/health/live",
      headers: {
        "x-request-id": "req_harness_123"
      }
    });

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("req_harness_123");
    expect(response.body).toEqual({
      success: true,
      message: "Service is live",
      data: {
        service: "bisakerja-api",
        status: "live",
        env: "test"
      },
      meta: null
    });
  });
});
