import { describe, expect, test } from "bun:test";
import type { RequestHandler } from "express";

import { createApp } from "@/app";
import { AuthenticationError } from "@/core/errors/app.error";
import type { AuthUser } from "@/modules/auth";
import type {
  CurrentUserRecord,
  ReplaceUserEducationInput,
  ReplaceUserExperienceInput,
  ReplaceUserSkillInput,
  UpdateCurrentUserRecordInput,
  UpsertProfilePhotoInput,
  UserOnboardingStatus,
  UsersRepository
} from "@/modules/users";
import { testConfig } from "../../helpers/config";
import { injectRoute } from "../../helpers/route";

const baseDate = new Date("2026-04-23T00:00:00.000Z");

describe("users routes", () => {
  test("requires authentication for /api/v1/me routes", async () => {
    const context = createUsersRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me",
      headers: { "x-request-id": "req_users_no_auth" }
    });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "UNAUTHENTICATED", requestId: "req_users_no_auth" }
    });
  });

  test("returns current user profile without sensitive fields", async () => {
    const context = createUsersRouteContext();

    const response = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me",
      headers: authHeaders("user-1", "req_users_get")
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      message: "Profile retrieved successfully",
      data: {
        id: "user-1",
        username: "salman",
        email: "salman@example.com",
        emailVerified: false,
        onboardingStatus: "PENDING",
        profile: {
          careerStatus: null,
          latestRole: null,
          summary: null
        },
        skills: [],
        experience: [],
        education: []
      },
      meta: null
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body)).not.toContain("token");
  });

  test("updates current user profile and enforces unique username", async () => {
    const context = createUsersRouteContext();

    const updated = await injectRoute(context.app, {
      method: "PATCH",
      url: "/api/v1/me",
      headers: authHeaders("user-1", "req_users_patch_success"),
      body: {
        username: "salman_dev",
        phoneNumber: "+6285551234567",
        displayName: "Salman Dev"
      }
    });

    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({
      success: true,
      data: {
        username: "salman_dev",
        phoneNumber: "+6285551234567",
        displayName: "Salman Dev",
        onboardingStatus: "IN_PROGRESS"
      }
    });

    const duplicate = await injectRoute(context.app, {
      method: "PATCH",
      url: "/api/v1/me",
      headers: authHeaders("user-1", "req_users_patch_conflict"),
      body: {
        username: "dina"
      }
    });

    expect(duplicate.status).toBe(409);
    expect(duplicate.body).toMatchObject({
      success: false,
      error: {
        code: "USERNAME_ALREADY_REGISTERED",
        requestId: "req_users_patch_conflict"
      }
    });

    const emptyBody = await injectRoute(context.app, {
      method: "PATCH",
      url: "/api/v1/me",
      headers: authHeaders("user-1", "req_users_patch_empty"),
      body: {}
    });

    expect(emptyBody.status).toBe(422);
  });

  test("upserts profile photo metadata and rejects invalid payload", async () => {
    const context = createUsersRouteContext();

    const invalidMime = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/profile-photo",
      headers: authHeaders("user-1", "req_users_photo_mime"),
      body: {
        storageKey: "profile-photos/user-1/avatar.gif",
        url: "https://cdn.example.com/profile-photos/user-1/avatar.gif",
        mimeType: "image/gif",
        sizeBytes: 1024
      }
    });
    expect(invalidMime.status).toBe(422);

    const invalidSize = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/profile-photo",
      headers: authHeaders("user-1", "req_users_photo_size"),
      body: {
        storageKey: "profile-photos/user-1/avatar.jpg",
        url: "https://cdn.example.com/profile-photos/user-1/avatar.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 5 * 1024 * 1024 + 1
      }
    });
    expect(invalidSize.status).toBe(422);

    const invalidUrl = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/profile-photo",
      headers: authHeaders("user-1", "req_users_photo_url"),
      body: {
        storageKey: "profile-photos/user-1/avatar.jpg",
        url: "not-a-url",
        mimeType: "image/jpeg",
        sizeBytes: 4096
      }
    });
    expect(invalidUrl.status).toBe(422);

    const success = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/profile-photo",
      headers: authHeaders("user-1", "req_users_photo_ok"),
      body: {
        storageKey: "profile-photos/user-1/avatar.webp",
        url: "https://cdn.example.com/profile-photos/user-1/avatar.webp",
        mimeType: "image/webp",
        sizeBytes: 4096
      }
    });

    expect(success.status).toBe(200);
    expect(success.body).toMatchObject({
      success: true,
      data: {
        profilePhoto: {
          url: "https://cdn.example.com/profile-photos/user-1/avatar.webp",
          mimeType: "image/webp",
          sizeBytes: 4096
        }
      }
    });
  });

  test("replaces skills with duplicate protection and ownership isolation", async () => {
    const context = createUsersRouteContext();

    const duplicate = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/skills",
      headers: authHeaders("user-1", "req_users_skills_duplicate"),
      body: {
        skills: [
          { name: "TypeScript", level: "INTERMEDIATE" },
          { name: "typescript", level: "ADVANCED" }
        ]
      }
    });

    expect(duplicate.status).toBe(422);

    const firstReplace = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/skills",
      headers: authHeaders("user-1", "req_users_skills_replace"),
      body: {
        skills: [
          { name: "TypeScript", level: "INTERMEDIATE" },
          { name: "PostgreSQL", level: "BASIC" }
        ]
      }
    });

    expect(firstReplace.status).toBe(200);
    expect(
      (firstReplace.body as { data: { skills: unknown[] } }).data.skills
    ).toHaveLength(2);

    const secondReplace = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/skills",
      headers: authHeaders("user-1", "req_users_skills_replace_again"),
      body: {
        skills: [{ name: "Node.js", level: "ADVANCED" }]
      }
    });

    expect(secondReplace.status).toBe(200);
    expect(
      (
        secondReplace.body as {
          data: { skills: { name: string; level: string | null }[] };
        }
      ).data.skills
    ).toMatchObject([{ name: "Node.js", level: "ADVANCED" }]);

    const otherUser = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me",
      headers: authHeaders("user-2", "req_users_skills_other_user")
    });
    expect(otherUser.status).toBe(200);
    expect(
      (otherUser.body as { data: { skills: unknown[] } }).data.skills
    ).toHaveLength(0);
  });

  test("replaces experience and education with validation rules", async () => {
    const context = createUsersRouteContext();

    const invalidExperience = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/experience",
      headers: authHeaders("user-1", "req_users_exp_invalid"),
      body: {
        experience: [
          {
            title: "Backend Developer",
            startDate: "2026-01-01",
            endDate: "2025-01-01",
            isCurrent: false
          }
        ]
      }
    });
    expect(invalidExperience.status).toBe(422);

    const validExperience = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/experience",
      headers: authHeaders("user-1", "req_users_exp_valid"),
      body: {
        experience: [
          {
            title: "Backend Developer Intern",
            company: "Example Tech",
            employmentType: "INTERNSHIP",
            startDate: "2025-01-01",
            endDate: "2025-06-30",
            isCurrent: false,
            description: "Built REST APIs with TypeScript."
          }
        ]
      }
    });
    expect(validExperience.status).toBe(200);
    expect(
      (validExperience.body as { data: { experience: unknown[] } }).data
        .experience
    ).toHaveLength(1);

    const invalidEducation = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/education",
      headers: authHeaders("user-1", "req_users_edu_invalid"),
      body: {
        education: [
          {
            institution: "Universitas Contoh",
            fieldOfStudy: "Informatics"
          }
        ]
      }
    });
    expect(invalidEducation.status).toBe(422);

    const validEducation = await injectRoute(context.app, {
      method: "PUT",
      url: "/api/v1/me/education",
      headers: authHeaders("user-1", "req_users_edu_valid"),
      body: {
        education: [
          {
            institution: "Universitas Contoh",
            degree: "Bachelor",
            fieldOfStudy: "Informatics",
            startYear: 2021,
            endYear: 2025
          }
        ]
      }
    });

    expect(validEducation.status).toBe(200);
    expect(
      (validEducation.body as { data: { education: unknown[] } }).data.education
    ).toHaveLength(1);
  });

  test("computes onboarding status transitions from pending to completed", async () => {
    const context = createUsersRouteContext();

    const initial = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me",
      headers: authHeaders("user-1", "req_users_onboarding_initial")
    });
    expect(initial.status).toBe(200);
    expect(
      (initial.body as { data: { onboardingStatus: string } }).data
        .onboardingStatus
    ).toBe("PENDING");

    const inProgress = await injectRoute(context.app, {
      method: "PATCH",
      url: "/api/v1/me",
      headers: authHeaders("user-1", "req_users_onboarding_progress"),
      body: {
        displayName: "Salman",
        phoneNumber: "+6281234567890"
      }
    });
    expect(inProgress.status).toBe(200);
    expect(
      (inProgress.body as { data: { onboardingStatus: string } }).data
        .onboardingStatus
    ).toBe("IN_PROGRESS");

    context.repository.setEmailVerified("user-1", true);
    context.repository.setHasPreference("user-1", true);

    const completed = await injectRoute(context.app, {
      method: "GET",
      url: "/api/v1/me",
      headers: authHeaders("user-1", "req_users_onboarding_complete")
    });
    expect(completed.status).toBe(200);
    expect(
      (completed.body as { data: { onboardingStatus: string } }).data
        .onboardingStatus
    ).toBe("COMPLETED");
  });
});

function createUsersRouteContext(overrides: Partial<NodeJS.ProcessEnv> = {}) {
  const repository = new InMemoryUsersRepository();
  const authMiddleware = createTestAuthMiddleware(repository);
  const app = createApp(testConfig(overrides), {
    routes: {
      users: {
        repository,
        authMiddleware
      }
    }
  });

  return { app, repository };
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
  repository: InMemoryUsersRepository
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

type StoredUser = CurrentUserRecord & {
  profile: CurrentUserRecord["profile"];
};

class InMemoryUsersRepository implements UsersRepository {
  private readonly users = new Map<string, StoredUser>();
  private readonly skillCatalog = new Map<
    string,
    { id: string; name: string }
  >();
  private experienceCounter = 0;
  private educationCounter = 0;

  constructor() {
    this.users.set(
      "user-1",
      this.createUser({
        id: "user-1",
        username: "salman",
        email: "salman@example.com",
        phoneNumber: null,
        displayName: null,
        emailVerified: false
      })
    );
    this.users.set(
      "user-2",
      this.createUser({
        id: "user-2",
        username: "dina",
        email: "dina@example.com",
        phoneNumber: "+6287771234567",
        displayName: "Dina",
        emailVerified: true
      })
    );
  }

  findCurrentUserById(userId: string): Promise<CurrentUserRecord | null> {
    const user = this.users.get(userId);
    return Promise.resolve(user ? structuredClone(user) : null);
  }

  findUserByUsername(username: string): Promise<{ id: string } | null> {
    const user = [...this.users.values()].find(
      (item) => item.username === username
    );
    return Promise.resolve(user ? { id: user.id } : null);
  }

  updateCurrentUser(
    userId: string,
    input: UpdateCurrentUserRecordInput
  ): Promise<void> {
    const user = this.requireUser(userId);

    if (input.username !== undefined) {
      user.username = input.username;
    }
    if (input.phoneNumber !== undefined) {
      user.phoneNumber = input.phoneNumber;
    }
    if (input.displayName !== undefined) {
      user.displayName = input.displayName;
    }
    user.updatedAt = new Date(baseDate.getTime() + 1_000);

    return Promise.resolve();
  }

  upsertProfilePhoto(
    userId: string,
    input: UpsertProfilePhotoInput
  ): Promise<void> {
    const user = this.requireUser(userId);
    const profile = user.profile ?? {
      careerStatus: null,
      latestRole: null,
      summary: null,
      profilePhotoStorageKey: null,
      profilePhotoUrl: null,
      profilePhotoMimeType: null,
      profilePhotoSizeBytes: null
    };

    profile.profilePhotoStorageKey = input.storageKey;
    profile.profilePhotoUrl = input.url ?? null;
    profile.profilePhotoMimeType = input.mimeType;
    profile.profilePhotoSizeBytes = input.sizeBytes;
    user.profile = profile;

    return Promise.resolve();
  }

  replaceSkills(userId: string, input: ReplaceUserSkillInput[]): Promise<void> {
    const user = this.requireUser(userId);

    user.skills = input.map((skill) => {
      let catalog = this.skillCatalog.get(skill.slug);
      if (!catalog) {
        catalog = {
          id: crypto.randomUUID(),
          name: skill.name
        };
        this.skillCatalog.set(skill.slug, catalog);
      }

      return {
        id: catalog.id,
        name: catalog.name,
        level: skill.level
      };
    });

    return Promise.resolve();
  }

  replaceExperience(
    userId: string,
    input: ReplaceUserExperienceInput[]
  ): Promise<void> {
    const user = this.requireUser(userId);

    user.experience = input.map((experience) => {
      this.experienceCounter += 1;

      return {
        id: `exp-${String(this.experienceCounter)}`,
        title: experience.title,
        company: experience.company,
        employmentType: experience.employmentType,
        startDate: experience.startDate,
        endDate: experience.endDate,
        isCurrent: experience.isCurrent,
        description: experience.description
      };
    });

    return Promise.resolve();
  }

  replaceEducation(
    userId: string,
    input: ReplaceUserEducationInput[]
  ): Promise<void> {
    const user = this.requireUser(userId);

    user.education = input.map((education) => {
      this.educationCounter += 1;

      return {
        id: `edu-${String(this.educationCounter)}`,
        institution: education.institution,
        degree: education.degree,
        fieldOfStudy: education.fieldOfStudy,
        startYear: education.startYear,
        endYear: education.endYear
      };
    });

    return Promise.resolve();
  }

  updateOnboardingStatus(
    userId: string,
    onboardingStatus: UserOnboardingStatus
  ): Promise<void> {
    const user = this.requireUser(userId);
    user.onboardingStatus = onboardingStatus;
    return Promise.resolve();
  }

  setEmailVerified(userId: string, emailVerified: boolean): void {
    const user = this.requireUser(userId);
    user.emailVerified = emailVerified;
  }

  setHasPreference(userId: string, hasPreference: boolean): void {
    const user = this.requireUser(userId);
    user.hasPreference = hasPreference;
  }

  getAuthUser(userId: string): AuthUser | null {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      onboardingStatus: user.onboardingStatus,
      createdAt: user.createdAt
    };
  }

  private requireUser(userId: string): StoredUser {
    const user = this.users.get(userId);

    if (!user) {
      throw new Error(`Missing test user: ${userId}`);
    }

    return user;
  }

  private createUser(input: {
    id: string;
    username: string;
    email: string;
    phoneNumber: string | null;
    displayName: string | null;
    emailVerified: boolean;
  }): StoredUser {
    return {
      id: input.id,
      username: input.username,
      email: input.email,
      emailVerified: input.emailVerified,
      phoneNumber: input.phoneNumber,
      displayName: input.displayName,
      onboardingStatus: "PENDING",
      createdAt: baseDate,
      updatedAt: baseDate,
      hasPreference: false,
      profile: null,
      skills: [],
      experience: [],
      education: []
    };
  }
}
