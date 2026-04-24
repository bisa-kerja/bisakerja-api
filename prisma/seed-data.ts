import { createHash } from "node:crypto";

export type SeedUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  phoneNumber: string;
  status: "ACTIVE" | "DISABLED";
  emailVerifiedAt: Date | null;
  onboardingStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  profile: {
    id: string;
    careerStatus: "FRESH_GRADUATE" | "EARLY_CAREER" | "CAREER_SWITCHER";
    latestRole: string;
    summary: string;
    profilePhotoStorageKey: string | null;
    profilePhotoUrl: string | null;
    profilePhotoMimeType: string | null;
    profilePhotoSizeBytes: number | null;
  };
  preference: {
    id: string;
    careerStatus: "FRESH_GRADUATE" | "EARLY_CAREER" | "CAREER_SWITCHER";
    jobSeekingStatus: "IMMEDIATE" | "ONE_MONTH" | "THREE_MONTHS";
    targetRoles: string[];
    locations: Array<{ province: string; city: string | null }>;
    workTypes: Array<"REMOTE" | "HYBRID" | "ONSITE">;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string;
    salaryPeriod: "MONTHLY" | "YEARLY";
    emailNotificationsEnabled: boolean;
  };
  experiences: Array<{
    id: string;
    title: string;
    company: string | null;
    employmentType:
      | "FULL_TIME"
      | "PART_TIME"
      | "INTERNSHIP"
      | "CONTRACT"
      | "FREELANCE"
      | null;
    startDate: Date | null;
    endDate: Date | null;
    isCurrent: boolean;
    description: string | null;
    sortOrder: number;
  }>;
  educations: Array<{
    id: string;
    institution: string;
    degree: string;
    fieldOfStudy: string;
    startYear: number | null;
    endYear: number | null;
    sortOrder: number;
  }>;
  userSkillEntries: Array<{
    id: string;
    skillSlug: string;
    level: "BASIC" | "INTERMEDIATE" | "ADVANCED" | null;
  }>;
};

export type SeedSourcePlatform = {
  id: string;
  slug: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
};

export type SeedCompany = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string;
  websiteUrl: string;
};

export type SeedSkill = {
  id: string;
  slug: string;
  name: string;
  category: string;
};

export type SeedIngestionRun = {
  id: string;
  sourcePlatformId: string;
  startedAt: Date;
  finishedAt: Date;
  status: string;
  observedCount: number;
  upsertedCount: number;
  errorCount: number;
};

export type SeedJob = {
  id: string;
  sourcePlatformId: string;
  companyId: string;
  ingestionRunId: string;
  externalJobId: string;
  title: string;
  normalizedTitle: string;
  category: string;
  description: string;
  requirementSummary: string;
  workType: "REMOTE" | "HYBRID" | "ONSITE";
  employmentType:
    | "FULL_TIME"
    | "PART_TIME"
    | "INTERNSHIP"
    | "CONTRACT"
    | "FREELANCE";
  experienceLevel: "ENTRY_LEVEL" | "JUNIOR" | "MID_LEVEL" | "SENIOR" | "LEAD";
  locationDisplay: string;
  province: string;
  city: string;
  salaryMin: number;
  salaryMax: number;
  salaryCurrency: string;
  salaryPeriod: "MONTHLY" | "YEARLY";
  salaryDisplay: string;
  sourceUrl: string;
  externalApplyUrl: string;
  sourcePostedAt: Date;
  sourceUpdatedAt: Date;
  lastSeenAt: Date;
  expiredAt: Date | null;
  status: "ACTIVE" | "STALE" | "EXPIRED" | "CLOSED" | "HIDDEN";
  requirements: Array<{
    id: string;
    type: "SKILL" | "EXPERIENCE" | "EDUCATION" | "RESPONSIBILITY" | "OTHER";
    value: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    sortOrder: number;
  }>;
  skillLinks: Array<{
    id: string;
    skillId: string;
    confidence: string;
  }>;
};

export type SeedBookmark = {
  id: string;
  userId: string;
  jobListingId: string;
  createdAt: Date;
};

export type SeedApplicationRecord = {
  id: string;
  userId: string;
  jobListingId: string;
  status: "APPLIED" | "INTERVIEW" | "REJECTED" | "ACCEPTED";
  source: "MANUAL" | "EXTERNAL_APPLY_CLICK";
  notes: string;
  appliedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SeedApplicationHistory = {
  id: string;
  applicationRecordId: string;
  userId: string;
  fromStatus: "APPLIED" | "INTERVIEW" | "REJECTED" | "ACCEPTED" | null;
  toStatus: "APPLIED" | "INTERVIEW" | "REJECTED" | "ACCEPTED";
  notes: string;
  createdAt: Date;
};

export type SeedFitScoreResult = {
  id: string;
  userId: string;
  jobListingId: string;
  fitScore: number;
  readinessLevel: string;
  recommendationDecision: string;
  recommendationSummary: string;
  breakdown: Record<string, unknown>;
  modelName: string;
  modelVersion: string;
  inputSummary: Record<string, unknown>;
  analyzedAt: Date;
  createdAt: Date;
};

export type SeedSkillGapResult = {
  id: string;
  userId: string;
  jobListingId: string;
  gaps: Array<Record<string, string>>;
  modelName: string;
  modelVersion: string;
  inputSummary: Record<string, unknown>;
  analyzedAt: Date;
  createdAt: Date;
};

export type SeedCvFileMetadata = {
  id: string;
  userId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  storageDriver: "LOCAL";
  storageKey: string;
  uploadedAt: Date;
  expiresAt: Date;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SeedCvAnalysisResult = {
  id: string;
  userId: string;
  jobListingId: string;
  cvFileMetadataId: string;
  language: "ID" | "EN";
  inputMode: "UPLOAD" | "REFERENCE";
  compareSource: "BOOKMARK" | "JOB_SEARCH" | "DIRECT_JOB_DETAIL";
  overallImpression: Record<string, unknown>;
  jobFitAlignment: Record<string, unknown>;
  atsFriendliness: Record<string, unknown>;
  keywordOptimization: Record<string, unknown>;
  experienceQuantification: Record<string, unknown>;
  actionableImprovements: string[];
  modelName: string;
  modelVersion: string;
  inputSummary: Record<string, unknown>;
  analyzedAt: Date;
  createdAt: Date;
};

export type SeedAiRequestLog = {
  id: string;
  userId: string | null;
  kind: "JOB_FIT" | "CV_ANALYSIS";
  status: "SUCCEEDED" | "FAILED";
  requestId: string;
  modelName: string;
  modelVersion: string;
  latencyMs: number;
  errorCode: string | null;
  inputSummary: Record<string, unknown>;
  outputSummary: Record<string, unknown>;
  createdAt: Date;
};

const date = (value: string) => new Date(value);

const seedReferenceKeys = new Set([
  "id",
  "userId",
  "sourcePlatformId",
  "companyId",
  "ingestionRunId",
  "skillId",
  "jobListingId",
  "applicationRecordId",
  "cvFileMetadataId"
]);

function seededUuid(value: string) {
  const hash = createHash("sha1").update(value).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32)
  ].join("-");
}

function collectSeedReferences(
  value: unknown,
  parentKey?: string,
  collected: Set<string> = new Set()
) {
  if (value instanceof Date) {
    return collected;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectSeedReferences(item, parentKey, collected);
    }

    return collected;
  }

  if (value && typeof value === "object") {
    for (const [key, nestedValue] of Object.entries(value)) {
      collectSeedReferences(nestedValue, key, collected);
    }

    return collected;
  }

  if (
    typeof value === "string" &&
    parentKey &&
    seedReferenceKeys.has(parentKey) &&
    value.startsWith("seed-")
  ) {
    collected.add(value);
  }

  return collected;
}

function replaceSeedReferences(
  value: unknown,
  referenceMap: ReadonlyMap<string, string>
): unknown {
  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceSeedReferences(item, referenceMap));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        replaceSeedReferences(nestedValue, referenceMap)
      ])
    );
  }

  if (typeof value === "string") {
    return referenceMap.get(value) ?? value;
  }

  return value;
}

function normalizeSeedReferences<T>(value: T): T {
  const referenceMap = new Map(
    [...collectSeedReferences(value)].map((reference) => [
      reference,
      seededUuid(reference)
    ])
  );

  return replaceSeedReferences(value, referenceMap) as T;
}

export const sourcePlatforms: SeedSourcePlatform[] = normalizeSeedReferences([
  {
    id: "seed-source-glints",
    slug: "glints",
    name: "Glints",
    baseUrl: "https://glints.com",
    isActive: true
  },
  {
    id: "seed-source-jobstreet",
    slug: "jobstreet",
    name: "JobStreet",
    baseUrl: "https://www.jobstreet.co.id",
    isActive: true
  },
  {
    id: "seed-source-kalibrr",
    slug: "kalibrr",
    name: "Kalibrr",
    baseUrl: "https://www.kalibrr.com",
    isActive: true
  },
  {
    id: "seed-source-dealls",
    slug: "dealls",
    name: "Dealls",
    baseUrl: "https://dealls.com",
    isActive: true
  },
  {
    id: "seed-source-linkedin",
    slug: "linkedin",
    name: "LinkedIn Jobs",
    baseUrl: "https://www.linkedin.com/jobs",
    isActive: true
  }
]);

export const skills: SeedSkill[] = normalizeSeedReferences([
  {
    id: "seed-skill-typescript",
    slug: "typescript",
    name: "TypeScript",
    category: "Programming"
  },
  {
    id: "seed-skill-node-js",
    slug: "node-js",
    name: "Node.js",
    category: "Backend"
  },
  {
    id: "seed-skill-postgresql",
    slug: "postgresql",
    name: "PostgreSQL",
    category: "Database"
  },
  {
    id: "seed-skill-rest-api",
    slug: "rest-api",
    name: "REST API",
    category: "Backend"
  },
  {
    id: "seed-skill-docker",
    slug: "docker",
    name: "Docker",
    category: "DevOps"
  },
  {
    id: "seed-skill-react",
    slug: "react",
    name: "React",
    category: "Frontend"
  },
  { id: "seed-skill-figma", slug: "figma", name: "Figma", category: "Design" },
  { id: "seed-skill-sql", slug: "sql", name: "SQL", category: "Database" },
  {
    id: "seed-skill-data-analysis",
    slug: "data-analysis",
    name: "Data Analysis",
    category: "Analytics"
  },
  {
    id: "seed-skill-project-management",
    slug: "project-management",
    name: "Project Management",
    category: "Operations"
  }
]);

export const companies: SeedCompany[] = normalizeSeedReferences([
  {
    id: "seed-company-nusantara-tech",
    slug: "nusantara-tech",
    name: "Nusantara Tech",
    logoUrl: "https://example.test/assets/nusantara-tech.png",
    websiteUrl: "https://example.test/nusantara-tech"
  },
  {
    id: "seed-company-cakrawala-digital",
    slug: "cakrawala-digital",
    name: "Cakrawala Digital",
    logoUrl: "https://example.test/assets/cakrawala-digital.png",
    websiteUrl: "https://example.test/cakrawala-digital"
  },
  {
    id: "seed-company-merah-putih-labs",
    slug: "merah-putih-labs",
    name: "Merah Putih Labs",
    logoUrl: "https://example.test/assets/merah-putih-labs.png",
    websiteUrl: "https://example.test/merah-putih-labs"
  },
  {
    id: "seed-company-satudata",
    slug: "satu-data-indonesia",
    name: "Satu Data Indonesia",
    logoUrl: "https://example.test/assets/satu-data-indonesia.png",
    websiteUrl: "https://example.test/satu-data-indonesia"
  },
  {
    id: "seed-company-solusi-talenta",
    slug: "solusi-talenta-nusantara",
    name: "Solusi Talenta Nusantara",
    logoUrl: "https://example.test/assets/solusi-talenta-nusantara.png",
    websiteUrl: "https://example.test/solusi-talenta-nusantara"
  }
]);

export const ingestionRuns: SeedIngestionRun[] = normalizeSeedReferences([
  {
    id: "seed-ingestion-001",
    sourcePlatformId: "seed-source-glints",
    startedAt: date("2026-04-20T00:00:00.000Z"),
    finishedAt: date("2026-04-20T00:10:00.000Z"),
    status: "completed",
    observedCount: 24,
    upsertedCount: 18,
    errorCount: 1
  },
  {
    id: "seed-ingestion-002",
    sourcePlatformId: "seed-source-jobstreet",
    startedAt: date("2026-04-20T01:00:00.000Z"),
    finishedAt: date("2026-04-20T01:12:00.000Z"),
    status: "completed",
    observedCount: 19,
    upsertedCount: 14,
    errorCount: 0
  },
  {
    id: "seed-ingestion-003",
    sourcePlatformId: "seed-source-kalibrr",
    startedAt: date("2026-04-20T02:00:00.000Z"),
    finishedAt: date("2026-04-20T02:16:00.000Z"),
    status: "completed",
    observedCount: 21,
    upsertedCount: 16,
    errorCount: 2
  },
  {
    id: "seed-ingestion-004",
    sourcePlatformId: "seed-source-dealls",
    startedAt: date("2026-04-20T03:00:00.000Z"),
    finishedAt: date("2026-04-20T03:08:00.000Z"),
    status: "completed",
    observedCount: 15,
    upsertedCount: 11,
    errorCount: 0
  },
  {
    id: "seed-ingestion-005",
    sourcePlatformId: "seed-source-linkedin",
    startedAt: date("2026-04-20T04:00:00.000Z"),
    finishedAt: date("2026-04-20T04:14:00.000Z"),
    status: "completed",
    observedCount: 17,
    upsertedCount: 12,
    errorCount: 1
  }
]);

export const jobs: SeedJob[] = normalizeSeedReferences([
  {
    id: "seed-job-001",
    sourcePlatformId: "seed-source-glints",
    companyId: "seed-company-nusantara-tech",
    ingestionRunId: "seed-ingestion-001",
    externalJobId: "seed-glints-backend-001",
    title: "Backend Developer",
    normalizedTitle: "backend developer",
    category: "Engineering",
    description:
      "Membangun API lowongan kerja, pipeline integrasi, dan fitur personalisasi untuk pengguna early-career.",
    requirementSummary:
      "TypeScript, Node.js, REST API, dan pengalaman membangun layanan berbasis PostgreSQL.",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "JUNIOR",
    locationDisplay: "Jakarta Selatan, DKI Jakarta",
    province: "DKI Jakarta",
    city: "Jakarta Selatan",
    salaryMin: 8000000,
    salaryMax: 12000000,
    salaryCurrency: "IDR",
    salaryPeriod: "MONTHLY",
    salaryDisplay: "Rp8.000.000 - Rp12.000.000 / bulan",
    sourceUrl:
      "https://glints.com/id/opportunities/jobs/seed-glints-backend-001",
    externalApplyUrl:
      "https://glints.com/id/opportunities/jobs/seed-glints-backend-001/apply",
    sourcePostedAt: date("2026-04-18T00:00:00.000Z"),
    sourceUpdatedAt: date("2026-04-21T00:00:00.000Z"),
    lastSeenAt: date("2026-04-23T08:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    requirements: [
      {
        id: "seed-job-001-req-001",
        type: "SKILL",
        value: "Menguasai TypeScript dan Node.js untuk pengembangan API.",
        priority: "HIGH",
        sortOrder: 0
      },
      {
        id: "seed-job-001-req-002",
        type: "SKILL",
        value:
          "Memahami desain database relasional dan optimasi query PostgreSQL.",
        priority: "HIGH",
        sortOrder: 1
      },
      {
        id: "seed-job-001-req-003",
        type: "RESPONSIBILITY",
        value:
          "Berkoordinasi dengan tim produk untuk menerjemahkan kebutuhan menjadi endpoint yang stabil.",
        priority: "MEDIUM",
        sortOrder: 2
      }
    ],
    skillLinks: [
      {
        id: "seed-job-001-skill-001",
        skillId: "seed-skill-typescript",
        confidence: "0.9800"
      },
      {
        id: "seed-job-001-skill-002",
        skillId: "seed-skill-node-js",
        confidence: "0.9700"
      },
      {
        id: "seed-job-001-skill-003",
        skillId: "seed-skill-postgresql",
        confidence: "0.9400"
      }
    ]
  },
  {
    id: "seed-job-002",
    sourcePlatformId: "seed-source-jobstreet",
    companyId: "seed-company-cakrawala-digital",
    ingestionRunId: "seed-ingestion-002",
    externalJobId: "seed-jobstreet-fullstack-001",
    title: "Full Stack Engineer",
    normalizedTitle: "full stack engineer",
    category: "Engineering",
    description:
      "Mengembangkan dashboard internal recruiter dan alur aplikasi kandidat dari frontend sampai backend.",
    requirementSummary:
      "React, TypeScript, REST API, dan pemahaman kolaborasi lintas fungsi.",
    workType: "HYBRID",
    employmentType: "FULL_TIME",
    experienceLevel: "MID_LEVEL",
    locationDisplay: "Bandung, Jawa Barat",
    province: "Jawa Barat",
    city: "Bandung",
    salaryMin: 10000000,
    salaryMax: 15000000,
    salaryCurrency: "IDR",
    salaryPeriod: "MONTHLY",
    salaryDisplay: "Rp10.000.000 - Rp15.000.000 / bulan",
    sourceUrl:
      "https://www.jobstreet.co.id/id/job/seed-jobstreet-fullstack-001",
    externalApplyUrl:
      "https://www.jobstreet.co.id/id/job/seed-jobstreet-fullstack-001/apply",
    sourcePostedAt: date("2026-04-17T00:00:00.000Z"),
    sourceUpdatedAt: date("2026-04-20T00:00:00.000Z"),
    lastSeenAt: date("2026-04-23T09:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    requirements: [
      {
        id: "seed-job-002-req-001",
        type: "SKILL",
        value:
          "Berpengalaman membangun aplikasi React dan API TypeScript dalam satu codebase.",
        priority: "HIGH",
        sortOrder: 0
      },
      {
        id: "seed-job-002-req-002",
        type: "EXPERIENCE",
        value:
          "Memiliki pengalaman 2-4 tahun mengirim fitur produk end-to-end.",
        priority: "MEDIUM",
        sortOrder: 1
      },
      {
        id: "seed-job-002-req-003",
        type: "RESPONSIBILITY",
        value:
          "Menerjemahkan kebutuhan recruiter menjadi alur UI dan API yang konsisten.",
        priority: "MEDIUM",
        sortOrder: 2
      }
    ],
    skillLinks: [
      {
        id: "seed-job-002-skill-001",
        skillId: "seed-skill-react",
        confidence: "0.9800"
      },
      {
        id: "seed-job-002-skill-002",
        skillId: "seed-skill-typescript",
        confidence: "0.9700"
      },
      {
        id: "seed-job-002-skill-003",
        skillId: "seed-skill-rest-api",
        confidence: "0.9200"
      }
    ]
  },
  {
    id: "seed-job-003",
    sourcePlatformId: "seed-source-kalibrr",
    companyId: "seed-company-merah-putih-labs",
    ingestionRunId: "seed-ingestion-003",
    externalJobId: "seed-kalibrr-platform-001",
    title: "Platform Engineer",
    normalizedTitle: "platform engineer",
    category: "Platform",
    description:
      "Menjaga reliability layanan backend, deployment pipeline, dan standardisasi observability tim.",
    requirementSummary:
      "Docker, PostgreSQL, SQL, dan pengalaman mengelola service containerized.",
    workType: "ONSITE",
    employmentType: "CONTRACT",
    experienceLevel: "SENIOR",
    locationDisplay: "Sleman, DI Yogyakarta",
    province: "DI Yogyakarta",
    city: "Sleman",
    salaryMin: 15000000,
    salaryMax: 22000000,
    salaryCurrency: "IDR",
    salaryPeriod: "MONTHLY",
    salaryDisplay: "Rp15.000.000 - Rp22.000.000 / bulan",
    sourceUrl: "https://www.kalibrr.com/job-board/seed-kalibrr-platform-001",
    externalApplyUrl:
      "https://www.kalibrr.com/job-board/seed-kalibrr-platform-001/apply",
    sourcePostedAt: date("2026-04-16T00:00:00.000Z"),
    sourceUpdatedAt: date("2026-04-22T00:00:00.000Z"),
    lastSeenAt: date("2026-04-23T10:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    requirements: [
      {
        id: "seed-job-003-req-001",
        type: "SKILL",
        value:
          "Mampu mengelola Docker Compose dan observability service di environment staging.",
        priority: "HIGH",
        sortOrder: 0
      },
      {
        id: "seed-job-003-req-002",
        type: "SKILL",
        value: "Memahami SQL tuning dan troubleshooting performa PostgreSQL.",
        priority: "HIGH",
        sortOrder: 1
      },
      {
        id: "seed-job-003-req-003",
        type: "RESPONSIBILITY",
        value: "Menyusun baseline deployment yang aman dan mudah diaudit.",
        priority: "MEDIUM",
        sortOrder: 2
      }
    ],
    skillLinks: [
      {
        id: "seed-job-003-skill-001",
        skillId: "seed-skill-docker",
        confidence: "0.9900"
      },
      {
        id: "seed-job-003-skill-002",
        skillId: "seed-skill-postgresql",
        confidence: "0.9500"
      },
      {
        id: "seed-job-003-skill-003",
        skillId: "seed-skill-sql",
        confidence: "0.9300"
      }
    ]
  },
  {
    id: "seed-job-004",
    sourcePlatformId: "seed-source-dealls",
    companyId: "seed-company-satudata",
    ingestionRunId: "seed-ingestion-004",
    externalJobId: "seed-dealls-data-001",
    title: "Junior Data Analyst",
    normalizedTitle: "junior data analyst",
    category: "Data",
    description:
      "Membantu tim growth dan partnership membaca funnel pelamar, kualitas listing, dan performa sourcing.",
    requirementSummary:
      "SQL, data analysis, dashboarding, dan komunikasi insight yang jelas.",
    workType: "HYBRID",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    locationDisplay: "Surabaya, Jawa Timur",
    province: "Jawa Timur",
    city: "Surabaya",
    salaryMin: 6500000,
    salaryMax: 9500000,
    salaryCurrency: "IDR",
    salaryPeriod: "MONTHLY",
    salaryDisplay: "Rp6.500.000 - Rp9.500.000 / bulan",
    sourceUrl: "https://dealls.com/loker/seed-dealls-data-001",
    externalApplyUrl: "https://dealls.com/loker/seed-dealls-data-001/apply",
    sourcePostedAt: date("2026-04-19T00:00:00.000Z"),
    sourceUpdatedAt: date("2026-04-22T00:00:00.000Z"),
    lastSeenAt: date("2026-04-23T11:00:00.000Z"),
    expiredAt: null,
    status: "STALE",
    requirements: [
      {
        id: "seed-job-004-req-001",
        type: "SKILL",
        value: "Nyaman mengolah data dengan SQL dan spreadsheet.",
        priority: "HIGH",
        sortOrder: 0
      },
      {
        id: "seed-job-004-req-002",
        type: "EXPERIENCE",
        value:
          "Magang atau proyek kampus yang menunjukkan analisis funnel akan menjadi nilai tambah.",
        priority: "LOW",
        sortOrder: 1
      },
      {
        id: "seed-job-004-req-003",
        type: "RESPONSIBILITY",
        value:
          "Membuat insight mingguan untuk kualitas supply lowongan dan perilaku pelamar.",
        priority: "MEDIUM",
        sortOrder: 2
      }
    ],
    skillLinks: [
      {
        id: "seed-job-004-skill-001",
        skillId: "seed-skill-sql",
        confidence: "0.9700"
      },
      {
        id: "seed-job-004-skill-002",
        skillId: "seed-skill-data-analysis",
        confidence: "0.9900"
      },
      {
        id: "seed-job-004-skill-003",
        skillId: "seed-skill-project-management",
        confidence: "0.7500"
      }
    ]
  },
  {
    id: "seed-job-005",
    sourcePlatformId: "seed-source-linkedin",
    companyId: "seed-company-solusi-talenta",
    ingestionRunId: "seed-ingestion-005",
    externalJobId: "seed-linkedin-product-001",
    title: "Associate Product Manager",
    normalizedTitle: "associate product manager",
    category: "Product",
    description:
      "Mengelola backlog produk karier digital, validasi kebutuhan pengguna, dan koordinasi rilis lintas tim.",
    requirementSummary:
      "Project management, komunikasi lintas fungsi, dan dasar analisis produk.",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "JUNIOR",
    locationDisplay: "Indonesia",
    province: "Indonesia",
    city: "Remote",
    salaryMin: 9000000,
    salaryMax: 14000000,
    salaryCurrency: "IDR",
    salaryPeriod: "MONTHLY",
    salaryDisplay: "Rp9.000.000 - Rp14.000.000 / bulan",
    sourceUrl: "https://www.linkedin.com/jobs/view/seed-linkedin-product-001",
    externalApplyUrl:
      "https://www.linkedin.com/jobs/view/seed-linkedin-product-001/apply",
    sourcePostedAt: date("2026-04-18T00:00:00.000Z"),
    sourceUpdatedAt: date("2026-04-23T00:00:00.000Z"),
    lastSeenAt: date("2026-04-23T12:00:00.000Z"),
    expiredAt: null,
    status: "ACTIVE",
    requirements: [
      {
        id: "seed-job-005-req-001",
        type: "SKILL",
        value:
          "Mampu menyusun prioritas backlog dan artefak discovery secara terstruktur.",
        priority: "HIGH",
        sortOrder: 0
      },
      {
        id: "seed-job-005-req-002",
        type: "OTHER",
        value:
          "Komunikasi tertulis yang rapi untuk koordinasi dengan engineering dan business team.",
        priority: "MEDIUM",
        sortOrder: 1
      },
      {
        id: "seed-job-005-req-003",
        type: "RESPONSIBILITY",
        value:
          "Memastikan eksperimen produk menghasilkan pembelajaran yang bisa ditindaklanjuti.",
        priority: "MEDIUM",
        sortOrder: 2
      }
    ],
    skillLinks: [
      {
        id: "seed-job-005-skill-001",
        skillId: "seed-skill-project-management",
        confidence: "0.9800"
      },
      {
        id: "seed-job-005-skill-002",
        skillId: "seed-skill-data-analysis",
        confidence: "0.7800"
      },
      {
        id: "seed-job-005-skill-003",
        skillId: "seed-skill-figma",
        confidence: "0.6500"
      }
    ]
  }
]);

export const users: SeedUser[] = normalizeSeedReferences([
  {
    id: "seed-user-annisa",
    email: "annisa.pratama@example.test",
    username: "annisa.pratama",
    displayName: "Annisa Pratama",
    phoneNumber: "+6281211111111",
    status: "ACTIVE",
    emailVerifiedAt: date("2026-04-10T08:00:00.000Z"),
    onboardingStatus: "COMPLETED",
    createdAt: date("2026-04-01T08:00:00.000Z"),
    updatedAt: date("2026-04-22T08:00:00.000Z"),
    deletedAt: null,
    profile: {
      id: "seed-profile-annisa",
      careerStatus: "EARLY_CAREER",
      latestRole: "Backend Developer",
      summary:
        "Backend engineer dengan fokus pada API TypeScript, integrasi service, dan maintainability.",
      profilePhotoStorageKey: "profiles/annisa-pratama.jpg",
      profilePhotoUrl: "https://example.test/profiles/annisa-pratama.jpg",
      profilePhotoMimeType: "image/jpeg",
      profilePhotoSizeBytes: 186000
    },
    preference: {
      id: "seed-preference-annisa",
      careerStatus: "EARLY_CAREER",
      jobSeekingStatus: "IMMEDIATE",
      targetRoles: ["Backend Developer", "Platform Engineer"],
      locations: [
        { province: "DKI Jakarta", city: "Jakarta Selatan" },
        { province: "Jawa Barat", city: "Bandung" }
      ],
      workTypes: ["REMOTE", "HYBRID"],
      salaryMin: 9000000,
      salaryMax: 14000000,
      salaryCurrency: "IDR",
      salaryPeriod: "MONTHLY",
      emailNotificationsEnabled: true
    },
    experiences: [
      {
        id: "seed-exp-annisa-001",
        title: "Backend Developer",
        company: "PT Solusi Karier Digital",
        employmentType: "FULL_TIME",
        startDate: date("2024-01-15T00:00:00.000Z"),
        endDate: null,
        isCurrent: true,
        description:
          "Membangun API pencarian lowongan dan modul autentikasi berbasis Node.js.",
        sortOrder: 0
      },
      {
        id: "seed-exp-annisa-002",
        title: "Software Engineer Intern",
        company: "Nusa Talenta",
        employmentType: "INTERNSHIP",
        startDate: date("2023-06-01T00:00:00.000Z"),
        endDate: date("2023-12-31T00:00:00.000Z"),
        isCurrent: false,
        description:
          "Mengerjakan endpoint internal dan perbaikan query database.",
        sortOrder: 1
      }
    ],
    educations: [
      {
        id: "seed-edu-annisa-001",
        institution: "Universitas Indonesia",
        degree: "S.Kom.",
        fieldOfStudy: "Ilmu Komputer",
        startYear: 2019,
        endYear: 2023,
        sortOrder: 0
      }
    ],
    userSkillEntries: [
      {
        id: "seed-user-skill-annisa-001",
        skillSlug: "typescript",
        level: "ADVANCED"
      },
      {
        id: "seed-user-skill-annisa-002",
        skillSlug: "node-js",
        level: "ADVANCED"
      },
      {
        id: "seed-user-skill-annisa-003",
        skillSlug: "postgresql",
        level: "INTERMEDIATE"
      }
    ]
  },
  {
    id: "seed-user-bima",
    email: "bima.saputra@example.test",
    username: "bima.saputra",
    displayName: "Bima Saputra",
    phoneNumber: "+6281222222222",
    status: "ACTIVE",
    emailVerifiedAt: date("2026-04-12T08:00:00.000Z"),
    onboardingStatus: "COMPLETED",
    createdAt: date("2026-04-02T08:00:00.000Z"),
    updatedAt: date("2026-04-22T10:00:00.000Z"),
    deletedAt: null,
    profile: {
      id: "seed-profile-bima",
      careerStatus: "EARLY_CAREER",
      latestRole: "Full Stack Engineer",
      summary:
        "Engineer generalis yang nyaman bergerak dari UI React ke service backend.",
      profilePhotoStorageKey: "profiles/bima-saputra.jpg",
      profilePhotoUrl: "https://example.test/profiles/bima-saputra.jpg",
      profilePhotoMimeType: "image/jpeg",
      profilePhotoSizeBytes: 193000
    },
    preference: {
      id: "seed-preference-bima",
      careerStatus: "EARLY_CAREER",
      jobSeekingStatus: "ONE_MONTH",
      targetRoles: ["Full Stack Engineer", "Frontend Engineer"],
      locations: [
        { province: "Jawa Barat", city: "Bandung" },
        { province: "DKI Jakarta", city: "Jakarta Pusat" }
      ],
      workTypes: ["HYBRID", "REMOTE"],
      salaryMin: 10000000,
      salaryMax: 16000000,
      salaryCurrency: "IDR",
      salaryPeriod: "MONTHLY",
      emailNotificationsEnabled: true
    },
    experiences: [
      {
        id: "seed-exp-bima-001",
        title: "Full Stack Engineer",
        company: "Cakrawala Commerce",
        employmentType: "FULL_TIME",
        startDate: date("2023-03-01T00:00:00.000Z"),
        endDate: null,
        isCurrent: true,
        description:
          "Mengerjakan aplikasi internal sales dan backend integrasi pembayaran.",
        sortOrder: 0
      },
      {
        id: "seed-exp-bima-002",
        title: "Frontend Developer Freelance",
        company: "Freelance",
        employmentType: "FREELANCE",
        startDate: date("2022-01-01T00:00:00.000Z"),
        endDate: date("2023-02-01T00:00:00.000Z"),
        isCurrent: false,
        description:
          "Membangun landing page dan dashboard sederhana untuk UMKM.",
        sortOrder: 1
      }
    ],
    educations: [
      {
        id: "seed-edu-bima-001",
        institution: "Institut Teknologi Bandung",
        degree: "S.T.",
        fieldOfStudy: "Sistem dan Teknologi Informasi",
        startYear: 2018,
        endYear: 2022,
        sortOrder: 0
      }
    ],
    userSkillEntries: [
      { id: "seed-user-skill-bima-001", skillSlug: "react", level: "ADVANCED" },
      {
        id: "seed-user-skill-bima-002",
        skillSlug: "typescript",
        level: "ADVANCED"
      },
      {
        id: "seed-user-skill-bima-003",
        skillSlug: "rest-api",
        level: "INTERMEDIATE"
      }
    ]
  },
  {
    id: "seed-user-citra",
    email: "citra.lestari@example.test",
    username: "citra.lestari",
    displayName: "Citra Lestari",
    phoneNumber: "+6281233333333",
    status: "ACTIVE",
    emailVerifiedAt: date("2026-04-14T08:00:00.000Z"),
    onboardingStatus: "COMPLETED",
    createdAt: date("2026-04-03T08:00:00.000Z"),
    updatedAt: date("2026-04-22T12:00:00.000Z"),
    deletedAt: null,
    profile: {
      id: "seed-profile-citra",
      careerStatus: "FRESH_GRADUATE",
      latestRole: "Data Analyst Intern",
      summary:
        "Fresh graduate dengan minat kuat pada analisis funnel pengguna dan dashboard operasional.",
      profilePhotoStorageKey: null,
      profilePhotoUrl: null,
      profilePhotoMimeType: null,
      profilePhotoSizeBytes: null
    },
    preference: {
      id: "seed-preference-citra",
      careerStatus: "FRESH_GRADUATE",
      jobSeekingStatus: "IMMEDIATE",
      targetRoles: ["Data Analyst", "Business Intelligence Analyst"],
      locations: [
        { province: "Jawa Timur", city: "Surabaya" },
        { province: "DKI Jakarta", city: null }
      ],
      workTypes: ["HYBRID", "ONSITE"],
      salaryMin: 6000000,
      salaryMax: 9000000,
      salaryCurrency: "IDR",
      salaryPeriod: "MONTHLY",
      emailNotificationsEnabled: true
    },
    experiences: [
      {
        id: "seed-exp-citra-001",
        title: "Data Analyst Intern",
        company: "Insight Nusantara",
        employmentType: "INTERNSHIP",
        startDate: date("2025-08-01T00:00:00.000Z"),
        endDate: date("2026-01-31T00:00:00.000Z"),
        isCurrent: false,
        description:
          "Membuat dashboard mingguan untuk monitoring performa kampanye digital.",
        sortOrder: 0
      }
    ],
    educations: [
      {
        id: "seed-edu-citra-001",
        institution: "Universitas Airlangga",
        degree: "S.Stat.",
        fieldOfStudy: "Statistika",
        startYear: 2021,
        endYear: 2025,
        sortOrder: 0
      }
    ],
    userSkillEntries: [
      {
        id: "seed-user-skill-citra-001",
        skillSlug: "sql",
        level: "INTERMEDIATE"
      },
      {
        id: "seed-user-skill-citra-002",
        skillSlug: "data-analysis",
        level: "ADVANCED"
      },
      {
        id: "seed-user-skill-citra-003",
        skillSlug: "project-management",
        level: "BASIC"
      }
    ]
  },
  {
    id: "seed-user-dion",
    email: "dion.wijaya@example.test",
    username: "dion.wijaya",
    displayName: "Dion Wijaya",
    phoneNumber: "+6281244444444",
    status: "ACTIVE",
    emailVerifiedAt: null,
    onboardingStatus: "IN_PROGRESS",
    createdAt: date("2026-04-04T08:00:00.000Z"),
    updatedAt: date("2026-04-22T14:00:00.000Z"),
    deletedAt: null,
    profile: {
      id: "seed-profile-dion",
      careerStatus: "CAREER_SWITCHER",
      latestRole: "Operations Supervisor",
      summary:
        "Sedang transisi ke product operations dan peran associate product manager.",
      profilePhotoStorageKey: null,
      profilePhotoUrl: null,
      profilePhotoMimeType: null,
      profilePhotoSizeBytes: null
    },
    preference: {
      id: "seed-preference-dion",
      careerStatus: "CAREER_SWITCHER",
      jobSeekingStatus: "THREE_MONTHS",
      targetRoles: ["Associate Product Manager", "Product Operations"],
      locations: [
        { province: "Indonesia", city: "Remote" },
        { province: "Banten", city: "Tangerang Selatan" }
      ],
      workTypes: ["REMOTE", "HYBRID"],
      salaryMin: 8500000,
      salaryMax: 13000000,
      salaryCurrency: "IDR",
      salaryPeriod: "MONTHLY",
      emailNotificationsEnabled: false
    },
    experiences: [
      {
        id: "seed-exp-dion-001",
        title: "Operations Supervisor",
        company: "Rantai Distribusi Prima",
        employmentType: "FULL_TIME",
        startDate: date("2022-02-01T00:00:00.000Z"),
        endDate: null,
        isCurrent: true,
        description:
          "Mengelola SOP operasional, dashboard KPI, dan koordinasi lintas tim.",
        sortOrder: 0
      }
    ],
    educations: [
      {
        id: "seed-edu-dion-001",
        institution: "Universitas Bina Nusantara",
        degree: "S.M.",
        fieldOfStudy: "Manajemen",
        startYear: 2017,
        endYear: 2021,
        sortOrder: 0
      }
    ],
    userSkillEntries: [
      {
        id: "seed-user-skill-dion-001",
        skillSlug: "project-management",
        level: "ADVANCED"
      },
      {
        id: "seed-user-skill-dion-002",
        skillSlug: "data-analysis",
        level: "INTERMEDIATE"
      },
      { id: "seed-user-skill-dion-003", skillSlug: "figma", level: "BASIC" }
    ]
  },
  {
    id: "seed-user-eka",
    email: "eka.novita@example.test",
    username: "eka.novita",
    displayName: "Eka Novita",
    phoneNumber: "+6281255555555",
    status: "DISABLED",
    emailVerifiedAt: date("2026-04-15T08:00:00.000Z"),
    onboardingStatus: "PENDING",
    createdAt: date("2026-04-05T08:00:00.000Z"),
    updatedAt: date("2026-04-22T16:00:00.000Z"),
    deletedAt: null,
    profile: {
      id: "seed-profile-eka",
      careerStatus: "EARLY_CAREER",
      latestRole: "UI/UX Designer",
      summary:
        "Designer produk digital yang mulai memperluas fokus ke desain lowongan dan kandidat experience.",
      profilePhotoStorageKey: "profiles/eka-novita.jpg",
      profilePhotoUrl: "https://example.test/profiles/eka-novita.jpg",
      profilePhotoMimeType: "image/jpeg",
      profilePhotoSizeBytes: 175000
    },
    preference: {
      id: "seed-preference-eka",
      careerStatus: "EARLY_CAREER",
      jobSeekingStatus: "ONE_MONTH",
      targetRoles: ["UI/UX Designer", "Product Designer"],
      locations: [
        { province: "DKI Jakarta", city: "Jakarta Selatan" },
        { province: "Bali", city: "Denpasar" }
      ],
      workTypes: ["REMOTE"],
      salaryMin: 8000000,
      salaryMax: 12000000,
      salaryCurrency: "IDR",
      salaryPeriod: "MONTHLY",
      emailNotificationsEnabled: true
    },
    experiences: [
      {
        id: "seed-exp-eka-001",
        title: "UI/UX Designer",
        company: "Studio Interaksi",
        employmentType: "FULL_TIME",
        startDate: date("2023-05-01T00:00:00.000Z"),
        endDate: null,
        isCurrent: true,
        description:
          "Mendesain onboarding dan dashboard untuk platform edukasi.",
        sortOrder: 0
      }
    ],
    educations: [
      {
        id: "seed-edu-eka-001",
        institution: "Institut Seni Indonesia Yogyakarta",
        degree: "S.Ds.",
        fieldOfStudy: "Desain Komunikasi Visual",
        startYear: 2018,
        endYear: 2022,
        sortOrder: 0
      }
    ],
    userSkillEntries: [
      { id: "seed-user-skill-eka-001", skillSlug: "figma", level: "ADVANCED" },
      { id: "seed-user-skill-eka-002", skillSlug: "react", level: "BASIC" },
      {
        id: "seed-user-skill-eka-003",
        skillSlug: "project-management",
        level: "INTERMEDIATE"
      }
    ]
  }
]);

export const bookmarks: SeedBookmark[] = normalizeSeedReferences([
  {
    id: "seed-bookmark-001",
    userId: "seed-user-annisa",
    jobListingId: "seed-job-001",
    createdAt: date("2026-04-20T08:00:00.000Z")
  },
  {
    id: "seed-bookmark-002",
    userId: "seed-user-annisa",
    jobListingId: "seed-job-003",
    createdAt: date("2026-04-20T09:00:00.000Z")
  },
  {
    id: "seed-bookmark-003",
    userId: "seed-user-bima",
    jobListingId: "seed-job-002",
    createdAt: date("2026-04-20T10:00:00.000Z")
  },
  {
    id: "seed-bookmark-004",
    userId: "seed-user-bima",
    jobListingId: "seed-job-005",
    createdAt: date("2026-04-20T11:00:00.000Z")
  },
  {
    id: "seed-bookmark-005",
    userId: "seed-user-citra",
    jobListingId: "seed-job-004",
    createdAt: date("2026-04-20T12:00:00.000Z")
  },
  {
    id: "seed-bookmark-006",
    userId: "seed-user-citra",
    jobListingId: "seed-job-005",
    createdAt: date("2026-04-20T13:00:00.000Z")
  },
  {
    id: "seed-bookmark-007",
    userId: "seed-user-dion",
    jobListingId: "seed-job-005",
    createdAt: date("2026-04-20T14:00:00.000Z")
  },
  {
    id: "seed-bookmark-008",
    userId: "seed-user-dion",
    jobListingId: "seed-job-002",
    createdAt: date("2026-04-20T15:00:00.000Z")
  },
  {
    id: "seed-bookmark-009",
    userId: "seed-user-eka",
    jobListingId: "seed-job-002",
    createdAt: date("2026-04-20T16:00:00.000Z")
  },
  {
    id: "seed-bookmark-010",
    userId: "seed-user-eka",
    jobListingId: "seed-job-005",
    createdAt: date("2026-04-20T17:00:00.000Z")
  }
]);

export const applicationRecords: SeedApplicationRecord[] =
  normalizeSeedReferences([
    {
      id: "seed-application-001",
      userId: "seed-user-annisa",
      jobListingId: "seed-job-001",
      status: "INTERVIEW",
      source: "MANUAL",
      notes: "Sudah lolos screening awal dan menunggu technical interview.",
      appliedAt: date("2026-04-18T09:00:00.000Z"),
      createdAt: date("2026-04-18T09:00:00.000Z"),
      updatedAt: date("2026-04-21T09:00:00.000Z")
    },
    {
      id: "seed-application-002",
      userId: "seed-user-bima",
      jobListingId: "seed-job-002",
      status: "APPLIED",
      source: "EXTERNAL_APPLY_CLICK",
      notes: "Applied melalui halaman eksternal JobStreet.",
      appliedAt: date("2026-04-19T09:00:00.000Z"),
      createdAt: date("2026-04-19T09:00:00.000Z"),
      updatedAt: date("2026-04-19T09:00:00.000Z")
    },
    {
      id: "seed-application-003",
      userId: "seed-user-citra",
      jobListingId: "seed-job-004",
      status: "REJECTED",
      source: "MANUAL",
      notes:
        "Profil dinilai belum cukup kuat untuk kebutuhan dashboard analytics yang kompleks.",
      appliedAt: date("2026-04-17T09:00:00.000Z"),
      createdAt: date("2026-04-17T09:00:00.000Z"),
      updatedAt: date("2026-04-22T09:00:00.000Z")
    },
    {
      id: "seed-application-004",
      userId: "seed-user-dion",
      jobListingId: "seed-job-005",
      status: "ACCEPTED",
      source: "MANUAL",
      notes: "Offer diterima untuk peran associate product manager.",
      appliedAt: date("2026-04-16T09:00:00.000Z"),
      createdAt: date("2026-04-16T09:00:00.000Z"),
      updatedAt: date("2026-04-23T09:00:00.000Z")
    },
    {
      id: "seed-application-005",
      userId: "seed-user-eka",
      jobListingId: "seed-job-002",
      status: "APPLIED",
      source: "MANUAL",
      notes:
        "Melamar untuk mengeksplor transisi ke product design yang lebih teknis.",
      appliedAt: date("2026-04-20T09:00:00.000Z"),
      createdAt: date("2026-04-20T09:00:00.000Z"),
      updatedAt: date("2026-04-20T09:00:00.000Z")
    }
  ]);

export const applicationHistories: SeedApplicationHistory[] =
  normalizeSeedReferences([
    {
      id: "seed-application-history-001",
      applicationRecordId: "seed-application-001",
      userId: "seed-user-annisa",
      fromStatus: null,
      toStatus: "APPLIED",
      notes: "Lamaran berhasil dibuat.",
      createdAt: date("2026-04-18T09:00:00.000Z")
    },
    {
      id: "seed-application-history-002",
      applicationRecordId: "seed-application-001",
      userId: "seed-user-annisa",
      fromStatus: "APPLIED",
      toStatus: "INTERVIEW",
      notes: "Recruiter menjadwalkan interview pertama.",
      createdAt: date("2026-04-21T09:00:00.000Z")
    },
    {
      id: "seed-application-history-003",
      applicationRecordId: "seed-application-002",
      userId: "seed-user-bima",
      fromStatus: null,
      toStatus: "APPLIED",
      notes: "Applied melalui tautan eksternal.",
      createdAt: date("2026-04-19T09:00:00.000Z")
    },
    {
      id: "seed-application-history-004",
      applicationRecordId: "seed-application-003",
      userId: "seed-user-citra",
      fromStatus: null,
      toStatus: "APPLIED",
      notes: "Lamaran untuk role data analyst terkirim.",
      createdAt: date("2026-04-17T09:00:00.000Z")
    },
    {
      id: "seed-application-history-005",
      applicationRecordId: "seed-application-003",
      userId: "seed-user-citra",
      fromStatus: "APPLIED",
      toStatus: "REJECTED",
      notes: "Aplikasi ditutup setelah review CV.",
      createdAt: date("2026-04-22T09:00:00.000Z")
    },
    {
      id: "seed-application-history-006",
      applicationRecordId: "seed-application-004",
      userId: "seed-user-dion",
      fromStatus: null,
      toStatus: "APPLIED",
      notes: "Lamaran masuk ke antrian review.",
      createdAt: date("2026-04-16T09:00:00.000Z")
    },
    {
      id: "seed-application-history-007",
      applicationRecordId: "seed-application-004",
      userId: "seed-user-dion",
      fromStatus: "APPLIED",
      toStatus: "INTERVIEW",
      notes: "Tahap interview user research selesai.",
      createdAt: date("2026-04-19T09:00:00.000Z")
    },
    {
      id: "seed-application-history-008",
      applicationRecordId: "seed-application-004",
      userId: "seed-user-dion",
      fromStatus: "INTERVIEW",
      toStatus: "ACCEPTED",
      notes: "Offer diterima pengguna.",
      createdAt: date("2026-04-23T09:00:00.000Z")
    },
    {
      id: "seed-application-history-009",
      applicationRecordId: "seed-application-005",
      userId: "seed-user-eka",
      fromStatus: null,
      toStatus: "APPLIED",
      notes: "Lamaran product design lintas fungsi dibuat secara manual.",
      createdAt: date("2026-04-20T09:00:00.000Z")
    }
  ]);

export const fitScoreResults: SeedFitScoreResult[] = normalizeSeedReferences([
  {
    id: "seed-fit-score-001",
    userId: "seed-user-annisa",
    jobListingId: "seed-job-001",
    fitScore: 87,
    readinessLevel: "READY",
    recommendationDecision: "PROCEED",
    recommendationSummary:
      "Profil backend Annisa sangat dekat dengan kebutuhan role dan hanya butuh penguatan pada operasional platform.",
    breakdown: {
      skillMatch: {
        score: 90,
        matchedSkills: ["TypeScript", "Node.js"],
        missingSkills: ["Docker"]
      },
      experienceMatch: {
        score: 83,
        reason: "Pengalaman dua tahun relevan untuk level junior backend."
      },
      preferenceMatch: {
        score: 88,
        matchedPreferences: ["Remote", "Jakarta"],
        unmatchedPreferences: []
      }
    },
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: {
      targetRoles: ["Backend Developer", "Platform Engineer"],
      jobTitle: "Backend Developer"
    },
    analyzedAt: date("2026-04-21T08:30:00.000Z"),
    createdAt: date("2026-04-21T08:30:00.000Z")
  },
  {
    id: "seed-fit-score-002",
    userId: "seed-user-bima",
    jobListingId: "seed-job-002",
    fitScore: 91,
    readinessLevel: "READY",
    recommendationDecision: "PROCEED",
    recommendationSummary:
      "Pengalaman frontend dan API Bima sangat cocok untuk role full stack.",
    breakdown: {
      skillMatch: {
        score: 94,
        matchedSkills: ["React", "TypeScript", "REST API"],
        missingSkills: []
      },
      experienceMatch: {
        score: 89,
        reason: "Sudah memiliki pengalaman end-to-end pada produk internal."
      },
      preferenceMatch: {
        score: 90,
        matchedPreferences: ["Hybrid", "Bandung"],
        unmatchedPreferences: []
      }
    },
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: {
      targetRoles: ["Full Stack Engineer"],
      jobTitle: "Full Stack Engineer"
    },
    analyzedAt: date("2026-04-21T09:00:00.000Z"),
    createdAt: date("2026-04-21T09:00:00.000Z")
  },
  {
    id: "seed-fit-score-003",
    userId: "seed-user-citra",
    jobListingId: "seed-job-004",
    fitScore: 74,
    readinessLevel: "NEAR_READY",
    recommendationDecision: "PROCEED_WITH_GAPS",
    recommendationSummary:
      "Citra cukup dekat untuk role data analyst, tetapi masih perlu jam terbang pada analisis bisnis nyata.",
    breakdown: {
      skillMatch: {
        score: 78,
        matchedSkills: ["SQL", "Data Analysis"],
        missingSkills: ["Stakeholder Communication"]
      },
      experienceMatch: {
        score: 66,
        reason: "Pengalaman masih dominan pada level magang."
      },
      preferenceMatch: {
        score: 82,
        matchedPreferences: ["Surabaya", "Hybrid"],
        unmatchedPreferences: []
      }
    },
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: {
      targetRoles: ["Data Analyst"],
      jobTitle: "Junior Data Analyst"
    },
    analyzedAt: date("2026-04-21T10:00:00.000Z"),
    createdAt: date("2026-04-21T10:00:00.000Z")
  },
  {
    id: "seed-fit-score-004",
    userId: "seed-user-dion",
    jobListingId: "seed-job-005",
    fitScore: 84,
    readinessLevel: "READY",
    recommendationDecision: "PROCEED",
    recommendationSummary:
      "Kekuatan Dion pada operasi dan koordinasi lintas tim relevan untuk role product manager tingkat associate.",
    breakdown: {
      skillMatch: {
        score: 80,
        matchedSkills: ["Project Management", "Data Analysis"],
        missingSkills: ["Product Discovery"]
      },
      experienceMatch: {
        score: 88,
        reason:
          "Memiliki pengalaman ownership proses dan dashboard operasional."
      },
      preferenceMatch: {
        score: 86,
        matchedPreferences: ["Remote"],
        unmatchedPreferences: []
      }
    },
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: {
      targetRoles: ["Associate Product Manager"],
      jobTitle: "Associate Product Manager"
    },
    analyzedAt: date("2026-04-21T11:00:00.000Z"),
    createdAt: date("2026-04-21T11:00:00.000Z")
  },
  {
    id: "seed-fit-score-005",
    userId: "seed-user-eka",
    jobListingId: "seed-job-002",
    fitScore: 69,
    readinessLevel: "NEAR_READY",
    recommendationDecision: "PROCEED_WITH_GAPS",
    recommendationSummary:
      "Eka punya dasar desain yang kuat, tetapi masih perlu penguatan kerja sama teknis dengan engineering.",
    breakdown: {
      skillMatch: {
        score: 65,
        matchedSkills: ["Figma"],
        missingSkills: ["React", "REST API"]
      },
      experienceMatch: {
        score: 72,
        reason:
          "Pengalaman desain produk cukup relevan untuk eksplorasi ke product design."
      },
      preferenceMatch: {
        score: 81,
        matchedPreferences: ["Remote"],
        unmatchedPreferences: ["Bandung"]
      }
    },
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: {
      targetRoles: ["UI/UX Designer"],
      jobTitle: "Full Stack Engineer"
    },
    analyzedAt: date("2026-04-21T12:00:00.000Z"),
    createdAt: date("2026-04-21T12:00:00.000Z")
  }
]);

export const skillGapResults: SeedSkillGapResult[] = normalizeSeedReferences([
  {
    id: "seed-skill-gap-001",
    userId: "seed-user-annisa",
    jobListingId: "seed-job-001",
    gaps: [
      {
        skill: "Docker",
        priority: "MEDIUM",
        reason: "Akan membantu untuk ownership deployment dan observability."
      }
    ],
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: { matchedSkillCount: 2, missingSkillCount: 1 },
    analyzedAt: date("2026-04-21T08:31:00.000Z"),
    createdAt: date("2026-04-21T08:31:00.000Z")
  },
  {
    id: "seed-skill-gap-002",
    userId: "seed-user-bima",
    jobListingId: "seed-job-002",
    gaps: [
      {
        skill: "Testing Strategy",
        priority: "LOW",
        reason: "Perlu penguatan pada automated testing lintas layer."
      }
    ],
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: { matchedSkillCount: 3, missingSkillCount: 1 },
    analyzedAt: date("2026-04-21T09:01:00.000Z"),
    createdAt: date("2026-04-21T09:01:00.000Z")
  },
  {
    id: "seed-skill-gap-003",
    userId: "seed-user-citra",
    jobListingId: "seed-job-004",
    gaps: [
      {
        skill: "Stakeholder Communication",
        priority: "MEDIUM",
        reason: "Peran membutuhkan penyampaian insight ke non-teknis."
      },
      {
        skill: "Dashboard Storytelling",
        priority: "LOW",
        reason:
          "Insight perlu diterjemahkan ke rekomendasi yang lebih operasional."
      }
    ],
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: { matchedSkillCount: 2, missingSkillCount: 2 },
    analyzedAt: date("2026-04-21T10:01:00.000Z"),
    createdAt: date("2026-04-21T10:01:00.000Z")
  },
  {
    id: "seed-skill-gap-004",
    userId: "seed-user-dion",
    jobListingId: "seed-job-005",
    gaps: [
      {
        skill: "Product Discovery",
        priority: "MEDIUM",
        reason: "Masih perlu struktur eksperimen dan riset produk."
      }
    ],
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: { matchedSkillCount: 2, missingSkillCount: 1 },
    analyzedAt: date("2026-04-21T11:01:00.000Z"),
    createdAt: date("2026-04-21T11:01:00.000Z")
  },
  {
    id: "seed-skill-gap-005",
    userId: "seed-user-eka",
    jobListingId: "seed-job-002",
    gaps: [
      {
        skill: "React",
        priority: "HIGH",
        reason:
          "Perlu pemahaman lebih dalam untuk kerja lintas frontend-engineering."
      },
      {
        skill: "REST API",
        priority: "MEDIUM",
        reason: "Penting untuk memahami batasan teknis saat mendesain flow."
      }
    ],
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    inputSummary: { matchedSkillCount: 1, missingSkillCount: 2 },
    analyzedAt: date("2026-04-21T12:01:00.000Z"),
    createdAt: date("2026-04-21T12:01:00.000Z")
  }
]);

export const cvFileMetadata: SeedCvFileMetadata[] = normalizeSeedReferences([
  {
    id: "seed-cv-file-001",
    userId: "seed-user-annisa",
    originalFileName: "annisa-pratama-backend-cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 245000,
    storageDriver: "LOCAL",
    storageKey: "cv/annisa-pratama-backend-cv.pdf",
    uploadedAt: date("2026-04-21T07:30:00.000Z"),
    expiresAt: date("2026-04-28T07:30:00.000Z"),
    deletedAt: null,
    createdAt: date("2026-04-21T07:30:00.000Z"),
    updatedAt: date("2026-04-21T07:30:00.000Z")
  },
  {
    id: "seed-cv-file-002",
    userId: "seed-user-bima",
    originalFileName: "bima-saputra-fullstack-cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 232000,
    storageDriver: "LOCAL",
    storageKey: "cv/bima-saputra-fullstack-cv.pdf",
    uploadedAt: date("2026-04-21T07:45:00.000Z"),
    expiresAt: date("2026-04-28T07:45:00.000Z"),
    deletedAt: null,
    createdAt: date("2026-04-21T07:45:00.000Z"),
    updatedAt: date("2026-04-21T07:45:00.000Z")
  },
  {
    id: "seed-cv-file-003",
    userId: "seed-user-citra",
    originalFileName: "citra-lestari-data-analyst-cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 210000,
    storageDriver: "LOCAL",
    storageKey: "cv/citra-lestari-data-analyst-cv.pdf",
    uploadedAt: date("2026-04-21T08:00:00.000Z"),
    expiresAt: date("2026-04-28T08:00:00.000Z"),
    deletedAt: null,
    createdAt: date("2026-04-21T08:00:00.000Z"),
    updatedAt: date("2026-04-21T08:00:00.000Z")
  },
  {
    id: "seed-cv-file-004",
    userId: "seed-user-dion",
    originalFileName: "dion-wijaya-product-ops-cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 255000,
    storageDriver: "LOCAL",
    storageKey: "cv/dion-wijaya-product-ops-cv.pdf",
    uploadedAt: date("2026-04-21T08:15:00.000Z"),
    expiresAt: date("2026-04-28T08:15:00.000Z"),
    deletedAt: null,
    createdAt: date("2026-04-21T08:15:00.000Z"),
    updatedAt: date("2026-04-21T08:15:00.000Z")
  },
  {
    id: "seed-cv-file-005",
    userId: "seed-user-eka",
    originalFileName: "eka-novita-product-design-cv.pdf",
    mimeType: "application/pdf",
    sizeBytes: 221000,
    storageDriver: "LOCAL",
    storageKey: "cv/eka-novita-product-design-cv.pdf",
    uploadedAt: date("2026-04-21T08:30:00.000Z"),
    expiresAt: date("2026-04-28T08:30:00.000Z"),
    deletedAt: null,
    createdAt: date("2026-04-21T08:30:00.000Z"),
    updatedAt: date("2026-04-21T08:30:00.000Z")
  }
]);

export const cvAnalysisResults: SeedCvAnalysisResult[] =
  normalizeSeedReferences([
    {
      id: "seed-cv-analysis-001",
      userId: "seed-user-annisa",
      jobListingId: "seed-job-001",
      cvFileMetadataId: "seed-cv-file-001",
      language: "ID",
      inputMode: "UPLOAD",
      compareSource: "BOOKMARK",
      overallImpression: {
        score: 88,
        summary: "CV sudah jelas dan relevan untuk role backend developer."
      },
      jobFitAlignment: {
        score: 86,
        summary:
          "Pengalaman API dan database sudah sangat dekat dengan kebutuhan role.",
        matchedSignals: ["Node.js", "TypeScript", "PostgreSQL"],
        missingSignals: ["Docker"]
      },
      atsFriendliness: {
        score: 91,
        issues: [
          "Tambahkan sedikit lebih banyak kata kunci tentang observability."
        ]
      },
      keywordOptimization: {
        recommendedKeywords: ["REST API", "Docker", "CI/CD"],
        reason: "Akan membantu menegaskan konteks platform engineering."
      },
      experienceQuantification: {
        score: 80,
        suggestions: [
          "Tambahkan metrik latency atau throughput dari API yang pernah dikerjakan."
        ]
      },
      actionableImprovements: [
        "Tambahkan satu bullet tentang monitoring dan deployment.",
        "Tegaskan dampak bisnis dari API yang dibangun."
      ],
      modelName: "gpt-5.4-mini",
      modelVersion: "2026-04",
      inputSummary: {
        jobTitle: "Backend Developer",
        compareSource: "BOOKMARK"
      },
      analyzedAt: date("2026-04-21T13:00:00.000Z"),
      createdAt: date("2026-04-21T13:00:00.000Z")
    },
    {
      id: "seed-cv-analysis-002",
      userId: "seed-user-bima",
      jobListingId: "seed-job-002",
      cvFileMetadataId: "seed-cv-file-002",
      language: "EN",
      inputMode: "UPLOAD",
      compareSource: "JOB_SEARCH",
      overallImpression: {
        score: 90,
        summary:
          "Resume structure is strong and maps well to full stack delivery work."
      },
      jobFitAlignment: {
        score: 92,
        summary: "Frontend and backend evidence is well balanced.",
        matchedSignals: ["React", "TypeScript", "REST API"],
        missingSignals: []
      },
      atsFriendliness: {
        score: 89,
        issues: ["Consider standardizing section names for achievements."]
      },
      keywordOptimization: {
        recommendedKeywords: ["Product delivery", "Testing", "API integration"],
        reason: "These keywords align with the hiring brief."
      },
      experienceQuantification: {
        score: 84,
        suggestions: [
          "Quantify feature adoption or internal efficiency impact."
        ]
      },
      actionableImprovements: [
        "Add one measurable impact for the latest role."
      ],
      modelName: "gpt-5.4-mini",
      modelVersion: "2026-04",
      inputSummary: {
        jobTitle: "Full Stack Engineer",
        compareSource: "JOB_SEARCH"
      },
      analyzedAt: date("2026-04-21T13:30:00.000Z"),
      createdAt: date("2026-04-21T13:30:00.000Z")
    },
    {
      id: "seed-cv-analysis-003",
      userId: "seed-user-citra",
      jobListingId: "seed-job-004",
      cvFileMetadataId: "seed-cv-file-003",
      language: "ID",
      inputMode: "UPLOAD",
      compareSource: "DIRECT_JOB_DETAIL",
      overallImpression: {
        score: 78,
        summary: "CV cukup rapi tetapi masih terasa akademis."
      },
      jobFitAlignment: {
        score: 74,
        summary:
          "Dasar analisis data sudah baik namun contoh insight bisnis perlu diperkuat.",
        matchedSignals: ["SQL", "Dashboard"],
        missingSignals: ["Business storytelling"]
      },
      atsFriendliness: {
        score: 85,
        issues: [
          "Ringkas bagian organisasi kampus agar fokus ke pengalaman analitik."
        ]
      },
      keywordOptimization: {
        recommendedKeywords: ["Funnel analysis", "Weekly reporting"],
        reason: "Kata kunci ini muncul dalam requirement lowongan."
      },
      experienceQuantification: {
        score: 70,
        suggestions: [
          "Tambahkan metrik jumlah dashboard atau stakeholder yang dilayani."
        ]
      },
      actionableImprovements: [
        "Tambahkan contoh insight yang memengaruhi keputusan tim.",
        "Sorot tools analitik yang paling dikuasai."
      ],
      modelName: "gpt-5.4-mini",
      modelVersion: "2026-04",
      inputSummary: {
        jobTitle: "Junior Data Analyst",
        compareSource: "DIRECT_JOB_DETAIL"
      },
      analyzedAt: date("2026-04-21T14:00:00.000Z"),
      createdAt: date("2026-04-21T14:00:00.000Z")
    },
    {
      id: "seed-cv-analysis-004",
      userId: "seed-user-dion",
      jobListingId: "seed-job-005",
      cvFileMetadataId: "seed-cv-file-004",
      language: "ID",
      inputMode: "UPLOAD",
      compareSource: "BOOKMARK",
      overallImpression: {
        score: 84,
        summary: "CV Dion memperlihatkan ownership operasional yang kuat."
      },
      jobFitAlignment: {
        score: 82,
        summary:
          "Relevansi terhadap product management terlihat dari koordinasi proses dan pengukuran KPI.",
        matchedSignals: ["Project management", "Cross-functional coordination"],
        missingSignals: ["Product discovery artifacts"]
      },
      atsFriendliness: {
        score: 87,
        issues: ["Tambahkan istilah product discovery dan experiment planning."]
      },
      keywordOptimization: {
        recommendedKeywords: [
          "Backlog prioritization",
          "Experiment",
          "Stakeholder alignment"
        ],
        reason: "Akan memperjelas transisi karier ke product."
      },
      experienceQuantification: {
        score: 79,
        suggestions: [
          "Tambahkan pengurangan SLA atau efisiensi proses yang dicapai."
        ]
      },
      actionableImprovements: [
        "Tambahkan satu studi kasus perubahan proses.",
        "Sorot pengalaman memimpin ritme meeting lintas tim."
      ],
      modelName: "gpt-5.4-mini",
      modelVersion: "2026-04",
      inputSummary: {
        jobTitle: "Associate Product Manager",
        compareSource: "BOOKMARK"
      },
      analyzedAt: date("2026-04-21T14:30:00.000Z"),
      createdAt: date("2026-04-21T14:30:00.000Z")
    },
    {
      id: "seed-cv-analysis-005",
      userId: "seed-user-eka",
      jobListingId: "seed-job-002",
      cvFileMetadataId: "seed-cv-file-005",
      language: "EN",
      inputMode: "UPLOAD",
      compareSource: "JOB_SEARCH",
      overallImpression: {
        score: 76,
        summary:
          "Design strengths are visible, but the narrative needs stronger technical collaboration evidence."
      },
      jobFitAlignment: {
        score: 68,
        summary:
          "The CV shows strong design process but limited engineering context for a full stack environment.",
        matchedSignals: ["Figma", "Collaboration"],
        missingSignals: ["React", "API collaboration"]
      },
      atsFriendliness: {
        score: 83,
        issues: ["Move portfolio highlights closer to the summary section."]
      },
      keywordOptimization: {
        recommendedKeywords: [
          "Design system",
          "Developer handoff",
          "Cross-functional execution"
        ],
        reason: "These terms support the targeted transition."
      },
      experienceQuantification: {
        score: 72,
        suggestions: [
          "Quantify conversion or completion improvements from shipped flows."
        ]
      },
      actionableImprovements: [
        "Emphasize design-to-engineering handoff.",
        "Add measurable results from the latest project."
      ],
      modelName: "gpt-5.4-mini",
      modelVersion: "2026-04",
      inputSummary: {
        jobTitle: "Full Stack Engineer",
        compareSource: "JOB_SEARCH"
      },
      analyzedAt: date("2026-04-21T15:00:00.000Z"),
      createdAt: date("2026-04-21T15:00:00.000Z")
    }
  ]);

export const aiRequestLogs: SeedAiRequestLog[] = normalizeSeedReferences([
  {
    id: "seed-ai-log-001",
    userId: "seed-user-annisa",
    kind: "JOB_FIT",
    status: "SUCCEEDED",
    requestId: "seed-job-fit-request-001",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1220,
    errorCode: null,
    inputSummary: { userId: "seed-user-annisa", jobId: "seed-job-001" },
    outputSummary: { fitScore: 87, readinessLevel: "READY" },
    createdAt: date("2026-04-21T08:31:00.000Z")
  },
  {
    id: "seed-ai-log-002",
    userId: "seed-user-bima",
    kind: "JOB_FIT",
    status: "SUCCEEDED",
    requestId: "seed-job-fit-request-002",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1190,
    errorCode: null,
    inputSummary: { userId: "seed-user-bima", jobId: "seed-job-002" },
    outputSummary: { fitScore: 91, readinessLevel: "READY" },
    createdAt: date("2026-04-21T09:01:00.000Z")
  },
  {
    id: "seed-ai-log-003",
    userId: "seed-user-citra",
    kind: "JOB_FIT",
    status: "SUCCEEDED",
    requestId: "seed-job-fit-request-003",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1380,
    errorCode: null,
    inputSummary: { userId: "seed-user-citra", jobId: "seed-job-004" },
    outputSummary: { fitScore: 74, readinessLevel: "NEAR_READY" },
    createdAt: date("2026-04-21T10:01:00.000Z")
  },
  {
    id: "seed-ai-log-004",
    userId: "seed-user-dion",
    kind: "JOB_FIT",
    status: "SUCCEEDED",
    requestId: "seed-job-fit-request-004",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1250,
    errorCode: null,
    inputSummary: { userId: "seed-user-dion", jobId: "seed-job-005" },
    outputSummary: { fitScore: 84, readinessLevel: "READY" },
    createdAt: date("2026-04-21T11:01:00.000Z")
  },
  {
    id: "seed-ai-log-005",
    userId: "seed-user-eka",
    kind: "JOB_FIT",
    status: "SUCCEEDED",
    requestId: "seed-job-fit-request-005",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1410,
    errorCode: null,
    inputSummary: { userId: "seed-user-eka", jobId: "seed-job-002" },
    outputSummary: { fitScore: 69, readinessLevel: "NEAR_READY" },
    createdAt: date("2026-04-21T12:01:00.000Z")
  },
  {
    id: "seed-ai-log-006",
    userId: "seed-user-annisa",
    kind: "CV_ANALYSIS",
    status: "SUCCEEDED",
    requestId: "seed-cv-analysis-request-001",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1520,
    errorCode: null,
    inputSummary: { userId: "seed-user-annisa", fileId: "seed-cv-file-001" },
    outputSummary: { overallScore: 88 },
    createdAt: date("2026-04-21T13:01:00.000Z")
  },
  {
    id: "seed-ai-log-007",
    userId: "seed-user-bima",
    kind: "CV_ANALYSIS",
    status: "SUCCEEDED",
    requestId: "seed-cv-analysis-request-002",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1490,
    errorCode: null,
    inputSummary: { userId: "seed-user-bima", fileId: "seed-cv-file-002" },
    outputSummary: { overallScore: 90 },
    createdAt: date("2026-04-21T13:31:00.000Z")
  },
  {
    id: "seed-ai-log-008",
    userId: "seed-user-citra",
    kind: "CV_ANALYSIS",
    status: "SUCCEEDED",
    requestId: "seed-cv-analysis-request-003",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 1580,
    errorCode: null,
    inputSummary: { userId: "seed-user-citra", fileId: "seed-cv-file-003" },
    outputSummary: { overallScore: 78 },
    createdAt: date("2026-04-21T14:01:00.000Z")
  },
  {
    id: "seed-ai-log-009",
    userId: "seed-user-dion",
    kind: "CV_ANALYSIS",
    status: "FAILED",
    requestId: "seed-cv-analysis-request-004",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 2010,
    errorCode: "MODEL_TIMEOUT",
    inputSummary: { userId: "seed-user-dion", fileId: "seed-cv-file-004" },
    outputSummary: { message: "Model request timed out on first attempt." },
    createdAt: date("2026-04-21T14:15:00.000Z")
  },
  {
    id: "seed-ai-log-010",
    userId: null,
    kind: "CV_ANALYSIS",
    status: "FAILED",
    requestId: "seed-cv-analysis-request-005",
    modelName: "gpt-5.4-mini",
    modelVersion: "2026-04",
    latencyMs: 980,
    errorCode: "UNAUTHENTICATED",
    inputSummary: { route: "/ai/cv-analyzer/analyze" },
    outputSummary: {
      message: "Request rejected because user session was missing."
    },
    createdAt: date("2026-04-21T15:10:00.000Z")
  }
]);
