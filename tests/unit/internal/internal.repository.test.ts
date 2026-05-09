import { describe, expect, test } from "bun:test";

import { PrismaInternalRepository } from "@/modules/internal/internal.repository";
import type { ScraperJobsSyncInput } from "@/modules/internal/internal.schema";

describe("PrismaInternalRepository", () => {
  test("batches unique skills globally and uses transaction timeout override", async () => {
    const observed = {
      transactionOptions: null as { timeout?: number } | null,
      skillCreateManyCalls: [] as { data: { slug: string; name: string }[] }[],
      jobSkillCreateManyCalls: [] as {
        data: {
          jobListingId: string;
          skillId: string;
          confidence: number | null;
        }[];
      }[]
    };
    const listingIds = ["job-listing-1", "job-listing-2"];
    let listingCursor = 0;

    const tx = {
      sourcePlatform: {
        upsert: () => Promise.resolve({ id: "source-1" })
      },
      company: {
        findFirst: () => Promise.resolve(null),
        create: () => Promise.resolve({ id: "company-1" }),
        update: () => Promise.resolve({ id: "company-1" })
      },
      ingestionRun: {
        upsert: () => Promise.resolve({})
      },
      jobListing: {
        findFirst: () => Promise.resolve(null),
        create: () => Promise.resolve({ id: listingIds[listingCursor++] }),
        update: () => Promise.resolve({ id: listingIds[listingCursor++] })
      },
      jobRequirement: {
        deleteMany: () => Promise.resolve({ count: 0 }),
        createMany: () => Promise.resolve({ count: 0 })
      },
      skill: {
        createMany: (args: {
          data: { slug: string; name: string }[];
          skipDuplicates: boolean;
        }) => {
          observed.skillCreateManyCalls.push({ data: args.data });
          return Promise.resolve({ count: args.data.length });
        },
        findMany: (args: {
          where: { slug: { in: string[] } };
          select: { id: true; slug: true };
        }) => {
          void args.select;
          return Promise.resolve(
            args.where.slug.in.map((slug) => ({ id: `skill-${slug}`, slug }))
          );
        }
      },
      jobSkill: {
        deleteMany: () => Promise.resolve({ count: 0 }),
        createMany: (args: {
          data: {
            jobListingId: string;
            skillId: string;
            confidence: number | null;
          }[];
        }) => {
          observed.jobSkillCreateManyCalls.push(args);
          return Promise.resolve({ count: args.data.length });
        }
      }
    };

    const client = {
      $transaction: async <T>(
        callback: (transaction: typeof tx) => Promise<T>,
        options?: { timeout?: number }
      ) => {
        observed.transactionOptions = options ?? null;
        return callback(tx);
      }
    };
    const repository = new PrismaInternalRepository(client as never);

    const result = await repository.syncScraperJobs(syncPayload());

    expect(observed.transactionOptions?.timeout).toBe(30000);
    expect(observed.skillCreateManyCalls).toHaveLength(1);
    expect(observed.skillCreateManyCalls[0]?.data).toEqual([
      { slug: "typescript", name: "TypeScript" },
      { slug: "react", name: "React" },
      { slug: "node-js", name: "Node.js" }
    ]);
    expect(observed.jobSkillCreateManyCalls).toEqual([
      {
        data: [
          {
            jobListingId: "job-listing-1",
            skillId: "skill-typescript",
            confidence: 0.9
          },
          {
            jobListingId: "job-listing-1",
            skillId: "skill-react",
            confidence: 0.8
          }
        ]
      },
      {
        data: [
          {
            jobListingId: "job-listing-2",
            skillId: "skill-typescript",
            confidence: 0.7
          },
          {
            jobListingId: "job-listing-2",
            skillId: "skill-node-js",
            confidence: null
          }
        ]
      }
    ]);
    expect(result).toMatchObject({
      accepted: 2,
      upserted: 2
    });
  });

  test("splits large sync payload into transaction chunks", async () => {
    const observed = {
      transactionOptions: [] as { timeout?: number }[],
      chunkSizes: [] as number[]
    };
    let listingCursor = 0;

    const client = {
      $transaction: async <T>(
        callback: (transaction: {
          sourcePlatform: { upsert: () => Promise<{ id: string }> };
          company: {
            findFirst: () => Promise<null>;
            create: () => Promise<{ id: string }>;
            update: () => Promise<{ id: string }>;
          };
          ingestionRun: { upsert: () => Promise<object> };
          jobListing: {
            findFirst: () => Promise<null>;
            create: () => Promise<{ id: string }>;
            update: () => Promise<{ id: string }>;
          };
          jobRequirement: {
            deleteMany: () => Promise<{ count: number }>;
            createMany: () => Promise<{ count: number }>;
          };
          jobSkill: {
            deleteMany: () => Promise<{ count: number }>;
            createMany: () => Promise<{ count: number }>;
          };
        }) => Promise<T>,
        options?: { timeout?: number }
      ) => {
        observed.transactionOptions.push(options ?? {});
        let chunkSize = 0;
        const tx = {
          sourcePlatform: {
            upsert: () => Promise.resolve({ id: "source-1" })
          },
          company: {
            findFirst: () => Promise.resolve(null),
            create: () => Promise.resolve({ id: "company-1" }),
            update: () => Promise.resolve({ id: "company-1" })
          },
          ingestionRun: {
            upsert: () => Promise.resolve({})
          },
          jobListing: {
            findFirst: () => Promise.resolve(null),
            create: () => {
              chunkSize += 1;
              listingCursor += 1;
              return Promise.resolve({ id: `job-listing-${listingCursor}` });
            },
            update: () => Promise.resolve({ id: "job-listing-existing" })
          },
          jobRequirement: {
            deleteMany: () => Promise.resolve({ count: 0 }),
            createMany: () => Promise.resolve({ count: 0 })
          },
          jobSkill: {
            deleteMany: () => Promise.resolve({ count: 0 }),
            createMany: () => Promise.resolve({ count: 0 })
          }
        };
        const result = await callback(tx);
        observed.chunkSizes.push(chunkSize);
        return result;
      }
    };
    const repository = new PrismaInternalRepository(client as never);

    const result = await repository.syncScraperJobs(buildLargeSyncPayload(45));

    expect(observed.chunkSizes).toEqual([20, 20, 5]);
    expect(observed.transactionOptions).toEqual([
      { timeout: 30000 },
      { timeout: 30000 },
      { timeout: 30000 }
    ]);
    expect(result).toMatchObject({
      accepted: 45,
      upserted: 45
    });
  });
});

function syncPayload(): ScraperJobsSyncInput {
  return {
    jobs: [
      {
        sourcePlatform: { slug: "glints", name: "Glints" },
        company: {
          name: "Nusantara Tech",
          sourceCompanyId: null,
          sourceSlug: "nusantara-tech",
          logoUrl: null,
          websiteUrl: "https://company-1.example.test",
          industry: null
        },
        ingestionRun: { sourceRunId: "run-1" },
        jobListing: {
          externalJobId: "scraper-job-1",
          title: "Backend Developer",
          normalizedTitle: "backend developer",
          category: "Engineering",
          description: "Build APIs.",
          requirementSummary: "TypeScript",
          workType: "REMOTE",
          employmentType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          locationDisplay: "Jakarta Selatan",
          province: "DKI Jakarta",
          city: "Jakarta Selatan",
          salaryMin: 5_000_000,
          salaryMax: 10_000_000,
          salaryCurrency: "IDR",
          salaryPeriod: "MONTHLY",
          salaryDisplay: "Rp5.000.000 - Rp10.000.000 / bulan",
          sourceUrl: "https://glints.example/job-1",
          externalApplyUrl: "https://glints.example/apply-1",
          sourcePostedAt: "2026-04-20T00:00:00.000Z",
          sourceUpdatedAt: null,
          lastSeenAt: "2026-05-05T00:00:00.000Z",
          status: "ACTIVE"
        },
        requirements: [],
        skills: [
          { name: "TypeScript", confidence: 0.9, source: "ai" },
          { name: "TypeScript", confidence: 0.5, source: "ai" },
          { name: "React", confidence: 0.8, source: "ai" }
        ]
      },
      {
        sourcePlatform: { slug: "glints", name: "Glints" },
        company: {
          name: "Nusantara Tech",
          sourceCompanyId: null,
          sourceSlug: "nusantara-tech",
          logoUrl: null,
          websiteUrl: "https://company-1.example.test",
          industry: null
        },
        ingestionRun: { sourceRunId: "run-1" },
        jobListing: {
          externalJobId: "scraper-job-2",
          title: "Platform Engineer",
          normalizedTitle: "platform engineer",
          category: "Engineering",
          description: "Build platform systems.",
          requirementSummary: "Node.js",
          workType: "HYBRID",
          employmentType: "FULL_TIME",
          experienceLevel: "MID_LEVEL",
          locationDisplay: "Jakarta Barat",
          province: "DKI Jakarta",
          city: "Jakarta Barat",
          salaryMin: 7_000_000,
          salaryMax: 14_000_000,
          salaryCurrency: "IDR",
          salaryPeriod: "MONTHLY",
          salaryDisplay: "Rp7.000.000 - Rp14.000.000 / bulan",
          sourceUrl: "https://glints.example/job-2",
          externalApplyUrl: "https://glints.example/apply-2",
          sourcePostedAt: "2026-04-21T00:00:00.000Z",
          sourceUpdatedAt: null,
          lastSeenAt: "2026-05-05T00:00:00.000Z",
          status: "ACTIVE"
        },
        requirements: [],
        skills: [
          { name: "TypeScript", confidence: 0.7, source: "ai" },
          { name: "Node.js", confidence: null, source: "ai" }
        ]
      }
    ]
  };
}

function buildLargeSyncPayload(total: number): ScraperJobsSyncInput {
  const template = syncPayload().jobs[0]!;
  return {
    jobs: Array.from({ length: total }, (_, index) => ({
      ...template,
      sourcePlatform: { ...template.sourcePlatform },
      company: { ...template.company },
      ingestionRun: template.ingestionRun
        ? { ...template.ingestionRun }
        : undefined,
      jobListing: {
        ...template.jobListing,
        externalJobId: `scraper-job-${index + 1}`,
        sourceUrl: `https://glints.example/job-${index + 1}`,
        externalApplyUrl: `https://glints.example/apply-${index + 1}`
      },
      requirements: [],
      skills: []
    }))
  };
}
