import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { companies, jobs, skills, sourcePlatforms } from "./seed-data";

const databaseUrl =
  process.env.DIRECT_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/bisakerja_api";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl
  })
});

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
