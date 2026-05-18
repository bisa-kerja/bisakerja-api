import { z } from "zod";

import { asyncJobTypes } from "@/shared/async-workloads/async-workloads.constants";
import type {
  AsyncJobPayloadMap,
  AsyncJobType
} from "@/shared/async-workloads/async-workloads.types";

const isoDateStringSchema = z.iso.datetime("Format waktu harus ISO 8601");

const authEmailVerificationJobPayloadSchema = z.object({
  email: z.email("Email tidak valid"),
  otp: z.string().regex(/^\d{6}$/, "OTP harus 6 digit angka"),
  expiresAt: isoDateStringSchema
});

const authPasswordResetJobPayloadSchema = z.object({
  email: z.email("Email tidak valid"),
  token: z.string().min(1, "Token reset kata sandi wajib diisi"),
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
