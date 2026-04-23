export type JobFitModelResponseFixture = {
  fitScore: number;
  readiness: "READY" | "NEEDS_PREPARATION" | "NOT_READY";
  matchedSkills: string[];
  missingSkills: string[];
  recommendations: string[];
  model: {
    name: string;
    version: string;
  };
};

export const modelApiFixtures = {
  validJobFitResponse: {
    fitScore: 82,
    readiness: "READY",
    matchedSkills: ["TypeScript", "PostgreSQL"],
    missingSkills: ["System Design"],
    recommendations: ["Add recent API project impact to the profile."],
    model: {
      name: "fixture-job-fit-model",
      version: "test-2026-01"
    }
  },
  degradedJobFitResponse: {
    fitScore: 0,
    readiness: "NOT_READY",
    matchedSkills: [],
    missingSkills: [],
    recommendations: [],
    model: {
      name: "fixture-job-fit-model",
      version: "test-2026-01"
    }
  }
} satisfies Record<string, JobFitModelResponseFixture>;
