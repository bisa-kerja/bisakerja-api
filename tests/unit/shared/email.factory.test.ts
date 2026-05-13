import { describe, expect, test } from "bun:test";

import {
  FakeEmailService,
  ResendEmailService,
  createEmailService
} from "@/shared/email";
import { testConfig } from "../../helpers/config";

describe("email service factory", () => {
  test("creates fake provider when configured as fake", () => {
    const config = testConfig({
      EMAIL_PROVIDER: "fake"
    });

    const service = createEmailService(config);

    expect(service).toBeInstanceOf(FakeEmailService);
  });

  test("creates resend provider when configured as resend", () => {
    const config = testConfig({
      EMAIL_PROVIDER: "resend",
      RESEND_API_KEY: "re_test_123"
    });

    const service = createEmailService(config);

    expect(service).toBeInstanceOf(ResendEmailService);
  });
});
