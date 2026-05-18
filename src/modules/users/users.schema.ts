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
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(
    /^[a-z0-9_]+$/,
    "Username hanya boleh berisi huruf kecil, angka, dan underscore, contoh salman_123"
  )
  .transform((value) => value.toLowerCase());

const phoneNumberSchema = z
  .string()
  .trim()
  .min(8, "Nomor telepon minimal 8 digit")
  .max(20, "Nomor telepon maksimal 20 digit")
  .regex(
    /^\+?62[0-9]{7,16}$/,
    "Nomor telepon tidak valid. Gunakan nomor Indonesia, contoh +628123456789"
  );

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Nama tampilan wajib diisi")
  .max(80, "Nama tampilan maksimal 80 karakter");

export const updateCurrentUserSchema = z
  .strictObject({
    username: usernameSchema.optional(),
    phoneNumber: phoneNumberSchema.optional(),
    displayName: displayNameSchema.optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu data profil harus diisi"
  });

export const upsertProfilePhotoSchema = z.strictObject({
  storageKey: z
    .string()
    .trim()
    .min(1, "Storage key wajib diisi")
    .max(512, "Storage key maksimal 512 karakter")
    .regex(
      /^[A-Za-z0-9/_\-.]+$/,
      "Storage key hanya boleh berisi huruf, angka, garis miring, underscore, dash, dan titik"
    ),
  url: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z
        .url("URL foto profil tidak valid")
        .max(1024, "URL foto profil maksimal 1024 karakter")
    )
    .nullable()
    .optional(),
  mimeType: z.enum(allowedProfilePhotoMimeTypes),
  sizeBytes: z
    .int("Ukuran file harus berupa angka")
    .positive("Ukuran file harus lebih dari 0")
    .max(
      maxProfilePhotoBytes,
      `Ukuran file melebihi batas ${String(maxProfilePhotoBytes)} byte`
    )
});

const skillItemSchema = z.strictObject({
  name: z
    .string()
    .min(1, "Nama keahlian wajib diisi")
    .max(80, "Nama keahlian maksimal 80 karakter")
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
          message: "Nama keahlian tidak boleh duplikat dalam daftar yang sama"
        });
      }
      seen.add(slug);
    });
  });

const experienceItemSchema = z
  .strictObject({
    title: z
      .string()
      .min(1, "Jabatan pengalaman wajib diisi")
      .max(120, "Jabatan pengalaman maksimal 120 karakter")
      .transform((value) => normalizeWhitespace(value)),
    company: z
      .string()
      .trim()
      .min(1, "Nama perusahaan wajib diisi bila field ini dikirim")
      .max(120, "Nama perusahaan maksimal 120 karakter")
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
        `Deskripsi pengalaman maksimal ${String(maxExperienceDescriptionLength)} karakter`
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
          message:
            "Tanggal selesai harus lebih besar atau sama dengan tanggal mulai"
        });
      }
    }

    if (value.isCurrent && value.endDate) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message:
          "Tanggal selesai harus kosong saat status pengalaman masih aktif"
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
      .min(1, "Nama institusi wajib diisi")
      .max(160, "Nama institusi maksimal 160 karakter")
      .transform((value) => normalizeWhitespace(value)),
    degree: z
      .string()
      .min(1, "Gelar wajib diisi")
      .max(120, "Gelar maksimal 120 karakter")
      .transform((value) => normalizeWhitespace(value)),
    fieldOfStudy: z
      .string()
      .min(1, "Bidang studi wajib diisi")
      .max(160, "Bidang studi maksimal 160 karakter")
      .transform((value) => normalizeWhitespace(value)),
    startYear: z
      .int("Tahun mulai harus berupa angka")
      .min(1900, "Tahun mulai minimal 1900")
      .max(2100, "Tahun mulai maksimal 2100")
      .optional()
      .nullable(),
    endYear: z
      .int("Tahun selesai harus berupa angka")
      .min(1900, "Tahun selesai minimal 1900")
      .max(2100, "Tahun selesai maksimal 2100")
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
        message: "Tahun selesai harus lebih besar atau sama dengan tahun mulai"
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
