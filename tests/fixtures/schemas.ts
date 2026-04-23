import { z } from "zod";

import {
  cvAnalyzerModelResponseSchema,
  jobFitModelResponseSchema
} from "@/shared/integrations/model-api.schema";

export const userFixtureSchema = z.strictObject({
  id: z.string().min(1),
  email: z.email(),
  emailVerifiedAt: z.iso.datetime(),
  name: z.string().min(1),
  role: z.literal("USER")
});

export const sourcePlatformFixtureSchema = z.strictObject({
  id: z.string().min(1),
  slug: z.enum(["glints", "jobstreet", "kalibrr", "dealls"]),
  name: z.string().min(1)
});

export const jobFixtureSchema = z.strictObject({
  id: z.string().min(1),
  sourcePlatformId: z.string().min(1),
  externalJobId: z.string().min(1),
  companyName: z.string().min(1),
  title: z.string().min(1),
  city: z.string().min(1),
  province: z.string().min(1),
  workType: z.enum(["REMOTE", "HYBRID", "ONSITE"]),
  employmentType: z.enum(["FULL_TIME", "CONTRACT", "INTERNSHIP"]),
  sourceUrl: z.url(),
  discoveredAt: z.iso.datetime(),
  skills: z.array(z.string().min(1)).min(1)
});

export { cvAnalyzerModelResponseSchema, jobFitModelResponseSchema };
