import { describe, expect, test } from "bun:test";

import {
  replaceEducationSchema,
  replaceExperienceSchema,
  replaceSkillsSchema,
  updateCurrentUserSchema,
  upsertProfilePhotoSchema
} from "@/modules/users/users.schema";

describe("users schemas", () => {
  test("normalizes current user updates and rejects empty or unknown fields", () => {
    const parsed = updateCurrentUserSchema.parse({
      username: " salman_123 ",
      phoneNumber: "+6281234567890",
      displayName: "  Salman Abdurrahman  "
    });

    expect(parsed).toEqual({
      username: "salman_123",
      phoneNumber: "+6281234567890",
      displayName: "Salman Abdurrahman"
    });
    const empty = updateCurrentUserSchema.safeParse({});
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe(
      "At least one profile field must be provided"
    );
    expect(
      updateCurrentUserSchema.safeParse({
        email: "salman@example.com"
      }).success
    ).toBe(false);
  });

  test("validates profile photo metadata only", () => {
    expect(
      upsertProfilePhotoSchema.safeParse({
        storageKey: "profile-photos/user-1/avatar.webp",
        url: "https://cdn.example.com/profile-photos/user-1/avatar.webp",
        mimeType: "image/webp",
        sizeBytes: 4096
      }).success
    ).toBe(true);
    const invalidMime = upsertProfilePhotoSchema.safeParse({
      storageKey: "profile-photos/user-1/avatar.gif",
      mimeType: "image/gif",
      sizeBytes: 4096
    });
    expect(invalidMime.success).toBe(false);
    expect(
      upsertProfilePhotoSchema.safeParse({
        storageKey: "profile photos/avatar.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 4096
      }).success
    ).toBe(false);
    const invalidUrl = upsertProfilePhotoSchema.safeParse({
      storageKey: "profile-photos/user-1/avatar.jpg",
      url: "not-a-url",
      mimeType: "image/jpeg",
      sizeBytes: 4096
    });
    expect(invalidUrl.success).toBe(false);
    expect(invalidUrl.error?.issues[0]?.message).toBe(
      "Profile photo URL is invalid"
    );
  });

  test("rejects duplicate skill names after normalization", () => {
    const duplicate = replaceSkillsSchema.safeParse({
      skills: [
        { name: " TypeScript ", level: "INTERMEDIATE" },
        { name: "typescript", level: "ADVANCED" }
      ]
    });

    expect(duplicate.success).toBe(false);
    expect(
      replaceSkillsSchema.parse({
        skills: [
          { name: "TypeScript", level: "INTERMEDIATE" },
          { name: "PostgreSQL" }
        ]
      }).skills
    ).toEqual([
      { name: "TypeScript", level: "INTERMEDIATE" },
      { name: "PostgreSQL" }
    ]);
  });

  test("validates experience date range and current role rules", () => {
    expect(
      replaceExperienceSchema.safeParse({
        experience: [
          {
            title: "Backend Developer",
            startDate: "2026-01-01",
            endDate: "2025-01-01"
          }
        ]
      }).success
    ).toBe(false);
    expect(
      replaceExperienceSchema.safeParse({
        experience: [
          {
            title: "Backend Developer",
            endDate: "2026-01-01",
            isCurrent: true
          }
        ]
      }).success
    ).toBe(false);
    expect(
      replaceExperienceSchema.parse({
        experience: [
          {
            title: " Backend Developer ",
            company: " Example Tech ",
            employmentType: "INTERNSHIP",
            startDate: "2025-01-01",
            endDate: "2025-06-30",
            description: "Built APIs."
          }
        ]
      }).experience[0]
    ).toMatchObject({
      title: "Backend Developer",
      company: "Example Tech",
      isCurrent: false
    });
  });

  test("validates education required fields and year range", () => {
    expect(
      replaceEducationSchema.safeParse({
        education: [
          {
            institution: "Universitas Contoh",
            fieldOfStudy: "Informatics"
          }
        ]
      }).success
    ).toBe(false);
    expect(
      replaceEducationSchema.safeParse({
        education: [
          {
            institution: "Universitas Contoh",
            degree: "Bachelor",
            fieldOfStudy: "Informatics",
            startYear: 2025,
            endYear: 2021
          }
        ]
      }).success
    ).toBe(false);
    expect(
      replaceEducationSchema.parse({
        education: [
          {
            institution: " Universitas Contoh ",
            degree: " Bachelor ",
            fieldOfStudy: " Informatics ",
            startYear: 2021,
            endYear: 2025
          }
        ]
      }).education[0]
    ).toEqual({
      institution: "Universitas Contoh",
      degree: "Bachelor",
      fieldOfStudy: "Informatics",
      startYear: 2021,
      endYear: 2025
    });
  });
});
