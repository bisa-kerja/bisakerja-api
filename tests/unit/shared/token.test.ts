import { describe, expect, test } from "bun:test";

import {
  createNumericOtp,
  createOpaqueToken,
  hashToken,
  tokenHashesEqual
} from "@/shared/utils/token";

describe("token utilities", () => {
  test("creates base64url opaque tokens with requested byte length", () => {
    const defaultToken = createOpaqueToken();
    const shortToken = createOpaqueToken(8);

    expect(defaultToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(shortToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(defaultToken.length).toBeGreaterThan(shortToken.length);
  });

  test("creates numeric otp with fixed width", () => {
    const otp = createNumericOtp(6);
    const longOtp = createNumericOtp(8);

    expect(otp).toMatch(/^\d{6}$/);
    expect(longOtp).toMatch(/^\d{8}$/);
  });

  test("hashes tokens deterministically and compares safely", () => {
    const token = "refresh-token-example";
    const secret = "secret-key-example";
    const sameHash = hashToken(token, secret);
    const sameHashSecond = hashToken(token, secret);
    const differentHash = hashToken("different-token", secret);

    expect(sameHash).toBe(sameHashSecond);
    expect(sameHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHashesEqual(sameHash, sameHashSecond)).toBe(true);
    expect(tokenHashesEqual(sameHash, differentHash)).toBe(false);
    expect(tokenHashesEqual(sameHash, "abcd")).toBe(false);
  });
});
