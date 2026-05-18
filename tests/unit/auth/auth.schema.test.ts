import { describe, expect, test } from "bun:test";

import {
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema
} from "@/modules/auth/auth.schema";

describe("auth schemas", () => {
  test("normalizes register email and username", () => {
    const parsed = registerSchema.parse({
      username: "salman_123",
      email: "SALMAN@EXAMPLE.COM",
      phoneNumber: "+6281234567890",
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!"
    });

    expect(parsed.email).toBe("salman@example.com");
    expect(parsed.username).toBe("salman_123");
  });

  test("rejects weak password and password mismatch", () => {
    const result = registerSchema.safeParse({
      username: "A",
      email: "invalid-email",
      phoneNumber: "08123",
      password: "weak",
      confirmPassword: "different"
    });

    expect(result.success).toBe(false);
    const issues = result.error?.issues ?? [];
    expect(issues.map((issue) => issue.path.join("."))).toContain("username");
    expect(issues.map((issue) => issue.path.join("."))).toContain("email");
    expect(issues.map((issue) => issue.path.join("."))).toContain(
      "phoneNumber"
    );
    expect(issues.map((issue) => issue.path.join("."))).toContain("password");
    expect(issues.map((issue) => issue.path.join("."))).toContain(
      "confirmPassword"
    );
    expect(
      issues.find((issue) => issue.path.join(".") === "email")?.message
    ).toBe(
      "Email tidak valid. Gunakan format email lengkap, contoh nama@domain.com"
    );
    expect(
      issues.find((issue) => issue.path.join(".") === "confirmPassword")
        ?.message
    ).toBe("Konfirmasi kata sandi tidak sesuai. Samakan dengan kata sandi");
  });

  test("accepts email or username login identifiers", () => {
    expect(
      loginSchema.parse({
        identifier: "SALMAN@EXAMPLE.COM",
        password: "x"
      }).identifier
    ).toBe("salman@example.com");
    expect(
      loginSchema.parse({
        identifier: "salman",
        password: "x"
      }).identifier
    ).toBe("salman");
  });

  test("validates reset password and email verification payloads", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "a".repeat(32),
        password: "NewStrongPassword123!",
        confirmPassword: "NewStrongPassword123!"
      }).success
    ).toBe(true);
    expect(
      verifyEmailSchema.safeParse({
        email: "salman@example.com",
        otp: "123456"
      }).success
    ).toBe(true);
    expect(
      verifyEmailSchema.safeParse({
        email: "salman@example.com",
        otp: "abc"
      }).success
    ).toBe(false);
  });
});
