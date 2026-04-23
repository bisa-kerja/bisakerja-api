import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/bisakerja_api";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl
  })
});

const sourcePlatforms = [
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

const skills = [
  { slug: "typescript", name: "TypeScript", category: "Programming" },
  { slug: "postgresql", name: "PostgreSQL", category: "Database" },
  { slug: "rest-api", name: "REST API", category: "Backend" },
  { slug: "docker", name: "Docker", category: "DevOps" },
  { slug: "node-js", name: "Node.js", category: "Backend" }
];

const companies = [
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

type SeedJob = {
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

const jobs: SeedJob[] = [
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

async function main() {
  for (const sourcePlatform of sourcePlatforms) {
    await prisma.sourcePlatform.upsert({
      where: { slug: sourcePlatform.slug },
      update: sourcePlatform,
      create: sourcePlatform
    });
  }

  for (const skill of skills) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      update: skill,
      create: skill
    });
  }

  for (const company of companies) {
    const existing = await prisma.company.findFirst({
      where: { slug: company.slug }
    });

    if (existing) {
      await prisma.company.update({
        where: { id: existing.id },
        data: company
      });
    } else {
      await prisma.company.create({
        data: company
      });
    }
  }

  for (const job of jobs) {
    const sourcePlatform = await prisma.sourcePlatform.findUniqueOrThrow({
      where: { slug: job.sourceSlug }
    });
    const company = await prisma.company.findFirstOrThrow({
      where: { slug: job.companySlug }
    });

    const jobListing = await prisma.jobListing.upsert({
      where: {
        sourcePlatformId_externalJobId: {
          sourcePlatformId: sourcePlatform.id,
          externalJobId: job.externalJobId
        }
      },
      update: {
        companyId: company.id,
        title: job.title,
        normalizedTitle: job.normalizedTitle,
        category: job.category,
        description: job.description,
        requirementSummary: job.requirementSummary,
        workType: job.workType,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        locationDisplay: job.locationDisplay,
        province: job.province,
        city: job.city,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryPeriod: "MONTHLY",
        sourceUrl: job.sourceUrl,
        externalApplyUrl: job.externalApplyUrl,
        sourcePostedAt: job.sourcePostedAt,
        lastSeenAt: job.lastSeenAt,
        status: "ACTIVE"
      },
      create: {
        sourcePlatformId: sourcePlatform.id,
        companyId: company.id,
        externalJobId: job.externalJobId,
        title: job.title,
        normalizedTitle: job.normalizedTitle,
        category: job.category,
        description: job.description,
        requirementSummary: job.requirementSummary,
        workType: job.workType,
        employmentType: job.employmentType,
        experienceLevel: job.experienceLevel,
        locationDisplay: job.locationDisplay,
        province: job.province,
        city: job.city,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryPeriod: "MONTHLY",
        sourceUrl: job.sourceUrl,
        externalApplyUrl: job.externalApplyUrl,
        sourcePostedAt: job.sourcePostedAt,
        lastSeenAt: job.lastSeenAt,
        status: "ACTIVE"
      }
    });

    await prisma.jobRequirement.deleteMany({
      where: { jobListingId: jobListing.id }
    });
    await prisma.jobRequirement.createMany({
      data: job.requirements.map((requirement, index) => ({
        jobListingId: jobListing.id,
        ...requirement,
        sortOrder: index
      }))
    });

    await prisma.jobSkill.deleteMany({
      where: { jobListingId: jobListing.id }
    });
    for (const skillSlug of job.skillSlugs) {
      const skill = await prisma.skill.findUniqueOrThrow({
        where: { slug: skillSlug }
      });
      await prisma.jobSkill.create({
        data: {
          jobListingId: jobListing.id,
          skillId: skill.id,
          confidence: "1.0000"
        }
      });
    }
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  });
