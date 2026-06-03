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
  schemaVersion: "model-core-cv-analysis-v1";
  parsedCv: {
    status: "parsed" | "empty_text" | "parse_failed";
    pageCount: number;
    textLength: number;
    detectedSections: string[];
    extractionEvidence?: string[];
  };
  jobFitAlignment: {
    score: number;
    matchedSignals: string[];
    missingSignals: string[];
    matchedSkills: string[];
    missingSkills: string[];
    evidence?: string[];
  };
  atsFriendliness: {
    score: number;
    detectedIssues: string[];
    parseQuality: "high" | "medium" | "low" | "failed";
    evidence?: string[];
  };
  overallImpression: {
    score: number;
    evidence: string[];
  };
  candidateReranking: {
    recommendations: {
      jobId: string;
      matchScore: number;
      matchLevel: "strong" | "good" | "stretch";
      matchedSkills: string[];
      missingSkills: string[];
      rankingSignals?: string[];
    }[];
  };
  model: {
    name: string;
    version: string;
  };
  createdAt: string;
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
    schemaVersion: "model-core-cv-analysis-v1",
    parsedCv: {
      status: "parsed",
      pageCount: 2,
      textLength: 2400,
      detectedSections: ["Skills", "Work Experience"],
      extractionEvidence: ["PDF text parsed"]
    },
    jobFitAlignment: {
      score: 78,
      matchedSignals: ["Backend skill evidence"],
      missingSignals: ["Deployment depth limited"],
      matchedSkills: ["TypeScript", "PostgreSQL"],
      missingSkills: ["Docker"],
      evidence: ["Core skills are visible"]
    },
    atsFriendliness: {
      score: 74,
      detectedIssues: ["Weak keyword grouping"],
      parseQuality: "medium",
      evidence: ["Sections detected"]
    },
    overallImpression: {
      score: 76,
      evidence: ["entry-level backend alignment", "deployment gap"]
    },
    candidateReranking: {
      recommendations: [
        {
          jobId: "11111111-1111-4111-8111-111111111111",
          matchScore: 82,
          matchLevel: "strong",
          matchedSkills: ["TypeScript", "PostgreSQL"],
          missingSkills: ["Docker"],
          rankingSignals: ["Skill overlap"]
        }
      ]
    },
    model: {
      name: "fixture-cv-analyzer-model",
      version: "test-2026-01"
    },
    createdAt: "2026-04-23T00:00:00.000Z"
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
