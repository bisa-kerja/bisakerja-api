import { jobFixtures, sourcePlatformFixtures } from "../jobs";

export const normalizedScraperJobFixtures = jobFixtures.map((job) => {
  const sourcePlatform = sourcePlatformFixtures.find(
    (source) => source.id === job.sourcePlatformId
  );

  if (!sourcePlatform) {
    throw new Error(`Missing source platform fixture for ${job.id}`);
  }

  return {
    sourcePlatform: {
      slug: sourcePlatform.slug,
      name: sourcePlatform.name
    },
    externalJobId: job.externalJobId,
    title: job.title,
    companyName: job.companyName,
    location: {
      city: job.city,
      province: job.province
    },
    workType: job.workType,
    employmentType: job.employmentType,
    sourceUrl: job.sourceUrl,
    discoveredAt: job.discoveredAt,
    skills: job.skills
  };
});
