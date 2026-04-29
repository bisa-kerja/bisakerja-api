import { describe, expect, test } from "bun:test";

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
  users
} from "../../../prisma/seed-data";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/;

function expectUuid(value: string, label: string) {
  expect(value, `${label} must be a deterministic UUID`).toMatch(uuidPattern);
}

function expectUniqueIds(values: string[], label: string) {
  expect(new Set(values).size, `${label} IDs must be unique`).toBe(
    values.length
  );
}

describe("seed data fixtures", () => {
  test("uses UUID primary keys across all seeded models", () => {
    const datasetIds = [
      ...sourcePlatforms.map((entry) => entry.id),
      ...skills.map((entry) => entry.id),
      ...companies.map((entry) => entry.id),
      ...ingestionRuns.map((entry) => entry.id),
      ...jobs.map((entry) => entry.id),
      ...jobs.flatMap((entry) => entry.requirements.map((item) => item.id)),
      ...jobs.flatMap((entry) => entry.skillLinks.map((item) => item.id)),
      ...users.map((entry) => entry.id),
      ...users.map((entry) => entry.profile.id),
      ...users.map((entry) => entry.preference.id),
      ...users.flatMap((entry) => entry.experiences.map((item) => item.id)),
      ...users.flatMap((entry) => entry.educations.map((item) => item.id)),
      ...users.flatMap((entry) =>
        entry.userSkillEntries.map((item) => item.id)
      ),
      ...bookmarks.map((entry) => entry.id),
      ...applicationRecords.map((entry) => entry.id),
      ...applicationHistories.map((entry) => entry.id),
      ...fitScoreResults.map((entry) => entry.id),
      ...skillGapResults.map((entry) => entry.id),
      ...cvFileMetadata.map((entry) => entry.id),
      ...cvAnalysisResults.map((entry) => entry.id),
      ...aiRequestLogs.map((entry) => entry.id)
    ];

    expectUniqueIds(datasetIds, "Seed fixture");

    for (const [index, id] of datasetIds.entries()) {
      expectUuid(id, `seed record ${String(index + 1)}`);
    }
  });

  test("keeps foreign key references aligned with parent datasets", () => {
    const userIds = new Set(users.map((entry) => entry.id));
    const jobIds = new Set(jobs.map((entry) => entry.id));
    const companyIds = new Set(companies.map((entry) => entry.id));
    const sourcePlatformIds = new Set(sourcePlatforms.map((entry) => entry.id));
    const ingestionRunIds = new Set(ingestionRuns.map((entry) => entry.id));
    const applicationIds = new Set(applicationRecords.map((entry) => entry.id));
    const cvFileIds = new Set(cvFileMetadata.map((entry) => entry.id));
    const skillIds = new Set(skills.map((entry) => entry.id));
    const skillSlugs = new Set(skills.map((entry) => entry.slug));

    for (const job of jobs) {
      expect(sourcePlatformIds.has(job.sourcePlatformId)).toBe(true);
      expect(companyIds.has(job.companyId)).toBe(true);
      expect(ingestionRunIds.has(job.ingestionRunId)).toBe(true);

      for (const requirement of job.requirements) {
        expectUuid(requirement.id, `job requirement ${job.externalJobId}`);
      }

      for (const skillLink of job.skillLinks) {
        expectUuid(skillLink.id, `job skill ${job.externalJobId}`);
        expect(skillIds.has(skillLink.skillId)).toBe(true);
      }
    }

    for (const user of users) {
      expectUuid(user.profile.id, `${user.email} profile`);
      expectUuid(user.preference.id, `${user.email} preference`);

      for (const experience of user.experiences) {
        expectUuid(experience.id, `${user.email} experience`);
      }

      for (const education of user.educations) {
        expectUuid(education.id, `${user.email} education`);
      }

      for (const userSkill of user.userSkillEntries) {
        expectUuid(userSkill.id, `${user.email} user skill`);
        expect(skillSlugs.has(userSkill.skillSlug)).toBe(true);
      }
    }

    for (const bookmark of bookmarks) {
      expect(userIds.has(bookmark.userId)).toBe(true);
      expect(jobIds.has(bookmark.jobListingId)).toBe(true);
    }

    for (const application of applicationRecords) {
      expect(userIds.has(application.userId)).toBe(true);
      expect(jobIds.has(application.jobListingId)).toBe(true);
    }

    for (const history of applicationHistories) {
      expect(applicationIds.has(history.applicationRecordId)).toBe(true);
      expect(userIds.has(history.userId)).toBe(true);
    }

    for (const result of fitScoreResults) {
      expect(userIds.has(result.userId)).toBe(true);
      expect(jobIds.has(result.jobListingId)).toBe(true);
    }

    for (const result of skillGapResults) {
      expect(userIds.has(result.userId)).toBe(true);
      expect(jobIds.has(result.jobListingId)).toBe(true);
    }

    for (const file of cvFileMetadata) {
      expect(userIds.has(file.userId)).toBe(true);
    }

    for (const result of cvAnalysisResults) {
      expect(userIds.has(result.userId)).toBe(true);
      expect(jobIds.has(result.jobListingId)).toBe(true);
      expect(cvFileIds.has(result.cvFileMetadataId)).toBe(true);
    }

    for (const log of aiRequestLogs) {
      expectUuid(log.id, `ai log ${log.requestId}`);

      if (log.userId) {
        expect(userIds.has(log.userId)).toBe(true);
      }
    }
  });
});
