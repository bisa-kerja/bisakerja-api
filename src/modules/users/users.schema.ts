import { z } from "zod";

import {
  allowedProfilePhotoMimeTypes,
  maxExperienceDescriptionLength,
  maxProfilePhotoBytes
} from "@/modules/users/users.constants";
import { toSkillSlug } from "@/modules/users/users.utils";
import { normalizeWhitespace } from "@/shared/utils/text";

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(
    /^[a-z0-9_]+$/,
    "Username may contain lowercase letters, numbers, and underscores"
  )
  .transform((value) => value.toLowerCase());

const phoneNumberSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .regex(/^\+?62[0-9]{7,16}$/, "Phone number must be an Indonesian number");

const displayNameSchema = z.string().trim().min(1).max(80);

export const updateCurrentUserSchema = z
  .strictObject({
    username: usernameSchema.optional(),
    phoneNumber: phoneNumberSchema.optional(),
    displayName: displayNameSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  });

export const upsertProfilePhotoSchema = z.strictObject({
  storageKey: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .regex(
      /^[A-Za-z0-9/_\-.]+$/,
      "Storage key may only contain letters, numbers, slash, underscore, dash, and dot"
    ),
  url: z.url().max(1024).nullable().optional(),
  mimeType: z.enum(allowedProfilePhotoMimeTypes),
  sizeBytes: z.int().positive().max(maxProfilePhotoBytes)
});

const skillItemSchema = z.strictObject({
  name: z
    .string()
    .min(1)
    .max(80)
    .transform((value) => normalizeWhitespace(value)),
  level: z.enum(["BASIC", "INTERMEDIATE", "ADVANCED"]).optional()
});

export const replaceSkillsSchema = z
  .strictObject({
    skills: z.array(skillItemSchema).max(100)
  })
  .superRefine((value, context) => {
    const seen = new Set<string>();

    value.skills.forEach((skill, index) => {
      const slug = toSkillSlug(skill.name);
      if (seen.has(slug)) {
        context.addIssue({
          code: "custom",
          path: ["skills", index, "name"],
          message: "Duplicate skill names are not allowed"
        });
      }
      seen.add(slug);
    });
  });

const experienceItemSchema = z
  .strictObject({
    title: z
      .string()
      .min(1)
      .max(120)
      .transform((value) => normalizeWhitespace(value)),
    company: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .optional()
      .nullable()
      .transform((value) => (value ? normalizeWhitespace(value) : null)),
    employmentType: z
      .enum(["FULL_TIME", "PART_TIME", "INTERNSHIP", "CONTRACT", "FREELANCE"])
      .optional()
      .nullable(),
    startDate: z.iso.date().optional().nullable(),
    endDate: z.iso.date().optional().nullable(),
    isCurrent: z.boolean().optional().default(false),
    description: z
      .string()
      .trim()
      .max(maxExperienceDescriptionLength)
      .optional()
      .transform((value) => value ?? null)
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate) {
      const start = new Date(value.startDate);
      const end = new Date(value.endDate);
      if (end < start) {
        context.addIssue({
          code: "custom",
          path: ["endDate"],
          message: "endDate must be greater than or equal to startDate"
        });
      }
    }

    if (value.isCurrent && value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must be empty when isCurrent is true"
      });
    }
  });

export const replaceExperienceSchema = z.strictObject({
  experience: z.array(experienceItemSchema).max(100)
});

const educationItemSchema = z
  .strictObject({
    institution: z
      .string()
      .min(1)
      .max(160)
      .transform((value) => normalizeWhitespace(value)),
    degree: z
      .string()
      .min(1)
      .max(120)
      .transform((value) => normalizeWhitespace(value)),
    fieldOfStudy: z
      .string()
      .min(1)
      .max(160)
      .transform((value) => normalizeWhitespace(value)),
    startYear: z.int().min(1900).max(2100).optional().nullable(),
    endYear: z.int().min(1900).max(2100).optional().nullable()
  })
  .superRefine((value, context) => {
    if (
      typeof value.startYear === "number" &&
      typeof value.endYear === "number" &&
      value.endYear < value.startYear
    ) {
      context.addIssue({
        code: "custom",
        path: ["endYear"],
        message: "endYear must be greater than or equal to startYear"
      });
    }
  });

export const replaceEducationSchema = z.strictObject({
  education: z.array(educationItemSchema).max(100)
});

export type UpdateCurrentUserInput = z.infer<typeof updateCurrentUserSchema>;
export type UpsertProfilePhotoInput = z.infer<typeof upsertProfilePhotoSchema>;
export type ReplaceSkillsInput = z.infer<typeof replaceSkillsSchema>;
export type ReplaceExperienceInput = z.infer<typeof replaceExperienceSchema>;
export type ReplaceEducationInput = z.infer<typeof replaceEducationSchema>;
