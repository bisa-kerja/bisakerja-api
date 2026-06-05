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
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Username may only contain lowercase letters, numbers, and underscores, for example salman_123"
  )
  .transform((value) => value.toLowerCase());

const phoneNumberSchema = z
  .string()
  .trim()
  .min(8, "Phone number must be at least 8 digits")
  .max(20, "Phone number must be at most 20 digits")
  .regex(
    /^\+?62[0-9]{7,16}$/,
    "Phone number is invalid. Use an Indonesian phone number, for example +628123456789"
  );

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required")
  .max(80, "Display name must be at most 80 characters");

export const updateCurrentUserSchema = z
  .strictObject({
    username: usernameSchema.optional(),
    phoneNumber: phoneNumberSchema.optional(),
    displayName: displayNameSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one profile field must be provided"
  });

export const upsertProfilePhotoSchema = z.strictObject({
  storageKey: z
    .string()
    .trim()
    .min(1, "Storage key is required")
    .max(512, "Storage key must be at most 512 characters")
    .regex(
      /^[A-Za-z0-9/_\-.]+$/,
      "Storage key may only contain letters, numbers, slashes, underscores, dashes, and dots"
    ),
  url: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z
        .url("Profile photo URL is invalid")
        .max(1024, "Profile photo URL must be at most 1024 characters")
    )
    .nullable()
    .optional(),
  mimeType: z.enum(allowedProfilePhotoMimeTypes),
  sizeBytes: z
    .int("File size must be an integer")
    .positive("File size must be greater than 0")
    .max(
      maxProfilePhotoBytes,
      `File size exceeds limit ${String(maxProfilePhotoBytes)} bytes`
    )
});

const skillItemSchema = z.strictObject({
  name: z
    .string()
    .min(1, "Skill name is required")
    .max(80, "Skill name must be at most 80 characters")
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
          message: "Skill names must not be duplicated in the same list"
        });
      }
      seen.add(slug);
    });
  });

const experienceItemSchema = z
  .strictObject({
    title: z
      .string()
      .min(1, "Experience title is required")
      .max(120, "Experience title must be at most 120 characters")
      .transform((value) => normalizeWhitespace(value)),
    company: z
      .string()
      .trim()
      .min(1, "Company name is required when this field is provided")
      .max(120, "Company name must be at most 120 characters")
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
      .max(
        maxExperienceDescriptionLength,
        `Experience description must be at most ${String(maxExperienceDescriptionLength)} characters`
      )
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
          message: "End date must be greater than or equal to start date"
        });
      }
    }

    if (value.isCurrent && value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "End date must be empty when the experience is still active"
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
      .min(1, "Institution name is required")
      .max(160, "Institution name must be at most 160 characters")
      .transform((value) => normalizeWhitespace(value)),
    degree: z
      .string()
      .min(1, "Degree is required")
      .max(120, "Degree must be at most 120 characters")
      .transform((value) => normalizeWhitespace(value)),
    fieldOfStudy: z
      .string()
      .min(1, "Field of study is required")
      .max(160, "Field of study must be at most 160 characters")
      .transform((value) => normalizeWhitespace(value)),
    startYear: z
      .int("Start year must be an integer")
      .min(1900, "Start year must be at least 1900")
      .max(2100, "Start year must be at most 2100")
      .optional()
      .nullable(),
    endYear: z
      .int("End year must be an integer")
      .min(1900, "End year must be at least 1900")
      .max(2100, "End year must be at most 2100")
      .optional()
      .nullable()
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
        message: "End year must be greater than or equal to start year"
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
