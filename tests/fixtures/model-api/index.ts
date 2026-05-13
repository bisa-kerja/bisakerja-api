export type JobFitModelResponseFixture = {
  fitScore: number;
  readinessLevel:
    | "READY"
    | "READY_WITH_MINOR_GAPS"
    | "NEEDS_PREPARATION"
    | "NOT_RECOMMENDED_YET";
  recommendation: {
    decision:
      | "APPLY_NOW"
      | "IMPROVE_FIRST"
      | "SAVE_FOR_LATER"
      | "NOT_RECOMMENDED";
    summary: string;
    nextSteps: string[];
    successProbability: number;
  };
  breakdown: {
    skillMatch: {
      score: number;
      matchedSkills: string[];
      missingSkills: string[];
    };
    experienceMatch: {
      score: number;
      reason: string;
    };
    preferenceMatch: {
      score: number;
      matchedPreferences: string[];
      unmatchedPreferences: string[];
    };
  };
  skillGaps: {
    skill: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
    reason: string;
  }[];
  model: {
    name: string;
    version: string;
  };
  analyzedAt: string;
};

export type CvAnalyzerModelResponseFixture = {
  overallImpression: {
    score: number;
    summary: string;
  };
  jobFitAlignment: {
    score: number;
    summary: string;
    matchedSignals: string[];
    missingSignals: string[];
  };
  atsFriendliness: {
    score: number;
    issues: string[];
  };
  keywordOptimization: {
    recommendedKeywords: string[];
    reason: string;
  };
  experienceQuantification: {
    score: number;
    suggestions: string[];
  };
  actionableImprovements: string[];
  model: {
    name: string;
    version: string;
  };
  analyzedAt: string;
};

export const modelApiFixtures = {
  validJobFitResponse: {
    fitScore: 82,
    readinessLevel: "READY_WITH_MINOR_GAPS",
    recommendation: {
      decision: "APPLY_NOW",
      summary: "Core backend requirements are already covered.",
      nextSteps: ["Highlight recent API impact in the CV."],
      successProbability: 0.72
    },
    breakdown: {
      skillMatch: {
        score: 85,
        matchedSkills: ["TypeScript", "PostgreSQL"],
        missingSkills: ["System Design"]
      },
      experienceMatch: {
        score: 78,
        reason: "Recent internship work is aligned with the role."
      },
      preferenceMatch: {
        score: 90,
        matchedPreferences: ["REMOTE", "DKI Jakarta"],
        unmatchedPreferences: []
      }
    },
    skillGaps: [
      {
        skill: "System Design",
        priority: "MEDIUM",
        reason: "The role expects basic architecture reasoning."
      }
    ],
    model: {
      name: "fixture-job-fit-model",
      version: "test-2026-01"
    },
    analyzedAt: "2026-04-23T00:00:00.000Z"
  },
  degradedJobFitResponse: {
    fitScore: 0,
    readinessLevel: "NOT_RECOMMENDED_YET",
    recommendation: {
      decision: "IMPROVE_FIRST",
      summary: "Current profile does not meet the core requirements yet.",
      nextSteps: [],
      successProbability: 0
    },
    breakdown: {
      skillMatch: {
        score: 0,
        matchedSkills: [],
        missingSkills: []
      },
      experienceMatch: {
        score: 0,
        reason: "No aligned experience found."
      },
      preferenceMatch: {
        score: 0,
        matchedPreferences: [],
        unmatchedPreferences: []
      }
    },
    skillGaps: [],
    model: {
      name: "fixture-job-fit-model",
      version: "test-2026-01"
    },
    analyzedAt: "2026-04-23T00:00:00.000Z"
  },
  validCvAnalyzerResponse: {
    overallImpression: {
      score: 85,
      summary: "The CV is relevant for an entry-level backend role."
    },
    jobFitAlignment: {
      score: 78,
      summary: "Core skills are visible, but deployment depth is limited.",
      matchedSignals: ["TypeScript", "REST API"],
      missingSignals: ["Docker", "CI/CD"]
    },
    atsFriendliness: {
      score: 74,
      issues: ["Section headings are inconsistent."]
    },
    keywordOptimization: {
      recommendedKeywords: ["Docker", "CI/CD"],
      reason: "These keywords appear in the job requirements."
    },
    experienceQuantification: {
      score: 70,
      suggestions: ["Add endpoint counts or measurable project impact."]
    },
    actionableImprovements: ["Add a stronger backend-focused profile summary."],
    model: {
      name: "fixture-cv-analyzer-model",
      version: "test-2026-01"
    },
    analyzedAt: "2026-04-23T00:00:00.000Z"
  }
} satisfies {
  validJobFitResponse: JobFitModelResponseFixture;
  degradedJobFitResponse: JobFitModelResponseFixture;
  validCvAnalyzerResponse: CvAnalyzerModelResponseFixture;
};
