export type SeedJob = {
  sourceSlug: string;
  companySlug: string;
  externalJobId: string;
  title: string;
  normalizedTitle: string;
  category: string;
  description: string;
  requirementSummary: string;
  workType: "REMOTE" | "HYBRID" | "ONSITE";
  employmentType: "FULL_TIME" | "INTERNSHIP" | "CONTRACT";
  experienceLevel: "ENTRY_LEVEL" | "JUNIOR" | "MID_LEVEL";
  locationDisplay: string;
  province: string;
  city: string;
  salaryMin: number;
  salaryMax: number;
  sourceUrl: string;
  externalApplyUrl: string;
  sourcePostedAt: Date;
  lastSeenAt: Date;
  requirements: Array<{
    type: "SKILL" | "EXPERIENCE" | "RESPONSIBILITY";
    value: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }>;
  skillSlugs: string[];
};

export const sourcePlatforms = [
  {
    slug: "glints",
    name: "Glints",
    baseUrl: "https://glints.com"
  },
  {
    slug: "jobstreet",
    name: "Jobstreet",
    baseUrl: "https://www.jobstreet.co.id"
  },
  {
    slug: "kalibrr",
    name: "Kalibrr",
    baseUrl: "https://www.kalibrr.com"
  },
  {
    slug: "dealls",
    name: "Dealls",
    baseUrl: "https://dealls.com"
  }
];

export const skills = [
  { slug: "typescript", name: "TypeScript", category: "Programming" },
  { slug: "postgresql", name: "PostgreSQL", category: "Database" },
  { slug: "rest-api", name: "REST API", category: "Backend" },
  { slug: "docker", name: "Docker", category: "DevOps" },
  { slug: "node-js", name: "Node.js", category: "Backend" }
];

export const companies = [
  {
    slug: "nusantara-tech",
    name: "Nusantara Tech",
    websiteUrl: "https://example.test/nusantara-tech"
  },
  {
    slug: "cakrawala-digital",
    name: "Cakrawala Digital",
    websiteUrl: "https://example.test/cakrawala-digital"
  },
  {
    slug: "merah-putih-labs",
    name: "Merah Putih Labs",
    websiteUrl: "https://example.test/merah-putih-labs"
  }
];

export const jobs: SeedJob[] = [
  {
    sourceSlug: "glints",
    companySlug: "nusantara-tech",
    externalJobId: "glints-backend-001",
    title: "Backend Developer",
    normalizedTitle: "backend developer",
    category: "Engineering",
    description: "Build and maintain TypeScript APIs for job discovery.",
    requirementSummary: "TypeScript, REST API, and PostgreSQL fundamentals.",
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    locationDisplay: "Jakarta Selatan, DKI Jakarta",
    province: "DKI Jakarta",
    city: "Jakarta Selatan",
    salaryMin: 5000000,
    salaryMax: 10000000,
    sourceUrl: "https://glints.com/example/backend-developer",
    externalApplyUrl: "https://glints.com/example/backend-developer/apply",
    sourcePostedAt: new Date("2026-04-20T00:00:00.000Z"),
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    requirements: [
      { type: "SKILL", value: "TypeScript", priority: "HIGH" },
      { type: "SKILL", value: "PostgreSQL", priority: "MEDIUM" },
      {
        type: "RESPONSIBILITY",
        value: "Build REST APIs with clear contracts.",
        priority: "HIGH"
      }
    ],
    skillSlugs: ["typescript", "postgresql", "rest-api"]
  },
  {
    sourceSlug: "jobstreet",
    companySlug: "cakrawala-digital",
    externalJobId: "jobstreet-fullstack-001",
    title: "Junior Full Stack Developer",
    normalizedTitle: "full stack developer",
    category: "Engineering",
    description: "Work on frontend and backend features for internal products.",
    requirementSummary: "Node.js, TypeScript, and product engineering basics.",
    workType: "HYBRID",
    employmentType: "FULL_TIME",
    experienceLevel: "JUNIOR",
    locationDisplay: "Bandung, Jawa Barat",
    province: "Jawa Barat",
    city: "Bandung",
    salaryMin: 6000000,
    salaryMax: 11000000,
    sourceUrl: "https://www.jobstreet.co.id/example/fullstack",
    externalApplyUrl: "https://www.jobstreet.co.id/example/fullstack/apply",
    sourcePostedAt: new Date("2026-04-19T00:00:00.000Z"),
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    requirements: [
      { type: "SKILL", value: "Node.js", priority: "HIGH" },
      { type: "SKILL", value: "TypeScript", priority: "MEDIUM" },
      { type: "EXPERIENCE", value: "0-2 years experience.", priority: "LOW" }
    ],
    skillSlugs: ["node-js", "typescript", "rest-api"]
  },
  {
    sourceSlug: "kalibrr",
    companySlug: "merah-putih-labs",
    externalJobId: "kalibrr-devops-001",
    title: "Backend Platform Engineer",
    normalizedTitle: "backend platform engineer",
    category: "Platform",
    description: "Improve backend reliability and deployment workflows.",
    requirementSummary:
      "Backend development, Docker, and database reliability.",
    workType: "ONSITE",
    employmentType: "CONTRACT",
    experienceLevel: "MID_LEVEL",
    locationDisplay: "Sleman, DI Yogyakarta",
    province: "DI Yogyakarta",
    city: "Sleman",
    salaryMin: 9000000,
    salaryMax: 15000000,
    sourceUrl: "https://www.kalibrr.com/example/backend-platform",
    externalApplyUrl: "https://www.kalibrr.com/example/backend-platform/apply",
    sourcePostedAt: new Date("2026-04-18T00:00:00.000Z"),
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    requirements: [
      { type: "SKILL", value: "Docker", priority: "HIGH" },
      { type: "SKILL", value: "PostgreSQL", priority: "HIGH" },
      {
        type: "RESPONSIBILITY",
        value: "Maintain backend service reliability.",
        priority: "MEDIUM"
      }
    ],
    skillSlugs: ["docker", "postgresql", "node-js"]
  },
  {
    sourceSlug: "dealls",
    companySlug: "nusantara-tech",
    externalJobId: "dealls-intern-001",
    title: "Software Engineer Intern",
    normalizedTitle: "software engineer intern",
    category: "Engineering",
    description: "Learn and contribute to backend API features.",
    requirementSummary: "Internship role for early-career software engineers.",
    workType: "REMOTE",
    employmentType: "INTERNSHIP",
    experienceLevel: "ENTRY_LEVEL",
    locationDisplay: "Indonesia",
    province: "Indonesia",
    city: "Remote",
    salaryMin: 2000000,
    salaryMax: 4000000,
    sourceUrl: "https://dealls.com/example/software-engineer-intern",
    externalApplyUrl:
      "https://dealls.com/example/software-engineer-intern/apply",
    sourcePostedAt: new Date("2026-04-17T00:00:00.000Z"),
    lastSeenAt: new Date("2026-04-22T00:00:00.000Z"),
    requirements: [
      { type: "SKILL", value: "REST API", priority: "MEDIUM" },
      { type: "SKILL", value: "TypeScript", priority: "MEDIUM" },
      {
        type: "EXPERIENCE",
        value: "Portfolio or coursework is acceptable.",
        priority: "LOW"
      }
    ],
    skillSlugs: ["rest-api", "typescript"]
  }
];
