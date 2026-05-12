import { describe, expect, test } from "bun:test";
import type { RequestHandler } from "express";

import { createApp } from "@/app";
import { AuthenticationError } from "@/core/errors/app.error";
import type { AuthUser } from "@/modules/auth";
import type {
  PreferenceOnboardingState,
  PreferenceRecord,
  PreferencesRepository
} from "@/modules/preferences/preferences.types";
import type { UpsertPreferencesInput } from "@/modules/preferences/preferences.schema";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const baseDate = new Date("2026-04-23T00:00:00.000Z");

describe("preferences routes", () => {
  test("requires authentication", async () => {
    const context = createPreferencesRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/preferences",
      headers: { "x-request-id": "req_preferences_no_auth" }
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "UNAUTHENTICATED",
        requestId: "req_preferences_no_auth"
      }
    });
  });

  test("returns not found before preferences are created", async () => {
    const context = createPreferencesRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_missing")
    });

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: "PREFERENCES_NOT_FOUND",
        requestId: "req_preferences_missing"
      }
    });
  });

  test("creates and reads active preferences", async () => {
    const context = createPreferencesRouteContext();

    const created = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_put"),
      body: validPreferenceBody()
    });

    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      success: true,
      message: "Preferensi berhasil disimpan",
      data: {
        careerStatus: "FRESH_GRADUATE",
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
      },
      meta: null
    });

    const read = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_get")
    });

    expect(read.status).toBe(200);
    expect(read.body).toMatchObject({
      success: true,
      message: "Preferensi berhasil diambil",
      data: {
        id: "pref-user-1",
        targetRoles: ["Backend Developer"]
      }
    });
  });

  test("repeated PUT updates the same active preference set", async () => {
    const context = createPreferencesRouteContext();

    await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_put_first"),
      body: validPreferenceBody()
    });

    const updated = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_put_second"),
      body: {
        ...validPreferenceBody(),
        targetRoles: ["Frontend Developer"],
        emailNotificationsEnabled: false
      }
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      data: {
        id: "pref-user-1",
        targetRoles: ["Frontend Developer"],
        emailNotificationsEnabled: false
      }
    });
    expect(context.repository.totalPreferences()).toBe(1);
  });

  test("PATCH updates selected fields without overwriting the rest", async () => {
    const context = createPreferencesRouteContext();

    await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_patch_seed"),
      body: validPreferenceBody()
    });

    const patched = await injectRoute(context.app, {
      method: "PATCH",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_patch"),
      body: {
        salaryExpectation: { min: null },
        emailNotificationsEnabled: false
      }
    });

    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      success: true,
      message: "Preferensi berhasil diperbarui",
      data: {
        targetRoles: ["Backend Developer"],
        salaryExpectation: {
          min: null,
          max: 10_000_000,
          currency: "IDR",
          period: "MONTHLY"
        },
        emailNotificationsEnabled: false
      }
    });
  });

  test("validates enum, salary range, empty patch, and userId injection", async () => {
    const context = createPreferencesRouteContext();

    const invalidEnum = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_enum"),
      body: {
        ...validPreferenceBody(),
        careerStatus: "STUDENT"
      }
    });
    expect(invalidEnum.status).toBe(422);

    const invalidSalary = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_salary"),
      body: {
        ...validPreferenceBody(),
        salaryExpectation: { min: 10_000_000, max: 5_000_000 }
      }
    });
    expect(invalidSalary.status).toBe(422);
    expect(invalidSalary.body).toMatchObject({
      error: { code: "INVALID_SALARY_RANGE" }
    });

    const userIdInjection = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_user_id"),
      body: {
        ...validPreferenceBody(),
        userId: "user-2"
      }
    });
    expect(userIdInjection.status).toBe(422);

    const emptyPatch = await injectRoute(context.app, {
      method: "PATCH",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_empty_patch"),
      body: {}
    });
    expect(emptyPatch.status).toBe(400);
    expect(emptyPatch.body).toMatchObject({
      error: { code: "BAD_REQUEST" }
    });
  });

  test("keeps preferences scoped to authenticated user", async () => {
    const context = createPreferencesRouteContext();

    await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-1", "req_preferences_owner_user_1"),
      body: validPreferenceBody()
    });

    const otherUser = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me/preferences",
      headers: authHeaders("user-2", "req_preferences_owner_user_2")
    });

    expect(otherUser.status).toBe(404);
  });
});

function createPreferencesRouteContext(
  overrides: Partial<NodeJS.ProcessEnv> = {}
) {
  const repository = new InMemoryPreferencesRepository();
  const authMiddleware = createTestAuthMiddleware(repository);
  const app = createApp(testConfig(overrides), {
    routes: {
      preferences: {
        repository,
        authMiddleware
      }
    }
  });

  return { app, repository };
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

function authHeaders(
  userId: string,
  requestId: string
): Record<string, string> {
  return {
    Authorization: `Bearer ${userId}`,
    "x-request-id": requestId
  };
}

function createTestAuthMiddleware(
  repository: InMemoryPreferencesRepository
): RequestHandler {
  return (req, _res, next) => {
    const header = req.get("authorization");

    if (!header?.startsWith("Bearer ")) {
      next(new AuthenticationError());
      return;
    }

    const userId = header.slice("Bearer ".length).trim();
    const authUser = repository.getAuthUser(userId);

    if (!authUser) {
      next(new AuthenticationError());
      return;
    }

    req.auth = {
      userId: authUser.id,
      user: authUser
    };

    next();
  };
}

class InMemoryPreferencesRepository implements PreferencesRepository {
  private readonly preferences = new Map<string, PreferenceRecord>();
  private readonly onboarding = new Map<string, PreferenceOnboardingState>();

  constructor() {
    this.onboarding.set("user-1", {
      emailVerified: true,
      displayName: "Salman Dev",
      phoneNumber: "+6281234567890",
      onboardingStatus: "IN_PROGRESS"
    });
    this.onboarding.set("user-2", {
      emailVerified: true,
      displayName: "Dina",
      phoneNumber: "+6287771234567",
      onboardingStatus: "IN_PROGRESS"
    });
  }

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
    const state = this.onboarding.get(userId);
    return Promise.resolve(state ? structuredClone(state) : null);
  }

  updateUserOnboardingStatus(
    userId: string,
    onboardingStatus: PreferenceOnboardingState["onboardingStatus"]
  ): Promise<void> {
    const state = this.onboarding.get(userId);
    if (state) {
      state.onboardingStatus = onboardingStatus;
    }
    return Promise.resolve();
  }

  getAuthUser(userId: string): AuthUser | null {
    const state = this.onboarding.get(userId);
    if (!state) {
      return null;
    }

    return {
      id: userId,
      username: userId === "user-1" ? "salman" : "dina",
      email: `${userId}@example.test`,
      emailVerified: state.emailVerified,
      onboardingStatus: state.onboardingStatus,
      createdAt: baseDate
    };
  }

  totalPreferences(): number {
    return this.preferences.size;
  }
}
