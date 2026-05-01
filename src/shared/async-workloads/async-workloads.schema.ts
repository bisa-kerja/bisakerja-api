import { z } from "zod";

import { asyncJobTypes } from "@/shared/async-workloads/async-workloads.constants";
import type {
  AsyncJobPayloadMap,
  AsyncJobType
} from "@/shared/async-workloads/async-workloads.types";

const isoDateStringSchema = z.iso.datetime();

const authEmailVerificationJobPayloadSchema = z.object({
  email: z.email(),
  otp: z.string().regex(/^\d{6}$/),
  expiresAt: isoDateStringSchema
});

const authPasswordResetJobPayloadSchema = z.object({
  email: z.email(),
  token: z.string().min(1),
  expiresAt: isoDateStringSchema
});

const cvCleanupJobPayloadSchema = z.object({
  triggeredAt: isoDateStringSchema
});

const payloadSchemaMap = {
  "auth.email-verification": authEmailVerificationJobPayloadSchema,
  "auth.password-reset": authPasswordResetJobPayloadSchema,
  "maintenance.cv-cleanup": cvCleanupJobPayloadSchema
} satisfies Record<AsyncJobType, z.ZodType<AsyncJobPayloadMap[AsyncJobType]>>;

export const asyncJobTypeSchema = z.enum(asyncJobTypes);

export function parseAsyncJobPayload<TJobType extends AsyncJobType>(
  jobType: TJobType,
  payload: unknown
): AsyncJobPayloadMap[TJobType] {
  return payloadSchemaMap[jobType].parse(
    payload
  ) as AsyncJobPayloadMap[TJobType];
}
