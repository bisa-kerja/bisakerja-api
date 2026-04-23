export type SourcePlatformFixture = {
  id: string;
  slug: "glints" | "jobstreet" | "kalibrr" | "dealls";
  name: string;
};

export type JobFixture = {
  id: string;
  sourcePlatformId: string;
  externalJobId: string;
  companyName: string;
  title: string;
  city: string;
  province: string;
  workType: "REMOTE" | "HYBRID" | "ONSITE";
  employmentType: "FULL_TIME" | "CONTRACT" | "INTERNSHIP";
  sourceUrl: string;
  discoveredAt: string;
  skills: string[];
};

export const sourcePlatformFixtures = [
  {
    id: "source_glints",
    slug: "glints",
    name: "Glints"
  },
  {
    id: "source_jobstreet",
    slug: "jobstreet",
    name: "Jobstreet"
  },
  {
    id: "source_kalibrr",
    slug: "kalibrr",
    name: "Kalibrr"
  },
  {
    id: "source_dealls",
    slug: "dealls",
    name: "Dealls"
  }
] satisfies SourcePlatformFixture[];

export const jobFixtures = [
  {
    id: "job_backend_001",
    sourcePlatformId: "source_glints",
    externalJobId: "glints-backend-001",
    companyName: "Contoh Teknologi",
    title: "Backend Engineer",
    city: "Jakarta Selatan",
    province: "DKI Jakarta",
    workType: "HYBRID",
    employmentType: "FULL_TIME",
    sourceUrl: "https://example.test/jobs/glints-backend-001",
    discoveredAt: "2026-01-01T00:00:00.000Z",
    skills: ["TypeScript", "PostgreSQL", "REST API"]
  },
  {
    id: "job_data_001",
    sourcePlatformId: "source_jobstreet",
    externalJobId: "jobstreet-data-001",
    companyName: "Data Nusantara",
    title: "Data Analyst",
    city: "Bandung",
    province: "Jawa Barat",
    workType: "REMOTE",
    employmentType: "CONTRACT",
    sourceUrl: "https://example.test/jobs/jobstreet-data-001",
    discoveredAt: "2026-01-02T00:00:00.000Z",
    skills: ["SQL", "Dashboarding", "Analytics"]
  }
] satisfies JobFixture[];
