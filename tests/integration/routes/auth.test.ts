import { describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import type {
  AsyncJobPublisher,
  EnqueueAsyncJobInput,
  AuthRepository,
  AuthUser,
  AuthUserWithCredential,
  CreateAccountInput,
  CreateRefreshTokenInput,
  EmailVerificationTokenRecord,
  PasswordResetTokenRecord,
  RefreshTokenRecord,
  GoogleOauthAdapter,
  GoogleOauthProfile
} from "@/modules/auth";
import type {
  PreferenceOnboardingState,
  PreferenceRecord,
  PreferencesRepository
} from "@/modules/preferences/preferences.types";
import type { UpsertPreferencesInput } from "@/modules/preferences/preferences.schema";
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
      data: { user: { id: string }; session: { accessToken: string } };
    };
    expect(typeof body.data.user.id).toBe("string");
    expect(typeof body.data.session.accessToken).toBe("string");
    expect(response.body).toEqual({
      success: true,
      message: "Akun berhasil didaftarkan. Silakan verifikasi email Anda.",
      data: {
        user: {
          id: body.data.user.id,
          username: "salman",
          email: "salman@example.com",
          emailVerified: false,
          onboardingStatus: "PENDING",
          createdAt: baseDate.toISOString()
        },
        session: body.data.session
      },
      meta: null
    });
    expect(JSON.stringify(response.body)).not.toContain("StrongPassword123!");
    expect(context.repository.enqueuedJobs).toHaveLength(1);
    expect(context.repository.enqueuedJobs[0]?.jobType).toBe(
      "auth.email-verification"
    );
    expect(context.publisher.publishedJobIds).toHaveLength(1);
    expect(getVerificationJob(context).payload).toMatchObject({
      email: "salman@example.com"
    });
    expect(getVerificationJob(context).payload.otp).toMatch(/^[0-9]{6}$/);
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

  test("allows onboarding preferences before OTP and auto logs in after verification", async () => {
    const context = createOnboardingRouteContext();

    const register = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/register",
      headers: { "x-request-id": "req_register_onboarding" },
      body: registerBody()
    });
    const onboardingAccessToken = getAccessToken(register.body);

    expect(register.status).toBe(201);
    expect(getSetCookie(register)).toBe("");

    const preferences = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: {
        Authorization: `Bearer ${onboardingAccessToken}`,
        "x-request-id": "req_pre_otp_preferences"
      },
      body: validPreferenceBody()
    });

    expect(preferences.status).toBe(200);
    expect(preferences.body).toMatchObject({
      data: {
        targetRoles: ["Backend Developer"],
        workTypes: ["REMOTE"]
      }
    });

    const strictProtected = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        Authorization: `Bearer ${onboardingAccessToken}`,
        "x-request-id": "req_pre_otp_logout"
      },
      body: {}
    });

    expect(strictProtected.status).toBe(401);

    const verify = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/verify-email",
      headers: { "x-request-id": "req_verify_auto_login" },
      body: {
        email: "salman@example.com",
        otp: getVerificationJob(context).payload.otp
      }
    });

    expect(verify.status).toBe(200);
    expect(typeof getAccessToken(verify.body)).toBe("string");
    expect(getSetCookie(verify)).toContain("bisakerja_refresh=");
    expect(verify.body).toMatchObject({
      data: {
        user: {
          emailVerified: true,
          onboardingStatus: "IN_PROGRESS"
        }
      }
    });
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
    expect(
      context.repository.enqueuedJobs.filter(
        (job) => job.jobType === "auth.password-reset"
      )
    ).toHaveLength(1);

    const reset = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/reset-password",
      headers: { "x-request-id": "req_reset" },
      body: {
        token: getPasswordResetJob(context).payload.token,
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
        otp: getVerificationJob(context).payload.otp
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
      method: "GET",
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

  test("starts Google OAuth and exchanges code for a new session", async () => {
    const adapter = new FakeGoogleOauthAdapter({
      good_code: {
        providerAccountId: "google_sub_123",
        email: "google.user@example.com",
        emailVerified: true,
        displayName: "Google User"
      }
    });
    const context = createAuthRouteContext(
      { GOOGLE_OAUTH_ENABLED: "true" },
      { googleOauthAdapter: adapter }
    );

    const start = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/auth/google",
      headers: { "x-request-id": "req_google_start" }
    });

    expect(start.status).toBe(200);
    expect(start.body).toMatchObject({ success: true });
    const authorizeUrl = (start.body as { data: { authorizeUrl: string } }).data
      .authorizeUrl;
    expect(typeof authorizeUrl).toBe("string");

    const cookies = getSetCookieHeaders(start);
    const stateCookie = cookies.find((cookie) =>
      cookie.includes("_state_google_oauth=")
    );
    const nonceCookie = cookies.find((cookie) =>
      cookie.includes("_nonce_google_oauth=")
    );

    expect(stateCookie).toBeTruthy();
    expect(nonceCookie).toBeTruthy();

    const stateValue = extractCookieValue(stateCookie ?? "");
    const nonceValue = extractCookieValue(nonceCookie ?? "");

    const exchange = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/google",
      headers: {
        Cookie: `${extractCookiePair(stateCookie ?? "")}; ${extractCookiePair(
          nonceCookie ?? ""
        )}`,
        "x-request-id": "req_google_exchange"
      },
      body: { code: "good_code", state: stateValue }
    });

    expect(exchange.status).toBe(200);
    const exchangeCookies = getSetCookieHeaders(exchange);
    expect(exchangeCookies.some((cookie) => cookie.includes("HttpOnly"))).toBe(
      true
    );
    expect(
      exchangeCookies.some((cookie) => cookie.includes("bisakerja_refresh="))
    ).toBe(true);
    expect(exchange.body).toMatchObject({
      success: true,
      message: "Login Google berhasil",
      data: {
        user: {
          email: "google.user@example.com",
          emailVerified: true
        }
      }
    });
    expect(typeof getAccessToken(exchange.body)).toBe("string");
    expect(JSON.stringify(exchange.body)).not.toContain(nonceValue);
  });

  test("rejects Google OAuth exchange when state mismatches", async () => {
    const adapter = new FakeGoogleOauthAdapter({
      good_code: {
        providerAccountId: "google_sub_123",
        email: "google.user@example.com",
        emailVerified: true,
        displayName: "Google User"
      }
    });
    const context = createAuthRouteContext(
      { GOOGLE_OAUTH_ENABLED: "true" },
      { googleOauthAdapter: adapter }
    );

    const start = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/auth/google",
      headers: { "x-request-id": "req_google_start2" }
    });
    const cookies = getSetCookieHeaders(start);
    const stateCookie = cookies.find((cookie) =>
      cookie.includes("_state_google_oauth=")
    );
    const nonceCookie = cookies.find((cookie) =>
      cookie.includes("_nonce_google_oauth=")
    );

    const exchange = await injectRoute(context.app, {
      method: "POST",
      url: "/api/v1/auth/google",
      headers: {
        Cookie: `${extractCookiePair(stateCookie ?? "")}; ${extractCookiePair(
          nonceCookie ?? ""
        )}`,
        "x-request-id": "req_google_bad_state"
      },
      body: { code: "good_code", state: "wrong_state_value" }
    });

    expect(exchange.status).toBe(400);
    expect(exchange.body).toMatchObject({
      success: false,
      error: {
        code: "GOOGLE_OAUTH_STATE_INVALID",
        requestId: "req_google_bad_state"
      }
    });
  });
});

function createAuthRouteContext(
  overrides: Partial<NodeJS.ProcessEnv> = {},
  options: { googleOauthAdapter?: GoogleOauthAdapter } = {}
) {
  const repository = new InMemoryAuthRepository();
  const publisher = new RecordingJobPublisher();
  let now = baseDate;
  const app = createApp(testConfig(overrides), {
    routes: {
      auth: {
        repository,
        jobPublisher: publisher,
        now: () => now,
        googleOauthAdapter: options.googleOauthAdapter
      }
    }
  });

  return {
    app,
    repository,
    publisher,
    setNow: (date: Date) => {
      now = date;
    }
  };
}

function createOnboardingRouteContext() {
  const repository = new InMemoryAuthRepository();
  const preferencesRepository = new InMemoryPreferencesRepository(repository);
  const publisher = new RecordingJobPublisher();
  let now = baseDate;
  const config = testConfig();
  const app = createApp(config, {
    routes: {
      auth: {
        repository,
        jobPublisher: publisher,
        now: () => now
      },
      preferences: {
        repository: preferencesRepository,
        authMiddleware: createAuthMiddleware(config, repository, {
          allowUnverifiedEmail: true
        })
      }
    }
  });

  return {
    app,
    repository,
    publisher,
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

function validPreferenceBody() {
  return {
    careerStatus: "FRESH_GRADUATE",
    jobSeekingStatus: "IMMEDIATE",
    targetRoles: ["Backend Developer"],
    locations: [{ province: "DKI Jakarta", city: "Jakarta Selatan" }],
    workTypes: ["REMOTE"],
    salaryExpectation: {
      min: 5_000_000,
      max: 10_000_000,
      currency: "IDR",
      period: "MONTHLY"
    },
    emailNotificationsEnabled: true
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
      otp: getVerificationJob(context).payload.otp
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

function getSetCookieHeaders(
  response: Awaited<ReturnType<typeof injectRoute>>
) {
  const value =
    response.headers["set-cookie"] ?? response.headers["Set-Cookie"];

  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function extractCookiePair(cookieHeader: string) {
  return cookieHeader.split(";")[0] ?? "";
}

function extractCookieValue(cookieHeader: string) {
  const pair = extractCookiePair(cookieHeader);
  const index = pair.indexOf("=");
  if (index < 0) {
    return "";
  }
  return pair.slice(index + 1);
}

function getAccessToken(body: unknown): string {
  return (body as { data: { session: { accessToken: string } } }).data.session
    .accessToken;
}

function getVerificationJob(
  context: ReturnType<typeof createAuthRouteContext>
) {
  const job = context.repository.enqueuedJobs.find(
    (entry) => entry.jobType === "auth.email-verification"
  );

  if (!job) {
    throw new Error("Expected verification async job.");
  }

  return job satisfies EnqueueAsyncJobInput<"auth.email-verification"> & {
    jobId: string;
  };
}

function getPasswordResetJob(
  context: ReturnType<typeof createAuthRouteContext>
) {
  const job = context.repository.enqueuedJobs.find(
    (entry) => entry.jobType === "auth.password-reset"
  );

  if (!job) {
    throw new Error("Expected password reset async job.");
  }

  return job satisfies EnqueueAsyncJobInput<"auth.password-reset"> & {
    jobId: string;
  };
}

class RecordingJobPublisher implements AsyncJobPublisher {
  readonly publishedJobIds: string[] = [];

  publish(jobId: string): Promise<void> {
    this.publishedJobIds.push(jobId);
    return Promise.resolve();
  }

  publishPending(): Promise<number> {
    return Promise.resolve(0);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeGoogleOauthAdapter implements GoogleOauthAdapter {
  constructor(private readonly profiles: Record<string, GoogleOauthProfile>) {}

  generateAuthorizeUrl(input: { state: string; nonce: string }): string {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("state", input.state);
    url.searchParams.set("nonce", input.nonce);
    return url.toString();
  }

  exchangeCodeForProfile(input: {
    code: string;
    expectedNonce: string;
  }): Promise<GoogleOauthProfile> {
    const profile = this.profiles[input.code];
    if (!profile) {
      throw new Error(`Missing fake Google profile for code ${input.code}`);
    }

    return Promise.resolve(structuredClone(profile));
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
  readonly enqueuedJobs: ((
    | EnqueueAsyncJobInput<"auth.email-verification">
    | EnqueueAsyncJobInput<"auth.password-reset">
  ) & { jobId: string })[] = [];

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

  findUserByGoogleAccountId(
    providerAccountId: string
  ): Promise<AuthUserWithCredential | null> {
    return Promise.resolve(
      this.findUser((user) =>
        user.credentials.some(
          (credential) =>
            credential.provider === "GOOGLE" &&
            credential.providerAccountId === providerAccountId
        )
      )
    );
  }

  linkGoogleCredential(input: {
    userId: string;
    providerAccountId: string;
  }): Promise<void> {
    const user = this.requireUser(input.userId);
    const existing = user.credentials.find(
      (credential) => credential.provider === "GOOGLE"
    );
    if (!existing) {
      user.credentials.push({
        id: crypto.randomUUID(),
        userId: user.id,
        provider: "GOOGLE",
        providerAccountId: input.providerAccountId,
        passwordHash: null,
        passwordHashAlgorithm: null,
        passwordUpdatedAt: null
      });
    }
    return Promise.resolve();
  }

  markEmailVerifiedAt(userId: string, _at: Date): Promise<void> {
    const user = this.requireUser(userId);
    user.emailVerified = true;
    return Promise.resolve();
  }

  createAccount(input: CreateAccountInput): Promise<AuthUser> {
    const userId = crypto.randomUUID();
    const user: AuthUserWithCredential = {
      id: userId,
      email: input.email,
      username: input.username,
      emailVerified: false,
      onboardingStatus: "PENDING",
      createdAt: baseDate,
      status: "ACTIVE",
      credentials: [
        {
          id: crypto.randomUUID(),
          userId,
          provider: "LOCAL",
          providerAccountId: null,
          passwordHash: input.passwordHash,
          passwordHashAlgorithm: input.passwordHashAlgorithm,
          passwordUpdatedAt: baseDate
        }
      ]
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

  createGoogleAccount(input: {
    email: string;
    username: string;
    providerAccountId: string;
    emailVerifiedAt: Date;
  }): Promise<AuthUserWithCredential> {
    const userId = crypto.randomUUID();
    const user: AuthUserWithCredential = {
      id: userId,
      email: input.email,
      username: input.username,
      emailVerified: true,
      onboardingStatus: "PENDING",
      createdAt: baseDate,
      status: "ACTIVE",
      credentials: [
        {
          id: crypto.randomUUID(),
          userId,
          provider: "GOOGLE",
          providerAccountId: input.providerAccountId,
          passwordHash: null,
          passwordHashAlgorithm: null,
          passwordUpdatedAt: null
        }
      ]
    };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  createAccountWithEmailVerificationJob(input: {
    account: CreateAccountInput;
    job: EnqueueAsyncJobInput<"auth.email-verification">;
  }): Promise<{ user: AuthUser; jobId: string }> {
    return this.createAccount(input.account).then((user) => {
      const jobId = crypto.randomUUID();
      this.enqueuedJobs.push({
        ...input.job,
        actorId: user.id,
        jobId
      });

      return { user, jobId };
    });
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

  markEmailVerified(
    userId: string,
    tokenId: string
  ): Promise<AuthUserWithCredential> {
    const user = this.requireUser(userId);
    const token = this.verificationTokens.get(tokenId);

    user.emailVerified = true;
    if (token) {
      token.usedAt = baseDate;
    }

    return Promise.resolve(user);
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

  createPasswordResetTokenWithJob(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    job: EnqueueAsyncJobInput<"auth.password-reset">;
  }): Promise<{ jobId: string }> {
    return this.createPasswordResetToken(
      input.userId,
      input.tokenHash,
      input.expiresAt
    ).then(() => {
      const jobId = crypto.randomUUID();
      this.enqueuedJobs.push({
        ...input.job,
        jobId
      });

      return { jobId };
    });
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

    const local = user.credentials.find(
      (credential) => credential.provider === "LOCAL"
    );
    if (local) {
      local.passwordHash = passwordHash;
      local.passwordHashAlgorithm = passwordHashAlgorithm;
      local.passwordUpdatedAt = baseDate;
    }
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

  setOnboardingStatus(
    userId: string,
    onboardingStatus: AuthUser["onboardingStatus"]
  ): void {
    this.requireUser(userId).onboardingStatus = onboardingStatus;
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

class InMemoryPreferencesRepository implements PreferencesRepository {
  private readonly preferences = new Map<string, PreferenceRecord>();
  private readonly onboarding = new Map<string, PreferenceOnboardingState>();

  constructor(private readonly authRepository: InMemoryAuthRepository) {}

  findByUserId(userId: string): Promise<PreferenceRecord | null> {
    const preference = this.preferences.get(userId);
    return Promise.resolve(preference ? structuredClone(preference) : null);
  }

  upsertForUser(
    userId: string,
    input: UpsertPreferencesInput
  ): Promise<PreferenceRecord> {
    const existing = this.preferences.get(userId);
    const preference: PreferenceRecord = {
      id: existing?.id ?? `pref-${userId}`,
      userId,
      ...structuredClone(input),
      createdAt: existing?.createdAt ?? baseDate,
      updatedAt: new Date(baseDate.getTime() + 1_000)
    };

    this.preferences.set(userId, preference);
    return Promise.resolve(structuredClone(preference));
  }

  findUserOnboardingState(
    userId: string
  ): Promise<PreferenceOnboardingState | null> {
    const state = this.onboarding.get(userId) ?? {
      emailVerified: false,
      displayName: null,
      phoneNumber: "+6281234567890",
      onboardingStatus: "PENDING" as const
    };
    this.onboarding.set(userId, state);
    return Promise.resolve(structuredClone(state));
  }

  updateUserOnboardingStatus(
    userId: string,
    onboardingStatus: PreferenceOnboardingState["onboardingStatus"]
  ): Promise<void> {
    const state = this.onboarding.get(userId);
    if (state) {
      state.onboardingStatus = onboardingStatus;
    }
    this.authRepository.setOnboardingStatus(userId, onboardingStatus);
    return Promise.resolve();
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
