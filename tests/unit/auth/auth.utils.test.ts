import { describe, expect, test } from "bun:test";

import { testConfig } from "../../helpers/config";
import { issueAccessToken, verifyAccessToken } from "@/shared/utils/jwt";
import { hashPassword, verifyPassword } from "@/shared/utils/password";
import {
  createNumericOtp,
  createOpaqueToken,
  hashToken
} from "@/shared/utils/token";
import { parseDurationMs, parseDurationSeconds } from "@/shared/utils/ttl";

describe("auth utilities", () => {
  test("hashes and verifies passwords without returning plaintext", async () => {
    const password = "StrongPassword123!";
    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(hash).toContain("argon2id");
    expect(await verifyPassword(hash, password)).toBe(true);
    expect(await verifyPassword(hash, "WrongPassword123!")).toBe(false);
  });

  test("creates opaque tokens, OTPs, and deterministic token hashes", () => {
    const secret = "test-refresh-token-secret-change-me-32";
    const token = createOpaqueToken();
    const otp = createNumericOtp();

    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(otp).toMatch(/^[0-9]{6}$/);
    expect(hashToken(token, secret)).toBe(hashToken(token, secret));
    expect(hashToken(token, secret)).not.toBe(token);
  });

  test("issues and verifies access JWTs with issuer and audience", () => {
    const config = testConfig();
    const session = issueAccessToken(config, {
      userId: "user_123",
      email: "salman@example.com",
      username: "salman"
    });
    const payload = verifyAccessToken(config, session.accessToken);

    expect(session.expiresIn).toBe(900);
    expect(payload?.sub).toBe("user_123");
    expect(payload?.type).toBe("access");
    expect(payload?.email).toBe("salman@example.com");
  });

  test("parses duration strings used by auth config", () => {
    expect(parseDurationSeconds("15m")).toBe(900);
    expect(parseDurationMs("7d")).toBe(604800000);
  });
});
