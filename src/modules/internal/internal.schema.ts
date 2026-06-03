import { z } from "zod";

const requiredText = (name: string, max = 5000) =>
  z.string().trim().min(1, `${name} is required`).max(max);

const nullableText = (max = 5000) =>
  z.union([z.string().trim().min(1).max(max), z.null()]).optional();

const nullableDateTime = z
  .union([
    z
      .string()
      .trim()
      .min(1)
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: "ISO datetime format is invalid"
      }),
    z.null()
  ])
  .optional();

const sourcePlatformSchema = z.strictObject({
  slug: requiredText("sourcePlatform.slug", 80),
  name: requiredText("sourcePlatform.name", 120)
});

const companySchema = z.strictObject({
  name: requiredText("company.name", 180),
  sourceCompanyId: nullableText(120),
  sourceSlug: nullableText(120),
  logoUrl: nullableText(2000),
  websiteUrl: nullableText(2000),
  industry: nullableText(120)
});

const ingestionRunSchema = z
  .strictObject({
    sourceRunId: requiredText("ingestionRun.sourceRunId", 160)
  })
  .nullable()
  .optional();

const jobListingSchema = z
  .strictObject({
    externalJobId: requiredText("jobListing.externalJobId", 255),
    title: requiredText("jobListing.title", 255),
    normalizedTitle: nullableText(255),
    category: nullableText(120),
    description: nullableText(10_000),
    requirementSummary: nullableText(10_000),
    workType: z.enum(["REMOTE", "HYBRID", "ONSITE"]).nullable().optional(),
    employmentType: z
      .enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "FREELANCE"])
      .nullable()
      .optional(),
    experienceLevel: z
      .enum(["ENTRY_LEVEL", "JUNIOR", "MID_LEVEL", "SENIOR", "LEAD"])
      .nullable()
      .optional(),
    locationDisplay: nullableText(255),
    province: nullableText(120),
    city: nullableText(120),
    salaryMin: z.number().int().nonnegative().nullable().optional(),
    salaryMax: z.number().int().nonnegative().nullable().optional(),
    salaryCurrency: requiredText("jobListing.salaryCurrency", 3),
    salaryPeriod: z.enum(["MONTHLY", "YEARLY"]).nullable().optional(),
    salaryDisplay: nullableText(255),
    sourceUrl: requiredText("jobListing.sourceUrl", 2000),
    externalApplyUrl: requiredText("jobListing.externalApplyUrl", 2000),
    sourcePostedAt: nullableDateTime,
    sourceUpdatedAt: nullableDateTime,
    lastSeenAt: requiredText("jobListing.lastSeenAt", 80).refine(
      (value) => !Number.isNaN(Date.parse(value)),
      { message: "ISO datetime format is invalid" }
    ),
    status: z
      .enum(["ACTIVE", "STALE", "EXPIRED", "CLOSED", "HIDDEN"])
      .default("ACTIVE")
  })
  .superRefine((value, context) => {
    if (
      value.salaryMin !== undefined &&
      value.salaryMin !== null &&
      value.salaryMax !== undefined &&
      value.salaryMax !== null &&
      value.salaryMin > value.salaryMax
    ) {
      context.addIssue({
        code: "custom",
        path: ["salaryMax"],
        message: "salaryMax must be greater than or equal to salaryMin"
      });
    }
  });

const requirementSchema = z.strictObject({
  type: z.enum(["SKILL", "EXPERIENCE", "EDUCATION", "RESPONSIBILITY", "OTHER"]),
  value: requiredText("requirements.value", 2000),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  source: nullableText(80)
});

const skillSchema = z.strictObject({
  name: requiredText("skills.name", 120),
  confidence: z.number().min(0).max(1).nullable().optional(),
  source: nullableText(80)
});

export const scraperJobSyncSchema = z.strictObject({
  sourcePlatform: sourcePlatformSchema,
  company: companySchema,
  ingestionRun: ingestionRunSchema,
  jobListing: jobListingSchema,
  requirements: z.array(requirementSchema).max(100).default([]),
  skills: z.array(skillSchema).max(100).default([])
});

export const scraperJobsSyncSchema = z.strictObject({
  jobs: z.array(scraperJobSyncSchema).min(1).max(100)
});

export const notificationEventsSchema = z.strictObject({
  runId: requiredText("runId", 160),
  candidates: z
    .array(
      z.strictObject({
        eventId: requiredText("eventId", 255),
        syncEventId: requiredText("syncEventId", 80),
        sourcePlatform: requiredText("sourcePlatform", 80),
        externalJobId: requiredText("externalJobId", 255),
        title: requiredText("title", 255),
        companyName: requiredText("companyName", 180),
        sourceUrl: requiredText("sourceUrl", 2000),
        location: z.record(z.string(), z.unknown()).optional(),
        salary: z.record(z.string(), z.unknown()).nullable().optional(),
        status: requiredText("status", 40),
        lastSeenAt: requiredText("lastSeenAt", 80).refine(
          (value) => !Number.isNaN(Date.parse(value)),
          { message: "ISO datetime format is invalid" }
        )
      })
    )
    .max(1000)
});

export type ScraperJobsSyncInput = z.infer<typeof scraperJobsSyncSchema>;
export type ScraperJobSyncInput = z.infer<typeof scraperJobSyncSchema>;
export type NotificationEventsInput = z.infer<typeof notificationEventsSchema>;
