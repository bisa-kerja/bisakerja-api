import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

describe("health routes", () => {
  test("returns readiness envelope when PostgreSQL is healthy", async () => {
    const response = await injectRoute(
      createApp(testConfig(), {
        routes: {
          health: {
            checks: {
              postgresql: () => Promise.resolve(),
              redis: () => Promise.resolve()
            }
          }
        }
      }),
      {
        url: "/health/ready",
        headers: {
          "x-request-id": "req_ready_healthy"
        }
      }
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: "Layanan siap",
      data: {
        service: "bisakerja-api",
        status: "ready",
        env: "test",
        dependencies: {
          postgresql: "healthy",
          redis: "healthy"
        }
      },
      meta: null
    });
  });

  test("maps PostgreSQL readiness failure to a 503 envelope", async () => {
    const response = await injectRoute(
      createApp(testConfig(), {
        routes: {
          health: {
            checks: {
              postgresql: () => Promise.reject(new Error("connection refused")),
              redis: () => Promise.resolve()
            }
          }
        }
      }),
      {
        url: "/health/ready",
        headers: {
          "x-request-id": "req_ready_unhealthy"
        }
      }
    );

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      message: "Layanan belum siap",
      data: null,
      error: {
        code: "SERVICE_UNAVAILABLE",
        details: {
          dependencies: {
            postgresql: "unhealthy",
            redis: "healthy"
          }
        },
        requestId: "req_ready_unhealthy"
      }
    });
  });
});
