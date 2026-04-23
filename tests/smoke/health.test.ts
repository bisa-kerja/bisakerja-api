import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { testConfig } from "../helpers/config";
import { injectRoute } from "../helpers/route";

describe("health smoke checks", () => {
  test("liveness and readiness return standard envelopes", async () => {
    const app = createApp(testConfig(), {
      routes: {
        health: {
          checks: {
            postgresql: () => Promise.resolve()
          }
        }
      }
    });

    const live = await injectRoute(app, {
      url: "/health/live"
    });
    const ready = await injectRoute(app, {
      url: "/health/ready"
    });

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(live.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Service is live"
      })
    );
    expect(ready.body).toEqual(
      expect.objectContaining({
        success: true,
        message: "Service is ready"
      })
    );
  });
});
