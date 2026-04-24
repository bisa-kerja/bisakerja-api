import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import type {
  AuthRepository,
  AuthUser,
  AuthUserWithCredential,
  CreateAccountInput,
  CreateRefreshTokenInput,
  EmailProvider,
  EmailVerificationTokenRecord,
  PasswordResetTokenRecord,
  RefreshTokenRecord
} from "@/modules/auth";
import { passwordHashAlgorithm } from "@/shared/utils/password";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const baseDate = new Date("2026-04-23T00:00:00.000Z");

describe("auth routes", () => {
  test("registers an account and does not expose credentials", async () => {
    const context = createAuthRouteContext();
    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-request-id": "req_auth_register" },
      body: registerBody()
    });

    expect(response.status).toBe(201);
    expect(response.headers["set-cookie"]).toBeUndefined();
    const body = response.body as {
      data: { user: { id: string } };
    };
    expect(typeof body.data.user.id).toBe("string");
    expect(response.body).toEqual({
      success: true,
      message: "Account registered successfully. Please verify your email.",
      data: {
        user: {
          id: body.data.user.id,
          username: "salman",
          email: "salman@example.com",
          emailVerified: false,
          onboardingStatus: "PENDING",
          createdAt: baseDate.toISOString()
        }
      },
      meta: null
    });
    expect(JSON.stringify(response.body)).not.toContain("StrongPassword123!");
    expect(context.email.verifications).toHaveLength(1);
    expect(context.email.verifications[0]?.otp).toMatch(/^[0-9]{6}$/);
  });

  test("rejects duplicate email and weak password", async () => {
    const context = createAuthRouteContext();

    await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/register",
      body: registerBody()
    });

    const duplicate = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-request-id": "req_duplicate" },
      body: registerBody({ username: "salman2" })
    });
    const weak = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-request-id": "req_weak" },
      body: registerBody({
        email: "weak@example.com",
        username: "weakuser",
        password: "weak",
        confirmPassword: "weak"
      })
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({
      success: false,
      error: {
        code: "EMAIL_ALREADY_REGISTERED",
        requestId: "req_duplicate"
      }
    });
    expect(weak.status).toBe(422);
    expect(weak.body).toMatchObject({
      success: false,
      error: { code: "VALIDATION_ERROR", requestId: "req_weak" }
    });
  });

  test("verifies email, logs in, refreshes, and invalidates rotated refresh tokens", async () => {
    const context = createAuthRouteContext();

    await registerAndVerify(context);

    const login = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-request-id": "req_login" },
      body: {
        identifier: "salman@example.com",
        password: "StrongPassword123!"
      }
    });
    const loginCookie = getSetCookie(login);
    const accessToken = getAccessToken(login.body);

    expect(login.status).toBe(200);
    expect(typeof accessToken).toBe("string");
    expect(loginCookie).toContain("HttpOnly");
    expect(JSON.stringify(login.body)).not.toContain("bisakerja_refresh");

    const refresh = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        Cookie: loginCookie,
        "x-request-id": "req_refresh"
      },
      body: {}
    });
    const rotatedCookie = getSetCookie(refresh);

    expect(refresh.status).toBe(200);
    expect(typeof getAccessToken(refresh.body)).toBe("string");
    expect(rotatedCookie).toContain("bisakerja_refresh=");

    const reused = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        Cookie: loginCookie,
        "x-request-id": "req_reuse"
      },
      body: {}
    });

    expect(reused.status).toBe(401);
    expect(reused.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED", requestId: "req_reuse" }
    });

    const logout = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Cookie: rotatedCookie,
        "x-request-id": "req_logout"
      },
      body: {}
    });

    expect(logout.status).toBe(200);
    expect(getSetCookie(logout)).toContain("Max-Age=0");

    const afterLogout = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        Cookie: rotatedCookie,
        "x-request-id": "req_after_logout"
      },
      body: {}
    });

    expect(afterLogout.status).toBe(401);
  });

  test("applies configured secure refresh cookie flags", async () => {
    const context = createAuthRouteContext({
      AUTH_COOKIE_SECURE: "true",
      AUTH_COOKIE_SAME_SITE: "none"
    });

    await registerAndVerify(context);

    const response = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-request-id": "req_login_cookie_flags" },
      body: {
        identifier: "salman@example.com",
        password: "StrongPassword123!"
      }
    });

    expect(response.status).toBe(200);
    const cookie = getSetCookie(response);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=none");
  });

  test("rejects invalid login and unverified email with safe responses", async () => {
    const context = createAuthRouteContext();

    await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/register",
      body: registerBody()
    });

    const unverified = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-request-id": "req_unverified" },
      body: {
        identifier: "salman@example.com",
        password: "StrongPassword123!"
      }
    });
    const invalid = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-request-id": "req_invalid" },
      body: {
        identifier: "missing@example.com",
        password: "WrongPassword123!"
      }
    });

    expect(unverified.status).toBe(403);
    expect(unverified.body).toMatchObject({
      error: { code: "EMAIL_NOT_VERIFIED", requestId: "req_unverified" }
    });
    expect(invalid.status).toBe(401);
    expect(invalid.body).toMatchObject({
      error: { code: "INVALID_CREDENTIALS", requestId: "req_invalid" }
    });
  });

  test("requires valid access token for authenticated logout", async () => {
    const context = createAuthRouteContext();
    const missing = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: { "x-request-id": "req_missing_auth" },
      body: {}
    });
    const invalid = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        Authorization: "Bearer invalid",
        "x-request-id": "req_invalid_auth"
      },
      body: {}
    });

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
  });

  test("returns identical forgot-password responses and supports reset token", async () => {
    const context = createAuthRouteContext();
    await registerAndVerify(context);
    const login = await loginVerified(context);

    const known = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      headers: { "x-request-id": "req_forgot_known" },
      body: { email: "salman@example.com" }
    });
    const unknown = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      headers: { "x-request-id": "req_forgot_unknown" },
      body: { email: "unknown@example.com" }
    });

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(context.email.passwordResets).toHaveLength(1);

    const reset = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/reset-password",
      headers: { "x-request-id": "req_reset" },
      body: {
        token: context.email.passwordResets[0]?.token,
        password: "NewStrongPassword123!",
        confirmPassword: "NewStrongPassword123!"
      }
    });

    expect(reset.status).toBe(200);

    const oldRefresh = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        Cookie: getSetCookie(login),
        "x-request-id": "req_old_refresh"
      },
      body: {}
    });
    const newLogin = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: {
        identifier: "salman",
        password: "NewStrongPassword123!"
      }
    });

    expect(oldRefresh.status).toBe(401);
    expect(newLogin.status).toBe(200);
  });

  test("rejects expired verification and reset credentials", async () => {
    const context = createAuthRouteContext();

    await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/register",
      body: registerBody()
    });
    context.setNow(new Date("2026-04-23T00:11:00.000Z"));

    const verify = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/verify-email",
      headers: { "x-request-id": "req_expired_verify" },
      body: {
        email: "salman@example.com",
        otp: context.email.verifications[0]?.otp
      }
    });

    expect(verify.status).toBe(400);
    expect(verify.body).toMatchObject({
      error: {
        code: "EMAIL_VERIFICATION_EXPIRED",
        requestId: "req_expired_verify"
      }
    });
  });

  test("keeps Google SSO unavailable and rate limits auth routes", async () => {
    const context = createAuthRouteContext();
    const google = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/google",
      headers: { "x-request-id": "req_google" }
    });

    expect(google.status).toBe(501);
    expect(google.body).toMatchObject({
      error: { code: "GOOGLE_SSO_NOT_CONFIGURED", requestId: "req_google" }
    });

    const rateContext = createAuthRouteContext({
      AUTH_RATE_LIMIT_MAX: "1",
      RATE_LIMIT_MAX: "100"
    });
    const first = await injectRoute(rateContext.app, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-request-id": "req_rate_1" },
      body: { identifier: "none@example.com", password: "x" }
    });
    const second = await injectRoute(rateContext.app, {
      method: "POST",
      url: "/api/v1/auth/login",
      headers: { "x-request-id": "req_rate_2" },
      body: { identifier: "none@example.com", password: "x" }
    });

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
  });
});

function createAuthRouteContext(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const repository = new InMemoryAuthRepository();
  const email = new RecordingEmailProvider();
  let now = baseDate;
  const app = createApp(testConfig(overrides), {
    routes: {
      auth: {
        repository,
        emailProvider: email,
        now: () => now
      }
    }
  });

  return {
    app,
    repository,
    email,
    setNow: (date: Date) => {
      now = date;
    }
  };
}

function registerBody(overrides: Record<string, unknown> = {}) {
  return {
    username: "salman",
    email: "salman@example.com",
    phoneNumber: "+6281234567890",
    password: "StrongPassword123!",
    confirmPassword: "StrongPassword123!",
    ...overrides
  };
}

async function registerAndVerify(
  context: ReturnType<typeof createAuthRouteContext>
) {
  await injectRoute(context.app, {
    method: "POST",
    url: "/api/v1/auth/register",
    body: registerBody()
  });
  const verify = await injectRoute(context.app, {
    method: "POST",
    url: "/api/v1/auth/verify-email",
    body: {
      email: "salman@example.com",
      otp: context.email.verifications[0]?.otp
    }
  });

  expect(verify.status).toBe(200);
}

async function loginVerified(
  context: ReturnType<typeof createAuthRouteContext>
) {
  return injectRoute(context.app, {
    method: "POST",
    url: "/api/v1/auth/login",
    body: {
      identifier: "salman@example.com",
      password: "StrongPassword123!"
    }
  });
}

function getSetCookie(response: Awaited<ReturnType<typeof injectRoute>>) {
  const value =
    response.headers["set-cookie"] ?? response.headers["Set-Cookie"];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function getAccessToken(body: unknown): string {
  return (body as { data: { session: { accessToken: string } } }).data.session
    .accessToken;
}

class RecordingEmailProvider implements EmailProvider {
  readonly verifications: { email: string; otp: string; expiresAt: Date }[] =
    [];
  readonly passwordResets: { email: string; token: string; expiresAt: Date }[] =
    [];

  sendEmailVerification(input: {
    email: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    this.verifications.push(input);
    return Promise.resolve();
  }

  sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    this.passwordResets.push(input);
    return Promise.resolve();
  }
}

class InMemoryAuthRepository implements AuthRepository {
  private readonly users = new Map<string, AuthUserWithCredential>();
  private readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  private readonly verificationTokens = new Map<
    string,
    EmailVerificationTokenRecord & { email: string; otpHash: string }
  >();
  private readonly passwordResetTokens = new Map<
    string,
    PasswordResetTokenRecord & { tokenHash: string }
  >();

  findUserByEmail(email: string): Promise<AuthUserWithCredential | null> {
    return Promise.resolve(this.findUser((user) => user.email === email));
  }

  findUserByUsername(username: string): Promise<AuthUserWithCredential | null> {
    return Promise.resolve(this.findUser((user) => user.username === username));
  }

  findUserById(userId: string): Promise<AuthUserWithCredential | null> {
    return Promise.resolve(this.users.get(userId) ?? null);
  }

  findUserByIdentifier(
    identifier: string
  ): Promise<AuthUserWithCredential | null> {
    return Promise.resolve(
      this.findUser(
        (user) => user.email === identifier || user.username === identifier
      )
    );
  }

  createAccount(input: CreateAccountInput): Promise<AuthUser> {
    const user: AuthUserWithCredential = {
      id: crypto.randomUUID(),
      email: input.email,
      username: input.username,
      emailVerified: false,
      onboardingStatus: "PENDING",
      createdAt: baseDate,
      status: "ACTIVE",
      credential: {
        passwordHash: input.passwordHash,
        passwordHashAlgorithm: input.passwordHashAlgorithm
      }
    };
    const tokenId = crypto.randomUUID();

    this.users.set(user.id, user);
    this.verificationTokens.set(tokenId, {
      id: tokenId,
      userId: user.id,
      email: user.email,
      otpHash: input.verificationOtpHash,
      expiresAt: input.verificationExpiresAt,
      usedAt: null
    });

    return Promise.resolve(toSafeUser(user));
  }

  findActiveEmailVerificationToken(
    email: string,
    otpHash: string
  ): Promise<EmailVerificationTokenRecord | null> {
    return Promise.resolve(
      [...this.verificationTokens.values()].find(
        (token) =>
          token.email === email && token.otpHash === otpHash && !token.usedAt
      ) ?? null
    );
  }

  markEmailVerified(userId: string, tokenId: string): Promise<AuthUser> {
    const user = this.requireUser(userId);
    const token = this.verificationTokens.get(tokenId);

    user.emailVerified = true;
    if (token) {
      token.usedAt = baseDate;
    }

    return Promise.resolve(toSafeUser(user));
  }

  createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<void> {
    const id = crypto.randomUUID();
    this.passwordResetTokens.set(id, {
      id,
      userId,
      tokenHash,
      expiresAt,
      usedAt: null
    });
    return Promise.resolve();
  }

  findActivePasswordResetToken(
    tokenHash: string
  ): Promise<PasswordResetTokenRecord | null> {
    return Promise.resolve(
      [...this.passwordResetTokens.values()].find(
        (token) => token.tokenHash === tokenHash && !token.usedAt
      ) ?? null
    );
  }

  completePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
    _passwordHashAlgorithm: string
  ): Promise<void> {
    const user = this.requireUser(userId);
    const token = this.passwordResetTokens.get(tokenId);

    user.credential = {
      passwordHash,
      passwordHashAlgorithm
    };
    if (token) {
      token.usedAt = baseDate;
    }
    for (const refreshToken of this.refreshTokens.values()) {
      if (refreshToken.userId === userId) {
        refreshToken.revokedAt = baseDate;
      }
    }
    return Promise.resolve();
  }

  createRefreshToken(
    input: CreateRefreshTokenInput
  ): Promise<RefreshTokenRecord> {
    const token = this.buildRefreshToken(input);
    this.refreshTokens.set(token.id, token);
    return Promise.resolve(token);
  }

  findActiveRefreshToken(
    tokenHash: string
  ): Promise<RefreshTokenRecord | null> {
    return Promise.resolve(
      [...this.refreshTokens.values()].find(
        (token) => token.tokenHash === tokenHash && !token.revokedAt
      ) ?? null
    );
  }

  rotateRefreshToken(
    currentTokenId: string,
    input: CreateRefreshTokenInput
  ): Promise<RefreshTokenRecord> {
    const current = this.refreshTokens.get(currentTokenId);
    const next = this.buildRefreshToken(input);

    if (current) {
      current.revokedAt = baseDate;
    }
    this.refreshTokens.set(next.id, next);

    return Promise.resolve(next);
  }

  revokeRefreshToken(tokenId: string): Promise<void> {
    const token = this.refreshTokens.get(tokenId);

    if (token) {
      token.revokedAt = baseDate;
    }
    return Promise.resolve();
  }

  revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    for (const token of this.refreshTokens.values()) {
      if (token.userId === userId) {
        token.revokedAt = baseDate;
      }
    }
    return Promise.resolve();
  }

  private findUser(
    predicate: (user: AuthUserWithCredential) => boolean
  ): AuthUserWithCredential | null {
    return [...this.users.values()].find(predicate) ?? null;
  }

  private requireUser(userId: string): AuthUserWithCredential {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error(`Missing test user ${userId}`);
    }

    return user;
  }

  private buildRefreshToken(
    input: CreateRefreshTokenInput
  ): RefreshTokenRecord {
    return {
      id: crypto.randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      tokenFamilyId: input.tokenFamilyId,
      expiresAt: input.expiresAt,
      revokedAt: null,
      user: this.requireUser(input.userId)
    };
  }
}

function toSafeUser(user: AuthUserWithCredential): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    onboardingStatus: user.onboardingStatus,
    createdAt: user.createdAt
  };
}
