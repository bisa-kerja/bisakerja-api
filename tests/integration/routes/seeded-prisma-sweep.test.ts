import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

import { createApp } from "@/app";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaAiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer";
import { PrismaAiJobFitRepository } from "@/modules/ai-job-fit";
import { PrismaAuthRepository } from "@/modules/auth";
import { PrismaApplicationsRepository } from "@/modules/applications";
import { PrismaBookmarksRepository } from "@/modules/bookmarks";
import { PrismaJobsRepository } from "@/modules/jobs";
import { PrismaPreferencesRepository } from "@/modules/preferences";
import { PrismaUsersRepository } from "@/modules/users";
import type { AsyncJobPublisher } from "@/shared/async-workloads";
import { createModelApiClient } from "@/shared/integrations/model-api.client";
import {
  hashPassword,
  passwordHashAlgorithm,
  verifyPassword
} from "@/shared/utils/password";
import { jobs, users, applicationRecords } from "../../../prisma/seed-data";
import {
  testConfig,
  testEnv,
  testSeedUserPassword
} from "../../helpers/config";
import { modelApiFixtures } from "../../fixtures/model-api";
import { injectRoute } from "../../helpers/route";
import { assertIntegrationTestEnvironment } from "../../helpers/test-environment";

const describeIfDatabaseTestsEnabled =
  process.env.RUN_DATABASE_TESTS === "true" ? describe : describe.skip;
const testDatabaseUrl = testEnv.DATABASE_URL;
const testDirectDatabaseUrl = testEnv.DIRECT_DATABASE_URL;
const seedPassword = testSeedUserPassword;
const annisa = users.find(
  (user) => user.email === "annisa.pratama@example.test"
);
const annisaApplication = applicationRecords.find(
  (application) => application.userId === annisa?.id
);
const jobForDetail = jobs[0];
const jobForBookmark = jobs.find(
  (job) =>
    job.id !== jobForDetail?.id && job.id !== annisaApplication?.jobListingId
);
const jobForNewApplication = jobs.find(
  (job) =>
    job.id !== jobForDetail?.id &&
    job.id !== jobForBookmark?.id &&
    job.id !== annisaApplication?.jobListingId
);

if (
  !annisa ||
  !annisaApplication ||
  !jobForDetail ||
  !jobForBookmark ||
  !jobForNewApplication
) {
  throw new Error("Seed fixture assumptions are invalid.");
}

const seededAnnisa = annisa;
const seededAnnisaApplication = annisaApplication;
const seededJobForDetail = jobForDetail;
const seededJobForBookmark = jobForBookmark;
const seededJobForNewApplication = jobForNewApplication;

describeIfDatabaseTestsEnabled("seeded Prisma route sweep", () => {
  const config = testConfig({
    DATABASE_URL: testDatabaseUrl,
    DIRECT_DATABASE_URL: testDatabaseUrl,
    MODEL_API_ENABLE_MOCK: "true"
  });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: testDatabaseUrl })
  });
  const jobPublisher = new CapturingAsyncJobPublisher(prisma);
  const app = createApp(config, {
    routes: {
      auth: {
        jobPublisher,
        repository: new PrismaAuthRepository(prisma)
      },
      jobs: {
        repository: new PrismaJobsRepository(prisma)
      },
      preferences: {
        repository: new PrismaPreferencesRepository(prisma)
      },
      bookmarks: {
        repository: new PrismaBookmarksRepository(prisma)
      },
      applications: {
        repository: new PrismaApplicationsRepository(prisma)
      },
      users: {
        repository: new PrismaUsersRepository(prisma)
      },
      aiJobFit: {
        repository: new PrismaAiJobFitRepository(prisma),
        modelApiClient: createModelApiClient(config, {
          mockResponses: {
            jobFit: modelApiFixtures.validJobFitResponse
          }
        })
      },
      aiCvAnalyzer: {
        repository: new PrismaAiCvAnalyzerRepository(prisma),
        modelApiClient: createModelApiClient(config, {
          mockResponses: {
            cvAnalyzer: modelApiFixtures.validCvAnalyzerResponse
          }
        })
      }
    }
  });

  beforeAll(async () => {
    assertIntegrationTestEnvironment(config, { databaseUrl: testDatabaseUrl });
    await ensureSeededDatabase(prisma);
    await ensureSeedUserCredential(prisma);
    await cleanupRouteSweepArtifacts(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("hits all user-facing API endpoints against seeded Prisma data without 500 responses", async () => {
    const requestResults: RouteResult[] = [];

    const live = await request(app, requestResults, {
      method: "GET",
      url: "/health/live"
    });
    expect(live.status).toBe(200);

    const ready = await request(app, requestResults, {
      method: "GET",
      url: "/health/ready"
    });
    expect(ready.status).toBe(200);

    const jobsList = await request(app, requestResults, {
      method: "GET",
      url: "/api/v1/jobs?page=1&limit=5&keyword=backend"
    });
    expect(jobsList.status).toBe(200);
    expectListEnvelope(jobsList.body, "Daftar lowongan berhasil diambil");
    expectListHasItems(jobsList.body);
    expectNoInternalJobFields(jobsList.body);

    const jobDetail = await request(app, requestResults, {
      method: "GET",
      url: `/api/v1/jobs/${seededJobForDetail.id}`
    });
    expect(jobDetail.status).toBe(200);
    expect(jobDetail.body).toMatchObject({
      success: true,
      message: "Lowongan berhasil diambil",
      data: {
        id: seededJobForDetail.id,
        company: { id: seededJobForDetail.companyId },
        sourcePlatform: { id: seededJobForDetail.sourcePlatformId }
      },
      meta: null
    });
    expectNoInternalJobFields(jobDetail.body);

    const seedLogin = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: {
        identifier: seededAnnisa.email,
        password: seedPassword
      }
    });
    expect(seedLogin.status).toBe(200);

    const seedRefreshCookie = getSetCookie(seedLogin.headers);

    const refresh = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        Cookie: seedRefreshCookie
      },
      body: {}
    });
    expect(refresh.status).toBe(200);

    const forgotPassword = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/forgot-password",
      body: {
        email: seededAnnisa.email
      }
    });
    expect(forgotPassword.status).toBe(200);

    const resetToken = await jobPublisher.takeLatestResetToken(
      seededAnnisa.email
    );
    const newSeedPassword = "Password123!Reset";

    const resetPassword = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/reset-password",
      body: {
        token: resetToken,
        password: newSeedPassword,
        confirmPassword: newSeedPassword
      }
    });
    expect(resetPassword.status).toBe(200);

    const relogin = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: {
        identifier: seededAnnisa.email,
        password: newSeedPassword
      }
    });
    expect(relogin.status).toBe(200);

    const reloginAccessToken = getAccessToken(relogin.body);
    const reloginRefreshCookie = getSetCookie(relogin.headers);
    const authHeadersForSeedUser = authHeaders(reloginAccessToken);

    const uniqueSuffix = Date.now().toString();
    const registeredEmail = `seeded-route-${uniqueSuffix}@example.test`;
    const registeredUsername = `seeded_route_${uniqueSuffix}`;
    const registeredPassword = "Password123!Temp";

    const register = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/register",
      body: {
        username: registeredUsername,
        email: registeredEmail,
        phoneNumber: "+6281312345678",
        password: registeredPassword,
        confirmPassword: registeredPassword
      }
    });
    expect(register.status).toBe(201);

    const verificationOtp =
      await jobPublisher.takeLatestVerificationOtp(registeredEmail);

    const verifyEmail = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/verify-email",
      body: {
        email: registeredEmail,
        otp: verificationOtp
      }
    });
    expect(verifyEmail.status).toBe(200);

    const registeredLogin = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/login",
      body: {
        identifier: registeredEmail,
        password: registeredPassword
      }
    });
    expect(registeredLogin.status).toBe(200);

    const google = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/google",
      body: {}
    });
    expect(google.status).toBe(501);

    const getMe = await request(app, requestResults, {
      method: "GET",
      url: "/api/v1/me",
      headers: authHeadersForSeedUser
    });
    expect(getMe.status).toBe(200);

    const patchMe = await request(app, requestResults, {
      method: "PATCH",
      url: "/api/v1/me",
      headers: authHeadersForSeedUser,
      body: {
        displayName: "Annisa Pratama QA Sweep",
        phoneNumber: "+6281211119999"
      }
    });
    expect(patchMe.status).toBe(200);

    const profilePhoto = await request(app, requestResults, {
      method: "PUT",
      url: "/api/v1/me/profile-photo",
      headers: authHeadersForSeedUser,
      body: {
        storageKey: "profiles/annisa-pratama-qa-sweep.webp",
        url: "https://example.test/profiles/annisa-pratama-qa-sweep.webp",
        mimeType: "image/webp",
        sizeBytes: 4096
      }
    });
    expect(profilePhoto.status).toBe(200);

    const replaceSkills = await request(app, requestResults, {
      method: "PUT",
      url: "/api/v1/me/skills",
      headers: authHeadersForSeedUser,
      body: {
        skills: [
          { name: "TypeScript", level: "ADVANCED" },
          { name: "PostgreSQL", level: "INTERMEDIATE" },
          { name: "Docker", level: "BASIC" }
        ]
      }
    });
    expect(replaceSkills.status).toBe(200);

    const replaceExperience = await request(app, requestResults, {
      method: "PUT",
      url: "/api/v1/me/experience",
      headers: authHeadersForSeedUser,
      body: {
        experience: [
          {
            title: "Backend Developer",
            company: "PT Solusi Karier Digital",
            employmentType: "FULL_TIME",
            startDate: "2024-01-15",
            endDate: null,
            isCurrent: true,
            description: "Mengelola API pencarian lowongan dan autentikasi."
          }
        ]
      }
    });
    expect(replaceExperience.status).toBe(200);

    const replaceEducation = await request(app, requestResults, {
      method: "PUT",
      url: "/api/v1/me/education",
      headers: authHeadersForSeedUser,
      body: {
        education: [
          {
            institution: "Universitas Indonesia",
            degree: "S.Kom.",
            fieldOfStudy: "Ilmu Komputer",
            startYear: 2019,
            endYear: 2023
          }
        ]
      }
    });
    expect(replaceEducation.status).toBe(200);

    const getPreferences = await request(app, requestResults, {
      method: "GET",
      url: "/api/v1/me/preferences",
      headers: authHeadersForSeedUser
    });
    expect(getPreferences.status).toBe(200);

    const patchPreferences = await request(app, requestResults, {
      method: "PATCH",
      url: "/api/v1/me/preferences",
      headers: authHeadersForSeedUser,
      body: {
        emailNotificationsEnabled: false,
        salaryExpectation: {
          min: 10_000_000
        }
      }
    });
    expect(patchPreferences.status).toBe(200);

    const putPreferences = await request(app, requestResults, {
      method: "PUT",
      url: "/api/v1/me/preferences",
      headers: authHeadersForSeedUser,
      body: {
        careerStatus: "EARLY_CAREER",
        jobSeekingStatus: "IMMEDIATE",
        targetRoles: ["Backend Developer", "Platform Engineer"],
        locations: [
          { province: "DKI Jakarta", city: "Jakarta Selatan" },
          { province: "Jawa Barat", city: "Bandung" }
        ],
        workTypes: ["REMOTE", "HYBRID"],
        salaryExpectation: {
          min: 11_000_000,
          max: 15_000_000,
          currency: "IDR",
          period: "MONTHLY"
        },
        emailNotificationsEnabled: true
      }
    });
    expect(putPreferences.status).toBe(200);

    const listBookmarks = await request(app, requestResults, {
      method: "GET",
      url: "/api/v1/me/bookmarks?page=1&limit=10&sort=created_desc",
      headers: authHeadersForSeedUser
    });
    expect(listBookmarks.status).toBe(200);
    expectListEnvelope(listBookmarks.body, "Daftar bookmark berhasil diambil");
    expectNoInternalJobFields(listBookmarks.body);

    const createBookmark = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/me/bookmarks",
      headers: authHeadersForSeedUser,
      body: {
        jobId: seededJobForBookmark.id
      }
    });
    expect(createBookmark.status).toBe(201);
    expect(createBookmark.body).toMatchObject({
      success: true,
      message: "Lowongan berhasil disimpan",
      data: {
        jobId: seededJobForBookmark.id
      },
      meta: null
    });
    expect(
      typeof (createBookmark.body as { data?: { createdAt?: unknown } }).data
        ?.createdAt
    ).toBe("string");

    const deleteBookmark = await request(app, requestResults, {
      method: "DELETE",
      url: `/api/v1/me/bookmarks/${seededJobForBookmark.id}`,
      headers: authHeadersForSeedUser
    });
    expect(deleteBookmark.status).toBe(204);

    const listApplications = await request(app, requestResults, {
      method: "GET",
      url: "/api/v1/me/applications?page=1&limit=10&sort=updated_desc",
      headers: authHeadersForSeedUser
    });
    expect(listApplications.status).toBe(200);
    expectListEnvelope(
      listApplications.body,
      "Daftar lamaran berhasil diambil"
    );
    expectListHasItems(listApplications.body);
    expectNoInternalJobFields(listApplications.body);

    const createApplication = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/me/applications",
      headers: authHeadersForSeedUser,
      body: {
        jobId: seededJobForNewApplication.id,
        source: "MANUAL",
        notes: "Created by seeded Prisma route sweep."
      }
    });
    expect(createApplication.status).toBe(201);
    expect(createApplication.body).toMatchObject({
      success: true,
      message: "Lamaran berhasil dibuat",
      data: {
        status: "APPLIED",
        source: "MANUAL",
        notes: "Created by seeded Prisma route sweep.",
        job: { id: seededJobForNewApplication.id }
      },
      meta: null
    });
    expectNoInternalJobFields(createApplication.body);

    const patchApplication = await request(app, requestResults, {
      method: "PATCH",
      url: `/api/v1/me/applications/${seededAnnisaApplication.id}`,
      headers: authHeadersForSeedUser,
      body: {
        notes: "Interview follow-up confirmed by seeded route sweep.",
        source: "EXTERNAL_APPLY_CLICK"
      }
    });
    expect(patchApplication.status).toBe(200);
    expect(patchApplication.body).toMatchObject({
      success: true,
      message: "Lamaran berhasil diperbarui",
      data: {
        id: seededAnnisaApplication.id,
        notes: "Interview follow-up confirmed by seeded route sweep.",
        source: "EXTERNAL_APPLY_CLICK"
      },
      meta: null
    });

    const patchApplicationStatus = await request(app, requestResults, {
      method: "PATCH",
      url: `/api/v1/me/applications/${seededAnnisaApplication.id}/status`,
      headers: authHeadersForSeedUser,
      body: {
        status: "ACCEPTED",
        notes: "Status changed during seeded route sweep."
      }
    });
    expect(patchApplicationStatus.status).toBe(200);
    expect(patchApplicationStatus.body).toMatchObject({
      success: true,
      message: "Status lamaran berhasil diperbarui",
      data: {
        id: seededAnnisaApplication.id,
        status: "ACCEPTED",
        notes: "Status changed during seeded route sweep."
      },
      meta: null
    });

    const aiJobFit = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/ai/job-fit",
      headers: authHeadersForSeedUser,
      body: {
        jobId: seededJobForDetail.id,
        persistResult: true
      }
    });
    expect(aiJobFit.status).toBe(200);

    const aiCvAnalyzer = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/ai/cv-analyzer",
      headers: authHeadersForSeedUser,
      formData: buildCvAnalyzerFormData(seededJobForDetail.id)
    });
    expect(aiCvAnalyzer.status).toBe(200);

    const logout = await request(app, requestResults, {
      method: "POST",
      url: "/api/v1/auth/logout",
      headers: {
        ...authHeadersForSeedUser,
        Cookie: reloginRefreshCookie
      },
      body: {}
    });
    expect(logout.status).toBe(200);

    expect(requestResults).toHaveLength(32);
  });
});

type RouteResult = {
  method: string;
  url: string;
  status: number;
};

async function ensureSeededDatabase(prisma: PrismaClient) {
  const counts = await countSeededDatabase(prisma);

  if (
    counts.userCount !== users.length ||
    counts.jobCount !== jobs.length ||
    counts.applicationCount !== applicationRecords.length
  ) {
    await reseedTestDatabase();
  }

  const syncedCounts = await countSeededDatabase(prisma);

  expect(syncedCounts.userCount).toBe(users.length);
  expect(syncedCounts.jobCount).toBe(jobs.length);
  expect(syncedCounts.applicationCount).toBe(applicationRecords.length);
}

async function countSeededDatabase(prisma: PrismaClient) {
  const userCount = await prisma.user.count({
    where: {
      email: {
        in: users.map((user) => user.email)
      }
    }
  });
  const jobCount = await prisma.jobListing.count({
    where: {
      externalJobId: {
        in: jobs.map((job) => job.externalJobId)
      }
    }
  });
  const applicationCount = await prisma.applicationRecord.count({
    where: {
      id: {
        in: applicationRecords.map((application) => application.id)
      }
    }
  });

  return {
    userCount,
    jobCount,
    applicationCount
  };
}

async function reseedTestDatabase() {
  const child = Bun.spawn({
    cmd: ["bun", "run", "prisma/seed.ts"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      DIRECT_DATABASE_URL: testDirectDatabaseUrl,
      SEED_USER_PASSWORD: seedPassword
    },
    stdout: "pipe",
    stderr: "pipe"
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ]);

  if (exitCode === 0) {
    return;
  }

  throw new Error(
    [
      "Failed to reseed integration test database.",
      stdout.trim(),
      stderr.trim()
    ]
      .filter(Boolean)
      .join("\n")
  );
}

async function ensureSeedUserCredential(prisma: PrismaClient) {
  const user = await prisma.user.findUnique({
    where: { id: seededAnnisa.id },
    select: {
      status: true,
      emailVerifiedAt: true,
      authCredential: {
        select: {
          passwordHash: true
        }
      }
    }
  });

  expect(user?.status).toBe("ACTIVE");
  expect(user?.emailVerifiedAt).not.toBeNull();
  expect(user?.authCredential).not.toBeNull();

  if (!user?.authCredential) {
    return;
  }

  if (await verifyPassword(user.authCredential.passwordHash, seedPassword)) {
    return;
  }

  await prisma.authCredential.update({
    where: { userId: seededAnnisa.id },
    data: {
      passwordHash: await hashPassword(seedPassword),
      passwordHashAlgorithm,
      passwordUpdatedAt: new Date()
    }
  });
}

async function cleanupRouteSweepArtifacts(prisma: PrismaClient) {
  const createdApplication = await prisma.applicationRecord.findUnique({
    where: {
      userId_jobListingId: {
        userId: seededAnnisa.id,
        jobListingId: seededJobForNewApplication.id
      }
    },
    select: {
      id: true
    }
  });

  if (
    createdApplication &&
    createdApplication.id !== seededAnnisaApplication.id
  ) {
    await prisma.applicationStatusHistory.deleteMany({
      where: { applicationRecordId: createdApplication.id }
    });
    await prisma.applicationRecord.delete({
      where: { id: createdApplication.id }
    });
  }

  await prisma.bookmark.deleteMany({
    where: {
      userId: seededAnnisa.id,
      jobListingId: seededJobForBookmark.id
    }
  });

  await prisma.applicationRecord.update({
    where: { id: seededAnnisaApplication.id },
    data: {
      status: seededAnnisaApplication.status,
      source: seededAnnisaApplication.source,
      notes: seededAnnisaApplication.notes
    }
  });

  await prisma.user.deleteMany({
    where: {
      email: {
        startsWith: "seeded-route-"
      }
    }
  });
}

async function request(
  app: ReturnType<typeof createApp>,
  results: RouteResult[],
  options: Parameters<typeof injectRoute>[1]
) {
  const response = await injectRoute(app, options);

  results.push({
    method: options.method ?? "GET",
    url: options.url,
    status: response.status
  });

  expect(response.status).not.toBe(500);

  return response;
}

function authHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`
  };
}

function getAccessToken(body: unknown) {
  const payload = body as {
    data?: {
      session?: {
        accessToken?: string;
      };
    };
  };
  const accessToken = payload.data?.session?.accessToken;

  if (!accessToken) {
    throw new Error("Expected access token in response body.");
  }

  return accessToken;
}

function getSetCookie(headers: Record<string, string | string[] | undefined>) {
  const value = headers["set-cookie"];

  if (!value) {
    throw new Error("Expected set-cookie header.");
  }

  if (Array.isArray(value)) {
    const firstCookie = value[0];

    if (!firstCookie) {
      throw new Error("Expected at least one set-cookie header value.");
    }

    return firstCookie;
  }

  return value;
}

function expectListEnvelope(body: unknown, message: string) {
  expect(body).toMatchObject({
    success: true,
    message,
    meta: {
      pagination: {
        page: 1,
        hasPrevPage: false
      }
    }
  });
  expect(
    typeof (body as { meta?: { pagination?: { hasNextPage?: unknown } } }).meta
      ?.pagination?.hasNextPage
  ).toBe("boolean");
  expect(Array.isArray((body as { data?: unknown }).data)).toBe(true);
}

function expectListHasItems(body: unknown) {
  const data = (body as { data?: unknown }).data;

  expect(Array.isArray(data)).toBe(true);
  expect((data as unknown[]).length).toBeGreaterThan(0);
}

function expectNoInternalJobFields(body: unknown) {
  const serialized = JSON.stringify(body);

  expect(serialized).not.toContain("externalJobId");
  expect(serialized).not.toContain("sourcePayload");
}

function buildCvAnalyzerFormData(jobId: string) {
  const formData = new FormData();
  const pdfBuffer = Buffer.from("%PDF-1.4\n%seeded prisma route sweep\n");

  formData.set("jobId", jobId);
  formData.set("language", "id");
  formData.set("inputMode", "UPLOAD");
  formData.set("compareSource", "JOB_SEARCH");
  formData.set("persistResult", "true");
  formData.set(
    "cvFile",
    new File([pdfBuffer], "seeded-route-sweep.pdf", {
      type: "application/pdf"
    })
  );

  return formData;
}

class CapturingAsyncJobPublisher implements AsyncJobPublisher {
  constructor(private readonly prisma: PrismaClient) {}

  publish(): Promise<void> {
    return Promise.resolve();
  }

  publishPending(): Promise<number> {
    return Promise.resolve(0);
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  async takeLatestVerificationOtp(email: string) {
    const record = await this.prisma.asyncJobOutbox.findFirst({
      where: { jobType: "AUTH_EMAIL_VERIFICATION" },
      orderBy: { createdAt: "desc" }
    });

    if (!record) {
      throw new Error(`Expected verification OTP for ${email}.`);
    }

    const payload = record.payload as { email?: string; otp?: string };

    if (payload.email !== email || !payload.otp) {
      throw new Error(`Expected verification OTP for ${email}.`);
    }

    return payload.otp;
  }

  async takeLatestResetToken(email: string) {
    const record = await this.prisma.asyncJobOutbox.findFirst({
      where: { jobType: "AUTH_PASSWORD_RESET" },
      orderBy: { createdAt: "desc" }
    });

    if (!record) {
      throw new Error(`Expected password reset token for ${email}.`);
    }

    const payload = record.payload as { email?: string; token?: string };

    if (payload.email !== email || !payload.token) {
      throw new Error(`Expected password reset token for ${email}.`);
    }

    return payload.token;
  }
}
