import { createHash } from "node:crypto";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  passwordHashAlgorithm,
  hashPassword
} from "../src/shared/utils/password";
import {
  aiRequestLogs,
  applicationHistories,
  applicationRecords,
  bookmarks,
  companies,
  cvAnalysisResults,
  cvFileMetadata,
  fitScoreResults,
  ingestionRuns,
  jobs,
  skillGapResults,
  skills,
  sourcePlatforms,
  seededUuid,
  users
} from "./seed-data";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

const databaseUrl = requireEnv("DIRECT_DATABASE_URL");
const seedUserPassword = requireEnv("SEED_USER_PASSWORD");

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl
  })
});

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function seedEntityId(namespace: string, reference: string) {
  return seededUuid(`seed-${namespace}-${reference}`);
}

function buildAuthCredentials(passwordHashes: Record<string, string>) {
  return users.map((user) => ({
    id: seedEntityId("auth", user.id),
    userId: user.id,
    provider: "LOCAL" as const,
    providerAccountId: null,
    passwordHash: passwordHashes[user.id],
    passwordHashAlgorithm,
    passwordUpdatedAt: user.updatedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }));
}

function buildRefreshTokens() {
  return users.map((user, index) => ({
    id: seedEntityId("refresh-token", user.id),
    userId: user.id,
    tokenHash: sha256(`refresh:${user.email}`),
    tokenFamilyId: seedEntityId("refresh-family", user.id),
    replacedByTokenId: null,
    userAgent: `Seed Browser ${index + 1}`,
    ipAddress: `10.10.0.${index + 11}`,
    expiresAt: new Date(
      `2026-05-${String(index + 10).padStart(2, "0")}T12:00:00.000Z`
    ),
    revokedAt: index === 4 ? new Date("2026-04-23T10:30:00.000Z") : null,
    createdAt: new Date(
      `2026-04-${String(index + 10).padStart(2, "0")}T12:00:00.000Z`
    ),
    updatedAt: new Date(
      `2026-04-${String(index + 10).padStart(2, "0")}T12:00:00.000Z`
    )
  }));
}

function buildEmailVerificationTokens() {
  return users.map((user, index) => ({
    id: seedEntityId("email-verification", user.id),
    userId: user.id,
    otpHash: sha256(`otp:${user.email}`),
    expiresAt: new Date(
      `2026-04-${String(index + 11).padStart(2, "0")}T13:00:00.000Z`
    ),
    usedAt:
      user.emailVerifiedAt || index < 3
        ? new Date(
            `2026-04-${String(index + 10).padStart(2, "0")}T12:30:00.000Z`
          )
        : null,
    createdAt: new Date(
      `2026-04-${String(index + 10).padStart(2, "0")}T12:00:00.000Z`
    )
  }));
}

function buildPasswordResetTokens() {
  return users.map((user, index) => ({
    id: seedEntityId("password-reset", user.id),
    userId: user.id,
    tokenHash: sha256(`password-reset:${user.email}`),
    expiresAt: new Date(
      `2026-04-${String(index + 24).padStart(2, "0")}T15:00:00.000Z`
    ),
    usedAt:
      index === 1 || index === 3
        ? new Date(
            `2026-04-${String(index + 20).padStart(2, "0")}T09:00:00.000Z`
          )
        : null,
    createdAt: new Date(
      `2026-04-${String(index + 20).padStart(2, "0")}T08:00:00.000Z`
    )
  }));
}

function buildUserProfiles() {
  return users.map((user) => ({
    id: user.profile.id,
    userId: user.id,
    careerStatus: user.profile.careerStatus,
    latestRole: user.profile.latestRole,
    summary: user.profile.summary,
    profilePhotoStorageKey: user.profile.profilePhotoStorageKey,
    profilePhotoUrl: user.profile.profilePhotoUrl,
    profilePhotoMimeType: user.profile.profilePhotoMimeType,
    profilePhotoSizeBytes: user.profile.profilePhotoSizeBytes,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }));
}

function buildUserPreferences() {
  return users.map((user) => ({
    id: user.preference.id,
    userId: user.id,
    careerStatus: user.preference.careerStatus,
    jobSeekingStatus: user.preference.jobSeekingStatus,
    targetRoles: user.preference.targetRoles,
    locations: user.preference.locations,
    workTypes: user.preference.workTypes,
    salaryMin: user.preference.salaryMin,
    salaryMax: user.preference.salaryMax,
    salaryCurrency: user.preference.salaryCurrency,
    salaryPeriod: user.preference.salaryPeriod,
    emailNotificationsEnabled: user.preference.emailNotificationsEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  }));
}

function buildUserExperiences() {
  return users.flatMap((user) =>
    user.experiences.map((experience) => ({
      ...experience,
      userId: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  );
}

function buildUserEducations() {
  return users.flatMap((user) =>
    user.educations.map((education) => ({
      ...education,
      userId: user.id,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  );
}

function buildUserSkills(skillIdBySlug: Map<string, string>) {
  return users.flatMap((user) =>
    user.userSkillEntries.map((entry) => ({
      id: entry.id,
      userId: user.id,
      skillId: skillIdBySlug.get(entry.skillSlug) || "",
      level: entry.level,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    }))
  );
}

function buildJobRequirements() {
  return jobs.flatMap((job) =>
    job.requirements.map((requirement) => ({
      id: requirement.id,
      jobListingId: job.id,
      type: requirement.type,
      value: requirement.value,
      priority: requirement.priority,
      sortOrder: requirement.sortOrder,
      createdAt: job.lastSeenAt
    }))
  );
}

function buildJobSkills() {
  return jobs.flatMap((job) =>
    job.skillLinks.map((skillLink) => ({
      id: skillLink.id,
      jobListingId: job.id,
      skillId: skillLink.skillId,
      confidence: skillLink.confidence,
      createdAt: job.lastSeenAt
    }))
  );
}

type SeedDatasets = {
  authCredentials: ReturnType<typeof buildAuthCredentials>;
  refreshTokens: ReturnType<typeof buildRefreshTokens>;
  emailVerificationTokens: ReturnType<typeof buildEmailVerificationTokens>;
  passwordResetTokens: ReturnType<typeof buildPasswordResetTokens>;
  userProfiles: ReturnType<typeof buildUserProfiles>;
  userPreferences: ReturnType<typeof buildUserPreferences>;
  userExperiences: ReturnType<typeof buildUserExperiences>;
  userEducations: ReturnType<typeof buildUserEducations>;
  userSkills: ReturnType<typeof buildUserSkills>;
  jobRequirements: ReturnType<typeof buildJobRequirements>;
  jobSkills: ReturnType<typeof buildJobSkills>;
};

function buildSeedDatasets(
  passwordHashes: Record<string, string>
): SeedDatasets {
  const skillIdBySlug = new Map(skills.map((skill) => [skill.slug, skill.id]));

  return {
    authCredentials: buildAuthCredentials(passwordHashes),
    refreshTokens: buildRefreshTokens(),
    emailVerificationTokens: buildEmailVerificationTokens(),
    passwordResetTokens: buildPasswordResetTokens(),
    userProfiles: buildUserProfiles(),
    userPreferences: buildUserPreferences(),
    userExperiences: buildUserExperiences(),
    userEducations: buildUserEducations(),
    userSkills: buildUserSkills(skillIdBySlug),
    jobRequirements: buildJobRequirements(),
    jobSkills: buildJobSkills()
  };
}

async function cleanupExistingSeedData(datasets: SeedDatasets) {
  const seededUserIds = users.map((user) => user.id);
  const seededUserEmails = users.map((user) => user.email);
  const seededJobIds = jobs.map((job) => job.id);
  const seededJobExternalIds = jobs.map((job) => job.externalJobId);
  const seededCompanySlugs = companies.map((company) => company.slug);
  const seededSkillSlugs = skills.map((skill) => skill.slug);
  const seededSourceSlugs = sourcePlatforms.map(
    (sourcePlatform) => sourcePlatform.slug
  );
  const seededAuthIds = datasets.authCredentials.map((entry) => entry.id);
  const seededRefreshTokenIds = datasets.refreshTokens.map((entry) => entry.id);
  const seededEmailVerificationIds = datasets.emailVerificationTokens.map(
    (entry) => entry.id
  );
  const seededPasswordResetIds = datasets.passwordResetTokens.map(
    (entry) => entry.id
  );
  const seededProfileIds = datasets.userProfiles.map((entry) => entry.id);
  const seededPreferenceIds = datasets.userPreferences.map((entry) => entry.id);
  const seededExperienceIds = datasets.userExperiences.map((entry) => entry.id);
  const seededEducationIds = datasets.userEducations.map((entry) => entry.id);
  const seededUserSkillIds = datasets.userSkills.map((entry) => entry.id);
  const seededJobRequirementIds = datasets.jobRequirements.map(
    (entry) => entry.id
  );
  const seededJobSkillIds = datasets.jobSkills.map((entry) => entry.id);
  const seededBookmarkIds = bookmarks.map((entry) => entry.id);
  const seededApplicationIds = applicationRecords.map((entry) => entry.id);
  const seededApplicationHistoryIds = applicationHistories.map(
    (entry) => entry.id
  );
  const seededFitScoreIds = fitScoreResults.map((entry) => entry.id);
  const seededSkillGapIds = skillGapResults.map((entry) => entry.id);
  const seededCvFileIds = cvFileMetadata.map((entry) => entry.id);
  const seededCvAnalysisIds = cvAnalysisResults.map((entry) => entry.id);
  const seededAiLogIds = aiRequestLogs.map((entry) => entry.id);
  const seededAiRequestIds = aiRequestLogs.map((entry) => entry.requestId);

  await prisma.$transaction([
    prisma.aiRequestLog.deleteMany({
      where: {
        OR: [
          { id: { in: seededAiLogIds } },
          { requestId: { in: seededAiRequestIds } }
        ]
      }
    }),
    prisma.cvAnalysisResult.deleteMany({
      where: {
        OR: [
          { id: { in: seededCvAnalysisIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.cvFileMetadata.deleteMany({
      where: {
        OR: [{ id: { in: seededCvFileIds } }, { userId: { in: seededUserIds } }]
      }
    }),
    prisma.skillGapResult.deleteMany({
      where: {
        OR: [
          { id: { in: seededSkillGapIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.fitScoreResult.deleteMany({
      where: {
        OR: [
          { id: { in: seededFitScoreIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.applicationStatusHistory.deleteMany({
      where: {
        OR: [
          { id: { in: seededApplicationHistoryIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.applicationRecord.deleteMany({
      where: {
        OR: [
          { id: { in: seededApplicationIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.bookmark.deleteMany({
      where: {
        OR: [
          { id: { in: seededBookmarkIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.jobRequirement.deleteMany({
      where: {
        OR: [
          { id: { in: seededJobRequirementIds } },
          { jobListingId: { in: seededJobIds } },
          { jobListing: { externalJobId: { in: seededJobExternalIds } } }
        ]
      }
    }),
    prisma.jobSkill.deleteMany({
      where: {
        OR: [
          { id: { in: seededJobSkillIds } },
          { jobListingId: { in: seededJobIds } },
          { jobListing: { externalJobId: { in: seededJobExternalIds } } }
        ]
      }
    }),
    prisma.jobListing.deleteMany({
      where: {
        OR: [
          { id: { in: seededJobIds } },
          { externalJobId: { in: seededJobExternalIds } }
        ]
      }
    }),
    prisma.ingestionRun.deleteMany({
      where: {
        OR: [
          { id: { startsWith: "seed-ingestion-" } },
          { sourcePlatform: { slug: { in: seededSourceSlugs } } }
        ]
      }
    }),
    prisma.userPreference.deleteMany({
      where: {
        OR: [
          { id: { in: seededPreferenceIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.userSkill.deleteMany({
      where: {
        OR: [
          { id: { in: seededUserSkillIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.userEducation.deleteMany({
      where: {
        OR: [
          { id: { in: seededEducationIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.userExperience.deleteMany({
      where: {
        OR: [
          { id: { in: seededExperienceIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.userProfile.deleteMany({
      where: {
        OR: [
          { id: { in: seededProfileIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { id: { in: seededPasswordResetIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.emailVerificationToken.deleteMany({
      where: {
        OR: [
          { id: { in: seededEmailVerificationIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { id: { in: seededRefreshTokenIds } },
          { userId: { in: seededUserIds } }
        ]
      }
    }),
    prisma.authCredential.deleteMany({
      where: {
        OR: [{ id: { in: seededAuthIds } }, { userId: { in: seededUserIds } }]
      }
    }),
    prisma.user.deleteMany({
      where: {
        OR: [{ id: { in: seededUserIds } }, { email: { in: seededUserEmails } }]
      }
    }),
    prisma.company.deleteMany({
      where: {
        OR: [{ slug: { in: seededCompanySlugs } }]
      }
    }),
    prisma.skill.deleteMany({
      where: {
        OR: [{ slug: { in: seededSkillSlugs } }]
      }
    }),
    prisma.sourcePlatform.deleteMany({
      where: {
        OR: [{ slug: { in: seededSourceSlugs } }]
      }
    })
  ]);
}

async function main() {
  const passwordHashes = Object.fromEntries(
    await Promise.all(
      users.map(async (user) => [user.id, await hashPassword(seedUserPassword)])
    )
  );
  const datasets = buildSeedDatasets(passwordHashes);

  await cleanupExistingSeedData(datasets);

  await prisma.sourcePlatform.createMany({
    data: sourcePlatforms
  });

  await prisma.skill.createMany({
    data: skills
  });

  await prisma.company.createMany({
    data: companies
  });

  await prisma.ingestionRun.createMany({
    data: ingestionRuns
  });

  await prisma.user.createMany({
    data: users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      onboardingStatus: user.onboardingStatus,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      deletedAt: user.deletedAt
    }))
  });

  await prisma.authCredential.createMany({
    data: datasets.authCredentials
  });

  await prisma.refreshToken.createMany({
    data: datasets.refreshTokens
  });

  await prisma.emailVerificationToken.createMany({
    data: datasets.emailVerificationTokens
  });

  await prisma.passwordResetToken.createMany({
    data: datasets.passwordResetTokens
  });

  await prisma.userProfile.createMany({
    data: datasets.userProfiles
  });

  await prisma.userPreference.createMany({
    data: datasets.userPreferences
  });

  await prisma.userExperience.createMany({
    data: datasets.userExperiences
  });

  await prisma.userEducation.createMany({
    data: datasets.userEducations
  });

  await prisma.userSkill.createMany({
    data: datasets.userSkills
  });

  await prisma.jobListing.createMany({
    data: jobs.map((job) => ({
      id: job.id,
      sourcePlatformId: job.sourcePlatformId,
      companyId: job.companyId,
      ingestionRunId: job.ingestionRunId,
      externalJobId: job.externalJobId,
      title: job.title,
      normalizedTitle: job.normalizedTitle,
      category: job.category,
      description: job.description,
      requirementSummary: job.requirementSummary,
      workType: job.workType,
      employmentType: job.employmentType,
      experienceLevel: job.experienceLevel,
      locationDisplay: job.locationDisplay,
      province: job.province,
      city: job.city,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryPeriod: job.salaryPeriod,
      salaryDisplay: job.salaryDisplay,
      sourceUrl: job.sourceUrl,
      externalApplyUrl: job.externalApplyUrl,
      sourcePostedAt: job.sourcePostedAt,
      sourceUpdatedAt: job.sourceUpdatedAt,
      lastSeenAt: job.lastSeenAt,
      expiredAt: job.expiredAt,
      status: job.status
    }))
  });

  await prisma.jobRequirement.createMany({
    data: datasets.jobRequirements
  });

  await prisma.jobSkill.createMany({
    data: datasets.jobSkills
  });

  await prisma.bookmark.createMany({
    data: bookmarks
  });

  await prisma.applicationRecord.createMany({
    data: applicationRecords
  });

  await prisma.applicationStatusHistory.createMany({
    data: applicationHistories
  });

  await prisma.fitScoreResult.createMany({
    data: fitScoreResults
  });

  await prisma.skillGapResult.createMany({
    data: skillGapResults
  });

  await prisma.cvFileMetadata.createMany({
    data: cvFileMetadata
  });

  await prisma.cvAnalysisResult.createMany({
    data: cvAnalysisResults
  });

  await prisma.aiRequestLog.createMany({
    data: aiRequestLogs
  });

  const totalSeededRows = [
    sourcePlatforms.length,
    skills.length,
    companies.length,
    ingestionRuns.length,
    users.length,
    datasets.authCredentials.length,
    datasets.refreshTokens.length,
    datasets.emailVerificationTokens.length,
    datasets.passwordResetTokens.length,
    datasets.userProfiles.length,
    datasets.userPreferences.length,
    datasets.userExperiences.length,
    datasets.userEducations.length,
    datasets.userSkills.length,
    jobs.length,
    datasets.jobRequirements.length,
    datasets.jobSkills.length,
    bookmarks.length,
    applicationRecords.length,
    applicationHistories.length,
    fitScoreResults.length,
    skillGapResults.length,
    cvFileMetadata.length,
    cvAnalysisResults.length,
    aiRequestLogs.length
  ].reduce((sum, count) => sum + count, 0);

  console.info(
    `Seed complete: ${totalSeededRows} rows across 25 datasets. Seed user password: ${seedUserPassword}`
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  });
