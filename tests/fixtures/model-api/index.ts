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
  schemaVersion: "cv-analysis-v2";
  jobFitAlignment: {
    score: number;
    summary: string;
  };
  atsFriendliness: {
    score: number;
    summary: string;
  };
  overallImpression: string;
  topActionables: string[];
  sectionReviews: {
    sectionName: string;
    analysis: string;
    actionPoints: string[];
    whyItsImportantForYou: string;
  }[];
  jobRecommendations: {
    jobId: string | null;
    title: string;
    companyName: string | null;
    matchScore: number;
    reason: string;
    nextStep: string;
  }[];
  model: {
    name: string;
    version: string;
  };
  analyzedAt: string;
};

export type JobRecommendationModelResponseFixture = {
  recommendations: {
    jobId: string;
    matchScore: number;
    matchLevel: "strong" | "good" | "stretch";
    reasons: string[];
    matchedSkills: string[];
    missingSkills: string[];
    nextSteps: string[];
  }[];
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
    schemaVersion: "cv-analysis-v2",
    jobFitAlignment: {
      score: 78,
      summary: "Core skills are visible, but deployment depth is limited."
    },
    atsFriendliness: {
      score: 74,
      summary: "Structure is readable, but some keywords are still weak."
    },
    overallImpression:
      "The CV is relevant for an entry-level backend role, with the biggest gaps in deployment evidence and measurable impact.",
    topActionables: [
      "Add a stronger backend-focused profile summary.",
      "Add measurable API or project impact.",
      "Make deployment experience more explicit if available."
    ],
    sectionReviews: [
      {
        sectionName: "Relevant Skills",
        analysis: "Core backend skills are present but not grouped clearly.",
        actionPoints: [
          "Group skills into Backend, Database, and Deployment.",
          "Prioritize skills that match the target role."
        ],
        whyItsImportantForYou:
          "Recruiters and ATS often scan technical keywords before reading experience details."
      },
      {
        sectionName: "Work Experience",
        analysis:
          "Relevant experience exists, but impact is not quantified well.",
        actionPoints: [
          "Add metrics such as endpoint count, latency improvement, or system scale."
        ],
        whyItsImportantForYou:
          "Measured impact helps employers understand contribution, not only responsibilities."
      }
    ],
    jobRecommendations: [
      {
        jobId: "11111111-1111-4111-8111-111111111111",
        title: "Backend Developer",
        companyName: "Nusantara Tech",
        matchScore: 82,
        reason: "Role ini cocok dengan sinyal TypeScript dan REST API pada CV.",
        nextStep: "Perjelas bukti pengalaman deployment sebelum melamar."
      }
    ],
    model: {
      name: "fixture-cv-analyzer-model",
      version: "test-2026-01"
    },
    analyzedAt: "2026-04-23T00:00:00.000Z"
  },
  validJobRecommendationsResponse: {
    recommendations: [
      {
        jobId: "11111111-1111-4111-8111-111111111111",
        matchScore: 86,
        matchLevel: "strong",
        reasons: ["Kecocokan skill backend utama sudah kuat."],
        matchedSkills: ["TypeScript", "PostgreSQL"],
        missingSkills: ["Docker"],
        nextSteps: ["Tambahkan pengalaman deployment di CV."]
      },
      {
        jobId: "22222222-2222-4222-8222-222222222222",
        matchScore: 74,
        matchLevel: "good",
        reasons: ["Role sejalan dengan target karier."],
        matchedSkills: ["TypeScript"],
        missingSkills: ["System Design"],
        nextSteps: ["Perkuat contoh arsitektur layanan."]
      }
    ],
    model: {
      name: "fixture-job-recommendations-model",
      version: "test-2026-01"
    },
    analyzedAt: "2026-04-23T00:00:00.000Z"
  }
} satisfies {
  validJobFitResponse: JobFitModelResponseFixture;
  degradedJobFitResponse: JobFitModelResponseFixture;
  validCvAnalyzerResponse: CvAnalyzerModelResponseFixture;
  validJobRecommendationsResponse: JobRecommendationModelResponseFixture;
};
