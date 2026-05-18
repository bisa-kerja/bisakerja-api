import type { AppConfig } from "@/config/env";

type OpenApiSchema = Record<string, unknown>;
type OpenApiDocument = Record<string, unknown>;

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const jsonContent = (schema: OpenApiSchema, example?: unknown) => ({
  "application/json": {
    schema,
    ...(example === undefined ? {} : { example })
  }
});

const nullSchema = { type: "null" } as const;
const uuidSchema = {
  type: "string",
  format: "uuid",
  example: "550e8400-e29b-41d4-a716-446655440000"
} as const;
const requestIdSchema = {
  type: "string",
  example: "req_1234567890"
} as const;
const isoDateSchema = {
  type: "string",
  format: "date",
  example: "2026-04-24"
} as const;
const isoDateTimeSchema = {
  type: "string",
  format: "date-time",
  example: "2026-04-24T08:00:00.000Z"
} as const;

function successEnvelopeSchema(
  dataSchema: OpenApiSchema,
  metaSchema: OpenApiSchema
) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["success", "message", "data", "meta"],
    properties: {
      success: { type: "boolean", const: true },
      message: { type: "string" },
      data: dataSchema,
      meta: metaSchema
    }
  } satisfies OpenApiSchema;
}

function listMetaSchema(
  filtersExample?: Record<string, unknown>,
  sortExample?: string
) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["pagination"],
    properties: {
      pagination: ref("PaginationMeta"),
      filters: {
        type: "object",
        additionalProperties: true,
        example: filtersExample ?? {}
      },
      sort: {
        type: "string",
        ...(sortExample ? { example: sortExample } : {})
      }
    }
  } satisfies OpenApiSchema;
}

function jsonResponse(
  description: string,
  schema: OpenApiSchema,
  example?: unknown
) {
  return {
    description,
    content: jsonContent(schema, example)
  };
}

function errorResponse(
  description: string,
  code: string,
  message: string,
  statusSpecificDetails: unknown = null
) {
  return jsonResponse(description, ref("ErrorEnvelope"), {
    success: false,
    message,
    data: null,
    error: {
      code,
      details: statusSpecificDetails,
      requestId: "req_1234567890"
    }
  });
}

function validationErrorResponse(
  examplePath: string,
  exampleMessage: string,
  exampleCode = "invalid_format"
) {
  return jsonResponse("Validasi gagal", ref("ErrorEnvelope"), {
    success: false,
    message: "Validasi gagal",
    data: null,
    error: {
      code: "VALIDATION_ERROR",
      details: [
        {
          path: examplePath,
          message: exampleMessage,
          code: exampleCode
        }
      ],
      requestId: "req_1234567890"
    }
  });
}

function authValidationAndRateLimitResponses() {
  return {
    "422": validationErrorResponse(
      "email",
      "Email tidak valid. Gunakan format email lengkap, contoh nama@domain.com"
    ),
    "429": errorResponse(
      "Rate limit exceeded.",
      "RATE_LIMITED",
      "Terlalu banyak permintaan",
      {
        limit: "auth"
      }
    )
  };
}

function bearerSecurity() {
  return [{ bearerAuth: [] }];
}

export function buildOpenApiDocument(config: AppConfig): OpenApiDocument {
  const registerExample = {
    username: "salman",
    email: "salman@example.com",
    phoneNumber: "+6281234567890",
    password: "StrongPassword123!",
    confirmPassword: "StrongPassword123!"
  };
  const loginExample = {
    identifier: "salman@example.com",
    password: "StrongPassword123!"
  };
  const authUserExample = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    username: "salman",
    email: "salman@example.com",
    emailVerified: true,
    onboardingStatus: "COMPLETED",
    createdAt: "2026-04-24T08:00:00.000Z"
  };
  const authSessionExample = {
    accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example",
    expiresIn: 900,
    tokenType: "Bearer"
  };
  const jobCardExample = {
    id: "550e8400-e29b-41d4-a716-446655440010",
    title: "Backend Developer",
    company: {
      id: "550e8400-e29b-41d4-a716-446655440011",
      name: "Example Tech",
      logoUrl: "https://cdn.example.com/company-logo.png"
    },
    sourcePlatform: {
      id: "550e8400-e29b-41d4-a716-446655440012",
      name: "Glints",
      slug: "glints"
    },
    workType: "REMOTE",
    employmentType: "FULL_TIME",
    experienceLevel: "ENTRY_LEVEL",
    location: {
      display: "Jakarta Selatan, DKI Jakarta",
      province: "DKI Jakarta",
      city: "Jakarta Selatan"
    },
    salary: {
      min: 5000000,
      max: 10000000,
      currency: "IDR",
      period: "MONTHLY",
      display: "Rp5.000.000 - Rp10.000.000 / bulan"
    },
    postedAt: "2026-04-20T00:00:00.000Z",
    lastSeenAt: "2026-04-24T08:00:00.000Z",
    isStale: false
  };
  const scraperJobsSyncExample = {
    jobs: [
      {
        sourcePlatform: { slug: "glints", name: "Glints" },
        company: {
          name: "Example Tech",
          sourceCompanyId: null,
          sourceSlug: "example-tech",
          logoUrl: "https://cdn.example.com/company-logo.png",
          websiteUrl: "https://example.com",
          industry: null
        },
        ingestionRun: { sourceRunId: "scheduled-20260505-scrape" },
        jobListing: {
          externalJobId: "glints-123",
          title: "Backend Developer",
          normalizedTitle: "backend developer",
          category: "Engineering",
          description: "Build and maintain backend APIs.",
          requirementSummary: "TypeScript and PostgreSQL.",
          workType: "REMOTE",
          employmentType: "FULL_TIME",
          experienceLevel: "ENTRY_LEVEL",
          locationDisplay: "Jakarta Selatan, DKI Jakarta",
          province: "DKI Jakarta",
          city: "Jakarta Selatan",
          salaryMin: 5000000,
          salaryMax: 10000000,
          salaryCurrency: "IDR",
          salaryPeriod: "MONTHLY",
          salaryDisplay: "Rp5.000.000 - Rp10.000.000 / bulan",
          sourceUrl: "https://glints.example/job/123",
          externalApplyUrl: "https://glints.example/job/123/apply",
          sourcePostedAt: "2026-04-20T00:00:00.000Z",
          sourceUpdatedAt: null,
          lastSeenAt: "2026-05-05T00:00:00.000Z",
          status: "ACTIVE"
        },
        requirements: [
          {
            type: "SKILL",
            value: "TypeScript",
            priority: "HIGH",
            confidence: 0.9,
            source: "ai"
          }
        ],
        skills: [{ name: "TypeScript", confidence: 0.9, source: "ai" }]
      }
    ]
  };
  const notificationEventsExample = {
    runId: "scheduled-20260505-sync",
    candidates: [
      {
        eventId: "scheduled-20260505-sync:glints:glints-123",
        syncEventId: "sync-event-123",
        sourcePlatform: "glints",
        externalJobId: "glints-123",
        title: "Backend Developer",
        companyName: "Example Tech",
        sourceUrl: "https://glints.example/job/123",
        location: { display: "Jakarta Selatan, DKI Jakarta" },
        salary: { min_amount: 5000000, max_amount: 10000000 },
        status: "active",
        lastSeenAt: "2026-05-05T00:00:00.000Z"
      }
    ]
  };
  const currentUserExample = {
    id: "550e8400-e29b-41d4-a716-446655440001",
    username: "salman",
    email: "salman@example.com",
    emailVerified: true,
    phoneNumber: "+6281234567890",
    displayName: "Salman Abdurrahman",
    profilePhoto: {
      url: "https://cdn.example.com/profile-photos/user_123/avatar.jpg",
      mimeType: "image/jpeg",
      sizeBytes: 512000
    },
    onboardingStatus: "IN_PROGRESS",
    profile: {
      careerStatus: "FRESH_GRADUATE",
      latestRole: "Backend Developer",
      summary: "Early-career backend developer focused on TypeScript APIs."
    },
    skills: [
      {
        id: "550e8400-e29b-41d4-a716-446655440020",
        name: "TypeScript",
        level: "INTERMEDIATE"
      }
    ],
    experience: [
      {
        id: "550e8400-e29b-41d4-a716-446655440021",
        title: "Backend Developer Intern",
        company: "Example Tech",
        employmentType: "INTERNSHIP",
        startDate: "2025-01-01",
        endDate: "2025-06-30",
        isCurrent: false,
        description: "Built REST APIs with TypeScript."
      }
    ],
    education: [
      {
        id: "550e8400-e29b-41d4-a716-446655440022",
        institution: "Universitas Contoh",
        degree: "Bachelor",
        fieldOfStudy: "Informatics",
        startYear: 2021,
        endYear: 2025
      }
    ],
    createdAt: "2026-04-24T08:00:00.000Z",
    updatedAt: "2026-04-24T08:00:00.000Z"
  };
  const preferencesExample = {
    id: "550e8400-e29b-41d4-a716-446655440030",
    careerStatus: "FRESH_GRADUATE",
    jobSeekingStatus: "IMMEDIATE",
    targetRoles: ["Backend Developer", "Full Stack Developer"],
    locations: [
      {
        province: "DKI Jakarta",
        city: "Jakarta Selatan"
      }
    ],
    workTypes: ["REMOTE", "HYBRID"],
    salaryExpectation: {
      min: 5000000,
      max: 10000000,
      currency: "IDR",
      period: "MONTHLY"
    },
    emailNotificationsEnabled: true,
    createdAt: "2026-04-24T08:00:00.000Z",
    updatedAt: "2026-04-24T08:00:00.000Z"
  };
  const bookmarkExample = {
    id: "550e8400-e29b-41d4-a716-446655440040",
    job: jobCardExample,
    createdAt: "2026-04-24T08:00:00.000Z"
  };
  const applicationExample = {
    id: "550e8400-e29b-41d4-a716-446655440050",
    status: "APPLIED",
    notes: "Applied from Glints after reviewing fit score.",
    source: "EXTERNAL_APPLY_CLICK",
    appliedAt: "2026-04-24T08:00:00.000Z",
    updatedAt: "2026-04-24T08:00:00.000Z",
    job: jobCardExample
  };
  const jobFitExample = {
    jobId: "550e8400-e29b-41d4-a716-446655440010",
    fitScore: 82,
    readinessLevel: "READY_WITH_MINOR_GAPS",
    recommendation: {
      decision: "APPLY_NOW",
      summary:
        "You match the core backend requirements, with minor gaps in deployment experience.",
      nextSteps: [
        "Highlight TypeScript API experience in your CV.",
        "Review PostgreSQL query optimization basics.",
        "Prepare examples of backend project impact."
      ],
      successProbability: 0.68
    },
    breakdown: {
      skillMatch: {
        score: 85,
        matchedSkills: ["TypeScript", "PostgreSQL"],
        missingSkills: ["Docker"]
      },
      experienceMatch: {
        score: 75,
        reason:
          "Internship experience is aligned with entry-level backend responsibilities."
      },
      preferenceMatch: {
        score: 90,
        matchedPreferences: ["REMOTE", "DKI Jakarta"],
        unmatchedPreferences: []
      }
    },
    skillGaps: [
      {
        skill: "Docker",
        priority: "MEDIUM",
        reason: "The job mentions containerized deployment experience."
      }
    ],
    model: {
      name: "job-fit-model",
      version: "v1"
    },
    analyzedAt: "2026-04-24T08:00:00.000Z"
  };
  const cvAnalysisExample = {
    jobId: "550e8400-e29b-41d4-a716-446655440010",
    language: "id",
    overallImpression: {
      score: 85,
      summary:
        "CV sudah relevan untuk role backend entry-level, terutama pada pengalaman TypeScript API."
    },
    jobFitAlignment: {
      score: 78,
      summary:
        "Skill utama sesuai, tetapi pengalaman deployment masih perlu diperkuat.",
      matchedSignals: ["TypeScript", "REST API", "PostgreSQL"],
      missingSignals: ["Docker", "CI/CD"]
    },
    atsFriendliness: {
      score: 74,
      issues: [
        "Beberapa section belum memakai heading standar.",
        "Keyword deployment belum cukup terlihat."
      ]
    },
    keywordOptimization: {
      recommendedKeywords: ["Docker", "CI/CD", "API Documentation"],
      reason:
        "Keyword ini muncul pada requirement dan relevan dengan backend role."
    },
    experienceQuantification: {
      score: 70,
      suggestions: [
        "Tambahkan metrik jumlah endpoint yang dibuat.",
        "Tambahkan dampak performa atau reliability jika tersedia."
      ]
    },
    actionableImprovements: [
      "Tambahkan ringkasan 2-3 kalimat yang menonjolkan backend API experience.",
      "Tambahkan keyword Docker jika memang pernah digunakan.",
      "Ubah bullet experience agar menyertakan angka atau dampak."
    ],
    generatedCv: {
      available: false,
      note: "Generated CV is future scope."
    },
    model: {
      name: "cv-analyzer-model",
      version: "v1"
    },
    analyzedAt: "2026-04-24T08:00:00.000Z"
  };
  const cvFileExample = {
    id: "550e8400-e29b-41d4-a716-446655440030",
    originalFileName: "resume.pdf",
    mimeType: "application/pdf",
    sizeBytes: 284321,
    uploadedAt: "2026-05-18T10:00:00.000Z",
    expiresAt: "2026-05-19T10:00:00.000Z",
    isActive: true
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Bisakerja Backend API",
      version: "0.1.0",
      description:
        "OpenAPI reference for the Bisakerja Backend API. This document is the canonical source for the built-in Scalar API reference and covers public, authenticated, and AI-assisted routes shipped by the current runtime registry."
    },
    servers: [
      {
        url: "/",
        description: "Current deployment origin"
      }
    ],
    tags: [
      {
        name: "Health",
        description: "Infrastructure liveness and readiness checks."
      },
      {
        name: "Auth",
        description: "Account registration, login, session, and recovery flows."
      },
      {
        name: "Jobs",
        description: "Public normalized job listing search and detail."
      },
      {
        name: "Internal",
        description: "Service-token protected scraper sync and handoff routes."
      },
      {
        name: "Users",
        description: "Current-user profile and onboarding-related profile data."
      },
      {
        name: "Preferences",
        description: "Current-user career preference settings."
      },
      { name: "Bookmarks", description: "Current-user saved jobs." },
      {
        name: "Applications",
        description: "Current-user application tracker records."
      },
      {
        name: "AI Job Fit",
        description: "Authenticated AI-based job fit analysis."
      },
      {
        name: "AI CV Analyzer",
        description: "Authenticated CV analysis against a selected job."
      }
    ],
    paths: {
      "/health/live": {
        get: {
          tags: ["Health"],
          summary: "Liveness check",
          description:
            "Confirms the API process can respond to HTTP requests. This route does not verify downstream dependencies.",
          responses: {
            "200": jsonResponse(
              "Service is live.",
              successEnvelopeSchema(ref("HealthLiveData"), nullSchema),
              {
                success: true,
                message: "Layanan aktif",
                data: {
                  service: "bisakerja-api",
                  status: "live",
                  env: config.app.env
                },
                meta: null
              }
            )
          }
        }
      },
      "/health/ready": {
        get: {
          tags: ["Health"],
          summary: "Readiness check",
          description:
            "Confirms the runtime is ready to serve traffic and verifies critical dependencies such as PostgreSQL.",
          responses: {
            "200": jsonResponse(
              "Service is ready.",
              successEnvelopeSchema(ref("HealthReadyData"), nullSchema),
              {
                success: true,
                message: "Layanan siap",
                data: {
                  service: "bisakerja-api",
                  status: "ready",
                  env: config.app.env,
                  dependencies: {
                    postgresql: "healthy"
                  }
                },
                meta: null
              }
            ),
            "503": errorResponse(
              "A required dependency is unavailable.",
              "SERVICE_UNAVAILABLE",
              "Layanan belum siap",
              {
                dependencies: {
                  postgresql: "unhealthy"
                }
              }
            )
          }
        }
      },
      "/api/v1/auth/register": {
        post: {
          tags: ["Auth"],
          summary: "Register a new account",
          description:
            "Creates a user account, starts the email verification flow, and returns an access-only onboarding session. No refresh cookie is set until email verification.",
          requestBody: {
            required: true,
            content: jsonContent(ref("RegisterRequest"), registerExample)
          },
          responses: {
            "201": jsonResponse(
              "Account registered successfully.",
              successEnvelopeSchema(
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["user", "session"],
                  properties: {
                    user: ref("AuthUser"),
                    session: ref("AuthSession")
                  }
                },
                nullSchema
              ),
              {
                success: true,
                message:
                  "Akun berhasil didaftarkan. Silakan verifikasi email Anda.",
                data: {
                  user: {
                    ...authUserExample,
                    emailVerified: false,
                    onboardingStatus: "PENDING"
                  },
                  session: authSessionExample
                },
                meta: null
              }
            ),
            "409": errorResponse(
              "Email or username already exists.",
              "EMAIL_ALREADY_REGISTERED",
              "Email sudah terdaftar"
            ),
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/auth/login": {
        post: {
          tags: ["Auth"],
          summary: "Login",
          description:
            "Authenticates with email or username and password, then returns an access token while setting the refresh token cookie.",
          requestBody: {
            required: true,
            content: jsonContent(ref("LoginRequest"), loginExample)
          },
          responses: {
            "200": {
              description: "Login successful.",
              headers: {
                "Set-Cookie": {
                  description: `Refresh token cookie (${config.auth.refreshCookieName}).`,
                  schema: {
                    type: "string"
                  }
                }
              },
              content: jsonContent(
                successEnvelopeSchema(
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["user", "session"],
                    properties: {
                      user: ref("AuthUser"),
                      session: ref("AuthSession")
                    }
                  },
                  nullSchema
                ),
                {
                  success: true,
                  message: "Login berhasil",
                  data: {
                    user: authUserExample,
                    session: authSessionExample
                  },
                  meta: null
                }
              )
            },
            "401": errorResponse(
              "Credentials are invalid.",
              "INVALID_CREDENTIALS",
              "Email, username, atau kata sandi tidak valid"
            ),
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/auth/refresh": {
        post: {
          tags: ["Auth"],
          summary: "Refresh session",
          description:
            "Issues a new access token using the refresh token cookie.",
          security: [{ refreshTokenCookie: [] }],
          requestBody: {
            required: false,
            content: jsonContent(
              {
                type: "object",
                additionalProperties: false
              },
              {}
            )
          },
          responses: {
            "200": {
              description: "Session refreshed.",
              headers: {
                "Set-Cookie": {
                  description: `Rotated refresh token cookie (${config.auth.refreshCookieName}).`,
                  schema: {
                    type: "string"
                  }
                }
              },
              content: jsonContent(
                successEnvelopeSchema(
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["user", "session"],
                    properties: {
                      user: ref("AuthUser"),
                      session: ref("AuthSession")
                    }
                  },
                  nullSchema
                ),
                {
                  success: true,
                  message: "Sesi berhasil diperbarui",
                  data: {
                    user: authUserExample,
                    session: authSessionExample
                  },
                  meta: null
                }
              )
            },
            "401": errorResponse(
              "Refresh cookie is missing or invalid.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/auth/logout": {
        post: {
          tags: ["Auth"],
          summary: "Logout",
          description:
            "Invalidates the current session and clears the refresh token cookie.",
          security: bearerSecurity(),
          requestBody: {
            required: false,
            content: jsonContent(
              {
                type: "object",
                additionalProperties: false
              },
              {}
            )
          },
          responses: {
            "200": {
              description: "Logout successful.",
              headers: {
                "Set-Cookie": {
                  description: `Cleared refresh token cookie (${config.auth.refreshCookieName}).`,
                  schema: {
                    type: "string"
                  }
                }
              },
              content: jsonContent(
                successEnvelopeSchema(nullSchema, nullSchema),
                {
                  success: true,
                  message: "Logout berhasil",
                  data: null,
                  meta: null
                }
              )
            },
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/auth/forgot-password": {
        post: {
          tags: ["Auth"],
          summary: "Request password reset",
          description:
            "Sends password reset instructions when the email exists. The response is intentionally generic for security.",
          requestBody: {
            required: true,
            content: jsonContent(ref("ForgotPasswordRequest"), {
              email: "salman@example.com"
            })
          },
          responses: {
            "200": jsonResponse(
              "Password reset request accepted.",
              successEnvelopeSchema(nullSchema, nullSchema),
              {
                success: true,
                message:
                  "Jika email terdaftar, instruksi reset kata sandi akan dikirim.",
                data: null,
                meta: null
              }
            ),
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/auth/reset-password": {
        post: {
          tags: ["Auth"],
          summary: "Reset password",
          description: "Sets a new password when the reset token is valid.",
          requestBody: {
            required: true,
            content: jsonContent(ref("ResetPasswordRequest"), {
              token: "reset_token_1234567890abcdef1234567890abcd",
              password: "NewStrongPassword123!",
              confirmPassword: "NewStrongPassword123!"
            })
          },
          responses: {
            "200": jsonResponse(
              "Password reset successful.",
              successEnvelopeSchema(nullSchema, nullSchema),
              {
                success: true,
                message: "Reset kata sandi berhasil",
                data: null,
                meta: null
              }
            ),
            "401": errorResponse(
              "Reset token is expired or invalid.",
              "PASSWORD_RESET_TOKEN_INVALID",
              "Token reset kata sandi tidak valid"
            ),
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/auth/verify-email": {
        post: {
          tags: ["Auth"],
          summary: "Verify email",
          description:
            "Verifies email ownership using the OTP code sent by email, then auto-logs in the user by returning a session and setting the refresh cookie.",
          requestBody: {
            required: true,
            content: jsonContent(ref("VerifyEmailRequest"), {
              email: "salman@example.com",
              otp: "123456"
            })
          },
          responses: {
            "200": {
              description: "Email verified successfully.",
              headers: {
                "Set-Cookie": {
                  description: `Refresh token cookie (${config.auth.refreshCookieName}).`,
                  schema: {
                    type: "string"
                  }
                }
              },
              content: jsonContent(
                successEnvelopeSchema(
                  {
                    type: "object",
                    additionalProperties: false,
                    required: ["user", "session"],
                    properties: {
                      user: ref("AuthUser"),
                      session: ref("AuthSession")
                    }
                  },
                  nullSchema
                ),
                {
                  success: true,
                  message: "Email berhasil diverifikasi",
                  data: {
                    user: authUserExample,
                    session: authSessionExample
                  },
                  meta: null
                }
              )
            },
            "401": errorResponse(
              "Email verification OTP is expired or invalid.",
              "EMAIL_VERIFICATION_INVALID",
              "OTP verifikasi email tidak valid"
            ),
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/auth/google": {
        get: {
          tags: ["Auth"],
          summary: "Start Google OAuth login",
          description:
            "Generates a Google OAuth authorize URL and sets short-lived HttpOnly cookies for state and nonce validation.",
          responses: {
            "200": jsonResponse(
              "Google authorize URL created.",
              successEnvelopeSchema(
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["authorizeUrl"],
                  properties: {
                    authorizeUrl: {
                      type: "string",
                      example:
                        "https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=...&redirect_uri=...&scope=openid%20email%20profile&state=...&nonce=..."
                    }
                  }
                },
                nullSchema
              ),
              {
                success: true,
                message: "URL login Google berhasil dibuat",
                data: {
                  authorizeUrl:
                    "https://accounts.google.com/o/oauth2/v2/auth?..."
                },
                meta: null
              }
            ),
            "501": errorResponse(
              "Google SSO is not configured.",
              "GOOGLE_SSO_NOT_CONFIGURED",
              "Google SSO belum dikonfigurasi"
            ),
            "429": errorResponse(
              "Rate limit exceeded.",
              "RATE_LIMITED",
              "Terlalu banyak permintaan",
              {
                limit: "auth"
              }
            )
          }
        },
        post: {
          tags: ["Auth"],
          summary: "Exchange Google OAuth code",
          description:
            "Exchanges the Google authorization code for an ID token, verifies it, links or creates the user account, and issues a backend session.",
          requestBody: {
            required: true,
            content: jsonContent({
              type: "object",
              additionalProperties: false,
              required: ["code", "state"],
              properties: {
                code: { type: "string" },
                state: { type: "string" }
              }
            })
          },
          responses: {
            "200": jsonResponse(
              "Google login succeeded.",
              successEnvelopeSchema(
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["user", "session"],
                  properties: {
                    user: ref("AuthUser"),
                    session: ref("AuthSession")
                  }
                },
                nullSchema
              ),
              {
                success: true,
                message: "Login Google berhasil",
                data: {
                  user: authUserExample,
                  session: authSessionExample
                },
                meta: null
              }
            ),
            "400": errorResponse(
              "OAuth state mismatch.",
              "GOOGLE_OAUTH_STATE_INVALID",
              "State Google tidak valid"
            ),
            "409": errorResponse(
              "Google account already linked.",
              "GOOGLE_OAUTH_ACCOUNT_ALREADY_LINKED",
              "Akun sudah terhubung dengan akun Google lain"
            ),
            "501": errorResponse(
              "Google SSO is not configured.",
              "GOOGLE_SSO_NOT_CONFIGURED",
              "Google SSO belum dikonfigurasi"
            ),
            ...authValidationAndRateLimitResponses()
          }
        }
      },
      "/api/v1/internal/scraper/jobs": {
        post: {
          tags: ["Internal"],
          summary: "Sync scraper jobs",
          description:
            "Service-token protected batch upsert endpoint used by Scraper API to publish normalized jobs into backend-owned read models.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(
              {
                type: "object",
                additionalProperties: false,
                required: ["jobs"],
                properties: {
                  jobs: {
                    type: "array",
                    minItems: 1,
                    maxItems: 100,
                    items: { type: "object", additionalProperties: true }
                  }
                }
              },
              scraperJobsSyncExample
            )
          },
          responses: {
            "200": jsonResponse(
              "Scraper jobs synced successfully.",
              successEnvelopeSchema(
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["accepted", "upserted", "jobs"],
                  properties: {
                    accepted: { type: "integer", minimum: 0 },
                    upserted: { type: "integer", minimum: 0 },
                    jobs: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        required: [
                          "externalJobId",
                          "sourcePlatform",
                          "jobId",
                          "action"
                        ],
                        properties: {
                          externalJobId: { type: "string" },
                          sourcePlatform: { type: "string" },
                          jobId: uuidSchema,
                          action: {
                            type: "string",
                            enum: ["created", "updated"]
                          }
                        }
                      }
                    }
                  }
                },
                nullSchema
              )
            ),
            "401": errorResponse(
              "Service token is missing or invalid.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "body.jobs",
              "Daftar lowongan wajib berisi minimal 1 item"
            )
          }
        }
      },
      "/api/v1/internal/notification-events": {
        post: {
          tags: ["Internal"],
          summary: "Accept notification handoff events",
          description:
            "Service-token protected handoff endpoint used by Scraper API after successful job sync.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(
              {
                type: "object",
                additionalProperties: false,
                required: ["runId", "candidates"],
                properties: {
                  runId: { type: "string" },
                  candidates: {
                    type: "array",
                    maxItems: 1000,
                    items: { type: "object", additionalProperties: true }
                  }
                }
              },
              notificationEventsExample
            )
          },
          responses: {
            "200": jsonResponse(
              "Notification events accepted.",
              successEnvelopeSchema(
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["accepted", "runId"],
                  properties: {
                    accepted: { type: "integer", minimum: 0 },
                    runId: { type: "string" }
                  }
                },
                nullSchema
              )
            ),
            "401": errorResponse(
              "Service token is missing or invalid.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "body.candidates",
              "Daftar kandidat notifikasi wajib diisi"
            )
          }
        }
      },
      "/api/v1/jobs": {
        get: {
          tags: ["Jobs"],
          summary: "List jobs",
          description:
            "Searches, filters, sorts, and paginates normalized public job listings.",
          parameters: [
            {
              in: "query",
              name: "page",
              schema: { type: "integer", minimum: 1, default: 1 }
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }
            },
            {
              in: "query",
              name: "keyword",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "location",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "province",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "city",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "workType",
              schema: { type: "string", enum: ["REMOTE", "HYBRID", "ONSITE"] }
            },
            {
              in: "query",
              name: "employmentType",
              schema: {
                type: "string",
                enum: [
                  "FULL_TIME",
                  "PART_TIME",
                  "INTERNSHIP",
                  "CONTRACT",
                  "FREELANCE"
                ]
              }
            },
            {
              in: "query",
              name: "experienceLevel",
              schema: {
                type: "string",
                enum: ["ENTRY_LEVEL", "JUNIOR", "MID_LEVEL", "SENIOR", "LEAD"]
              }
            },
            {
              in: "query",
              name: "salaryMin",
              schema: { type: "integer", minimum: 0 }
            },
            {
              in: "query",
              name: "salaryMax",
              schema: { type: "integer", minimum: 0 }
            },
            {
              in: "query",
              name: "sourcePlatform",
              schema: {
                type: "string",
                pattern: "^[a-z0-9-]+$",
                maxLength: 80
              }
            },
            {
              in: "query",
              name: "skill",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "category",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "sort",
              schema: {
                type: "string",
                enum: [
                  "relevance",
                  "newest",
                  "salary_highest",
                  "salary_lowest"
                ],
                default: "relevance"
              }
            }
          ],
          responses: {
            "200": jsonResponse(
              "Jobs retrieved successfully.",
              successEnvelopeSchema(
                {
                  type: "array",
                  items: ref("JobCard")
                },
                listMetaSchema(
                  {
                    keyword: "backend",
                    workType: "REMOTE"
                  },
                  "relevance"
                )
              ),
              {
                success: true,
                message: "Daftar lowongan berhasil diambil",
                data: [jobCardExample],
                meta: {
                  pagination: {
                    page: 1,
                    limit: 20,
                    total: 100,
                    totalPages: 5,
                    hasNextPage: true,
                    hasPrevPage: false
                  },
                  filters: {
                    keyword: "backend",
                    workType: "REMOTE"
                  },
                  sort: "relevance"
                }
              }
            ),
            "422": validationErrorResponse(
              "salaryMax",
              "Gaji maksimum harus lebih besar atau sama dengan gaji minimum",
              "custom"
            )
          }
        }
      },
      "/api/v1/jobs/{jobId}": {
        get: {
          tags: ["Jobs"],
          summary: "Get job detail",
          description:
            "Returns normalized job detail for a visible job listing.",
          parameters: [
            {
              in: "path",
              name: "jobId",
              required: true,
              schema: uuidSchema
            }
          ],
          responses: {
            "200": jsonResponse(
              "Job retrieved successfully.",
              successEnvelopeSchema(ref("JobDetail"), nullSchema),
              {
                success: true,
                message: "Lowongan berhasil diambil",
                data: {
                  ...jobCardExample,
                  company: {
                    ...jobCardExample.company,
                    websiteUrl: "https://example.com"
                  },
                  description: "Build and maintain backend APIs.",
                  requirements: [
                    {
                      type: "SKILL",
                      value: "TypeScript",
                      priority: "HIGH"
                    }
                  ],
                  skills: ["TypeScript", "PostgreSQL", "REST API"],
                  externalApplyUrl: "https://glints.com/example-job"
                },
                meta: null
              }
            ),
            "404": errorResponse(
              "Job is not found.",
              "JOB_NOT_FOUND",
              "Lowongan tidak ditemukan"
            ),
            "422": validationErrorResponse(
              "jobId",
              "ID lowongan tidak valid. Gunakan UUID yang benar"
            )
          }
        }
      },
      "/api/v1/me": {
        get: {
          tags: ["Users"],
          summary: "Get current user profile",
          description:
            "Returns the authenticated user's current profile and onboarding-related data.",
          security: bearerSecurity(),
          responses: {
            "200": jsonResponse(
              "Profile retrieved successfully.",
              successEnvelopeSchema(ref("CurrentUser"), nullSchema),
              {
                success: true,
                message: "Profil berhasil diambil",
                data: currentUserExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            )
          }
        },
        patch: {
          tags: ["Users"],
          summary: "Update current user profile",
          description:
            "Updates basic current-user account fields such as username, phone number, and display name.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("UpdateCurrentUserRequest"), {
              username: "salman",
              phoneNumber: "+6281234567890",
              displayName: "Salman Abdurrahman"
            })
          },
          responses: {
            "200": jsonResponse(
              "Profile updated successfully.",
              successEnvelopeSchema(ref("CurrentUser"), nullSchema),
              {
                success: true,
                message: "Profil berhasil diperbarui",
                data: currentUserExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "409": errorResponse(
              "Username is already used.",
              "USERNAME_ALREADY_REGISTERED",
              "Username sudah terdaftar"
            ),
            "422": validationErrorResponse(
              "",
              "Minimal satu data profil harus diisi",
              "custom"
            )
          }
        }
      },
      "/api/v1/me/profile-photo": {
        put: {
          tags: ["Users"],
          summary: "Upsert profile photo metadata",
          description:
            "Stores profile photo metadata for the authenticated user. The upload transport is managed separately from this route.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("ProfilePhotoUpsertRequest"), {
              storageKey: "profile-photos/user_123/avatar.jpg",
              url: "https://cdn.example.com/profile-photos/user_123/avatar.jpg",
              mimeType: "image/jpeg",
              sizeBytes: 512000
            })
          },
          responses: {
            "200": jsonResponse(
              "Profile photo updated successfully.",
              successEnvelopeSchema(ref("CurrentUser"), nullSchema),
              {
                success: true,
                message: "Foto profil berhasil diperbarui",
                data: currentUserExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "mimeType",
              "Tipe file tidak didukung. Gunakan image/jpeg, image/png, atau image/webp"
            )
          }
        }
      },
      "/api/v1/me/skills": {
        put: {
          tags: ["Users"],
          summary: "Replace skills",
          description: "Replaces the authenticated user's skill list.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("ReplaceSkillsRequest"), {
              skills: [
                {
                  name: "TypeScript",
                  level: "INTERMEDIATE"
                },
                {
                  name: "PostgreSQL",
                  level: "BASIC"
                }
              ]
            })
          },
          responses: {
            "200": jsonResponse(
              "Skills updated successfully.",
              successEnvelopeSchema(ref("CurrentUser"), nullSchema),
              {
                success: true,
                message: "Keahlian berhasil diperbarui",
                data: currentUserExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "skills.0.name",
              "Nama keahlian tidak boleh duplikat dalam daftar yang sama",
              "custom"
            )
          }
        }
      },
      "/api/v1/me/experience": {
        put: {
          tags: ["Users"],
          summary: "Replace experience",
          description: "Replaces the authenticated user's experience entries.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("ReplaceExperienceRequest"), {
              experience: [
                {
                  title: "Backend Developer Intern",
                  company: "Example Tech",
                  employmentType: "INTERNSHIP",
                  startDate: "2025-01-01",
                  endDate: "2025-06-30",
                  isCurrent: false,
                  description: "Built REST APIs with TypeScript."
                }
              ]
            })
          },
          responses: {
            "200": jsonResponse(
              "Experience updated successfully.",
              successEnvelopeSchema(ref("CurrentUser"), nullSchema),
              {
                success: true,
                message: "Pengalaman berhasil diperbarui",
                data: currentUserExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "experience.0.endDate",
              "Tanggal selesai harus lebih besar atau sama dengan tanggal mulai",
              "custom"
            )
          }
        }
      },
      "/api/v1/me/education": {
        put: {
          tags: ["Users"],
          summary: "Replace education",
          description: "Replaces the authenticated user's education entries.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("ReplaceEducationRequest"), {
              education: [
                {
                  institution: "Universitas Contoh",
                  degree: "Bachelor",
                  fieldOfStudy: "Informatics",
                  startYear: 2021,
                  endYear: 2025
                }
              ]
            })
          },
          responses: {
            "200": jsonResponse(
              "Education updated successfully.",
              successEnvelopeSchema(ref("CurrentUser"), nullSchema),
              {
                success: true,
                message: "Pendidikan berhasil diperbarui",
                data: currentUserExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "education.0.endYear",
              "Tahun selesai harus lebih besar atau sama dengan tahun mulai",
              "custom"
            )
          }
        }
      },
      "/api/v1/me/preferences": {
        get: {
          tags: ["Preferences"],
          summary: "Get preferences",
          description:
            "Returns the current user's active career preferences. This route also accepts the register-issued onboarding access token before email OTP verification.",
          security: bearerSecurity(),
          responses: {
            "200": jsonResponse(
              "Preferences retrieved successfully.",
              successEnvelopeSchema(ref("Preferences"), nullSchema),
              {
                success: true,
                message: "Preferensi berhasil diambil",
                data: preferencesExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Preferences do not exist yet.",
              "PREFERENCES_NOT_FOUND",
              "Preferensi tidak ditemukan"
            )
          }
        },
        put: {
          tags: ["Preferences"],
          summary: "Replace preferences",
          description:
            "Creates or replaces the current user's active career preferences. This route also accepts the register-issued onboarding access token before email OTP verification.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("PreferencesUpsertRequest"), {
              careerStatus: "FRESH_GRADUATE",
              jobSeekingStatus: "IMMEDIATE",
              targetRoles: ["Backend Developer", "Full Stack Developer"],
              locations: [
                {
                  province: "DKI Jakarta",
                  city: "Jakarta Selatan"
                }
              ],
              workTypes: ["REMOTE", "HYBRID"],
              salaryExpectation: {
                min: 5000000,
                max: 10000000,
                currency: "IDR",
                period: "MONTHLY"
              },
              emailNotificationsEnabled: true
            })
          },
          responses: {
            "200": jsonResponse(
              "Preferences saved successfully.",
              successEnvelopeSchema(ref("Preferences"), nullSchema),
              {
                success: true,
                message: "Preferensi berhasil disimpan",
                data: preferencesExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "salaryExpectation.max",
              "Ekspektasi gaji maksimum harus lebih besar atau sama dengan minimum",
              "custom"
            )
          }
        },
        patch: {
          tags: ["Preferences"],
          summary: "Patch preferences",
          description:
            "Applies a partial update to the current user's active career preferences. This route also accepts the register-issued onboarding access token before email OTP verification.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("PreferencesPatchRequest"), {
              workTypes: ["REMOTE"],
              emailNotificationsEnabled: false
            })
          },
          responses: {
            "200": jsonResponse(
              "Preferences updated successfully.",
              successEnvelopeSchema(ref("Preferences"), nullSchema),
              {
                success: true,
                message: "Preferensi berhasil diperbarui",
                data: {
                  ...preferencesExample,
                  workTypes: ["REMOTE"],
                  emailNotificationsEnabled: false
                },
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "workTypes",
              "Minimal satu tipe kerja wajib diisi",
              "too_small"
            )
          }
        }
      },
      "/api/v1/me/bookmarks": {
        get: {
          tags: ["Bookmarks"],
          summary: "List bookmarks",
          description: "Returns paginated current-user bookmarks.",
          security: bearerSecurity(),
          parameters: [
            {
              in: "query",
              name: "page",
              schema: { type: "integer", minimum: 1, default: 1 }
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }
            },
            {
              in: "query",
              name: "keyword",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "sort",
              schema: {
                type: "string",
                enum: [
                  "created_desc",
                  "updated_desc",
                  "newest",
                  "salary_highest",
                  "salary_lowest"
                ],
                default: "created_desc"
              }
            }
          ],
          responses: {
            "200": jsonResponse(
              "Bookmarks retrieved successfully.",
              successEnvelopeSchema(
                {
                  type: "array",
                  items: ref("BookmarkResource")
                },
                listMetaSchema({ keyword: "backend" }, "created_desc")
              ),
              {
                success: true,
                message: "Daftar bookmark berhasil diambil",
                data: [bookmarkExample],
                meta: {
                  pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false
                  },
                  filters: {
                    keyword: "backend"
                  },
                  sort: "created_desc"
                }
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "sort",
              "Urutan tidak didukung. Gunakan nilai urutan yang tersedia"
            )
          }
        },
        post: {
          tags: ["Bookmarks"],
          summary: "Save a job",
          description: "Creates a bookmark for the authenticated user.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("SaveBookmarkRequest"), {
              jobId: "550e8400-e29b-41d4-a716-446655440010"
            })
          },
          responses: {
            "201": jsonResponse(
              "Job saved successfully.",
              successEnvelopeSchema(ref("BookmarkSummary"), nullSchema),
              {
                success: true,
                message: "Lowongan berhasil disimpan",
                data: {
                  id: "550e8400-e29b-41d4-a716-446655440040",
                  jobId: "550e8400-e29b-41d4-a716-446655440010",
                  createdAt: "2026-04-24T08:00:00.000Z"
                },
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Job is not found.",
              "JOB_NOT_FOUND",
              "Lowongan tidak ditemukan"
            ),
            "409": errorResponse(
              "Bookmark already exists.",
              "BOOKMARK_ALREADY_EXISTS",
              "Bookmark sudah ada"
            ),
            "422": validationErrorResponse(
              "jobId",
              "ID lowongan tidak valid. Gunakan UUID yang benar"
            )
          }
        }
      },
      "/api/v1/me/bookmarks/{jobId}": {
        delete: {
          tags: ["Bookmarks"],
          summary: "Delete a bookmark",
          description:
            "Removes the authenticated user's bookmark for the given job.",
          security: bearerSecurity(),
          parameters: [
            {
              in: "path",
              name: "jobId",
              required: true,
              schema: uuidSchema
            }
          ],
          responses: {
            "204": {
              description: "Bookmark deleted successfully."
            },
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Bookmark is not found.",
              "BOOKMARK_NOT_FOUND",
              "Bookmark tidak ditemukan"
            ),
            "422": validationErrorResponse(
              "jobId",
              "ID lowongan tidak valid. Gunakan UUID yang benar"
            )
          }
        }
      },
      "/api/v1/me/applications": {
        get: {
          tags: ["Applications"],
          summary: "List applications",
          description:
            "Returns paginated current-user application tracker records.",
          security: bearerSecurity(),
          parameters: [
            {
              in: "query",
              name: "page",
              schema: { type: "integer", minimum: 1, default: 1 }
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", minimum: 1, maximum: 100, default: 20 }
            },
            {
              in: "query",
              name: "keyword",
              schema: { type: "string", minLength: 1, maxLength: 120 }
            },
            {
              in: "query",
              name: "status",
              schema: {
                type: "string",
                enum: ["APPLIED", "INTERVIEW", "REJECTED", "ACCEPTED"]
              }
            },
            {
              in: "query",
              name: "sort",
              schema: {
                type: "string",
                enum: ["updated_desc", "created_desc", "newest"],
                default: "updated_desc"
              }
            }
          ],
          responses: {
            "200": jsonResponse(
              "Applications retrieved successfully.",
              successEnvelopeSchema(
                {
                  type: "array",
                  items: ref("ApplicationResource")
                },
                listMetaSchema({ status: "APPLIED" }, "updated_desc")
              ),
              {
                success: true,
                message: "Daftar lamaran berhasil diambil",
                data: [applicationExample],
                meta: {
                  pagination: {
                    page: 1,
                    limit: 20,
                    total: 1,
                    totalPages: 1,
                    hasNextPage: false,
                    hasPrevPage: false
                  },
                  filters: {
                    status: "APPLIED"
                  },
                  sort: "updated_desc"
                }
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "422": validationErrorResponse(
              "status",
              "Status lamaran tidak didukung. Gunakan status yang tersedia"
            )
          }
        },
        post: {
          tags: ["Applications"],
          summary: "Create an application tracker record",
          description:
            "Creates a current-user application tracker record for a job.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("CreateApplicationRequest"), {
              jobId: "550e8400-e29b-41d4-a716-446655440010",
              status: "APPLIED",
              notes: "Applied from Glints after reviewing fit score.",
              source: "EXTERNAL_APPLY_CLICK"
            })
          },
          responses: {
            "201": jsonResponse(
              "Application created successfully.",
              successEnvelopeSchema(ref("ApplicationResource"), nullSchema),
              {
                success: true,
                message: "Lamaran berhasil dibuat",
                data: applicationExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Job is not found.",
              "JOB_NOT_FOUND",
              "Lowongan tidak ditemukan"
            ),
            "409": errorResponse(
              "Application is already tracked.",
              "APPLICATION_ALREADY_TRACKED",
              "Lamaran sudah dilacak"
            ),
            "422": validationErrorResponse(
              "jobId",
              "ID lowongan tidak valid. Gunakan UUID yang benar"
            )
          }
        }
      },
      "/api/v1/me/applications/{applicationId}": {
        patch: {
          tags: ["Applications"],
          summary: "Update application metadata",
          description:
            "Updates notes or source metadata for a current-user application record.",
          security: bearerSecurity(),
          parameters: [
            {
              in: "path",
              name: "applicationId",
              required: true,
              schema: uuidSchema
            }
          ],
          requestBody: {
            required: true,
            content: jsonContent(ref("UpdateApplicationRequest"), {
              notes: "Recruiter replied and asked for availability.",
              source: "MANUAL"
            })
          },
          responses: {
            "200": jsonResponse(
              "Application updated successfully.",
              successEnvelopeSchema(ref("ApplicationResource"), nullSchema),
              {
                success: true,
                message: "Lamaran berhasil diperbarui",
                data: {
                  ...applicationExample,
                  notes: "Recruiter replied and asked for availability.",
                  source: "MANUAL"
                },
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Application is not found.",
              "APPLICATION_NOT_FOUND",
              "Lamaran tidak ditemukan"
            ),
            "422": validationErrorResponse(
              "",
              "Minimal satu field pembaruan harus diisi",
              "custom"
            )
          }
        }
      },
      "/api/v1/me/applications/{applicationId}/status": {
        patch: {
          tags: ["Applications"],
          summary: "Update application status",
          description:
            "Updates the status of a current-user application record.",
          security: bearerSecurity(),
          parameters: [
            {
              in: "path",
              name: "applicationId",
              required: true,
              schema: uuidSchema
            }
          ],
          requestBody: {
            required: true,
            content: jsonContent(ref("UpdateApplicationStatusRequest"), {
              status: "INTERVIEW",
              notes: "First interview scheduled for Friday."
            })
          },
          responses: {
            "200": jsonResponse(
              "Application status updated successfully.",
              successEnvelopeSchema(ref("ApplicationResource"), nullSchema),
              {
                success: true,
                message: "Status lamaran berhasil diperbarui",
                data: {
                  ...applicationExample,
                  status: "INTERVIEW",
                  notes: "First interview scheduled for Friday."
                },
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Application is not found.",
              "APPLICATION_NOT_FOUND",
              "Lamaran tidak ditemukan"
            ),
            "409": errorResponse(
              "Requested status transition is not allowed.",
              "APPLICATION_STATUS_CONFLICT",
              "Perubahan status lamaran tidak valid"
            ),
            "422": validationErrorResponse(
              "status",
              "Status lamaran tidak didukung. Gunakan status yang tersedia"
            )
          }
        }
      },
      "/api/v1/ai/job-fit": {
        post: {
          tags: ["AI Job Fit"],
          summary: "Analyze job fit",
          description:
            "Builds backend-owned user and preference context, calls Model API, and returns a job fit analysis for the selected job.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: jsonContent(ref("AnalyzeJobFitRequest"), {
              jobId: "550e8400-e29b-41d4-a716-446655440010",
              persistResult: true
            })
          },
          responses: {
            "200": jsonResponse(
              "Job fit analysis completed successfully.",
              successEnvelopeSchema(ref("JobFitAnalysis"), nullSchema),
              {
                success: true,
                message: "Analisis kecocokan pekerjaan berhasil diselesaikan",
                data: jobFitExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Job is not found.",
              "JOB_NOT_FOUND",
              "Lowongan tidak ditemukan"
            ),
            "409": errorResponse(
              "User profile is incomplete.",
              "PROFILE_INCOMPLETE",
              "Data profil belum lengkap untuk analisis kecocokan pekerjaan"
            ),
            "422": validationErrorResponse(
              "jobId",
              "ID lowongan tidak valid. Gunakan UUID yang benar"
            ),
            "502": errorResponse(
              "Downstream response is invalid.",
              "DOWNSTREAM_ERROR",
              "Model API mengembalikan data response yang tidak valid"
            ),
            "503": errorResponse(
              "Model API is unavailable.",
              "SERVICE_UNAVAILABLE",
              "Model API tidak tersedia"
            )
          }
        }
      },
      "/api/v1/me/cv-files": {
        post: {
          tags: ["AI CV Analyzer"],
          summary: "Upload current user's CV",
          description:
            "Stores a PDF CV file for the authenticated current user. This endpoint can be used during onboarding before email verification and can mark the uploaded CV as the user's active CV.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: ref("UploadCvFileMultipartRequest"),
                encoding: {
                  cvFile: {
                    contentType: "application/pdf"
                  }
                }
              }
            }
          },
          responses: {
            "201": jsonResponse(
              "CV file uploaded successfully.",
              successEnvelopeSchema(
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["cvFile"],
                  properties: {
                    cvFile: ref("CvFile")
                  }
                },
                nullSchema
              ),
              {
                success: true,
                message: "CV berhasil diunggah",
                data: { cvFile: cvFileExample },
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "413": errorResponse(
              "Uploaded CV exceeds the configured limit.",
              "PAYLOAD_TOO_LARGE",
              "Ukuran file CV melebihi batas maksimum",
              {
                path: "cvFile",
                maxBytes: config.uploads.cvUploadMaxBytes
              }
            ),
            "422": validationErrorResponse("cvFile", "File CV wajib diunggah"),
            "503": errorResponse(
              "CV storage is unavailable.",
              "SERVICE_UNAVAILABLE",
              "Layanan sementara tidak tersedia"
            )
          }
        }
      },
      "/api/v1/me/cv-files/active": {
        get: {
          tags: ["AI CV Analyzer"],
          summary: "Get active CV file",
          description:
            "Returns the authenticated current user's active non-expired CV metadata without exposing the internal storage key.",
          security: bearerSecurity(),
          responses: {
            "200": jsonResponse(
              "Active CV file retrieved successfully.",
              successEnvelopeSchema(
                {
                  type: "object",
                  additionalProperties: false,
                  required: ["cvFile"],
                  properties: {
                    cvFile: ref("CvFile")
                  }
                },
                nullSchema
              ),
              {
                success: true,
                message: "CV aktif berhasil diambil",
                data: { cvFile: cvFileExample },
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": errorResponse(
              "Active CV file is not found.",
              "CV_FILE_NOT_FOUND",
              "CV aktif tidak ditemukan"
            )
          }
        }
      },
      "/api/v1/ai/cv-analyzer": {
        post: {
          tags: ["AI CV Analyzer"],
          summary: "Analyze CV",
          description:
            "Compares a CV against a selected job using Model API. The CV source priority is direct PDF upload, explicit cvFileId, then the user's active CV.",
          security: bearerSecurity(),
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: ref("AnalyzeCvMultipartRequest"),
                encoding: {
                  cvFile: {
                    contentType: "application/pdf"
                  }
                }
              }
            }
          },
          responses: {
            "200": jsonResponse(
              "CV analysis completed successfully.",
              successEnvelopeSchema(ref("CvAnalysis"), nullSchema),
              {
                success: true,
                message: "Analisis CV berhasil diselesaikan",
                data: cvAnalysisExample,
                meta: null
              }
            ),
            "401": errorResponse(
              "Authentication is required.",
              "UNAUTHENTICATED",
              "Autentikasi diperlukan"
            ),
            "404": {
              description:
                "Job, bookmark, or CV file is not found for the current user.",
              content: {
                "application/json": {
                  schema: ref("ErrorEnvelope"),
                  examples: {
                    jobNotFound: {
                      value: {
                        success: false,
                        message: "Lowongan tidak ditemukan",
                        data: null,
                        error: {
                          code: "JOB_NOT_FOUND",
                          details: null,
                          requestId: "req_1234567890"
                        }
                      }
                    },
                    bookmarkNotFound: {
                      value: {
                        success: false,
                        message: "Bookmark tidak ditemukan",
                        data: null,
                        error: {
                          code: "BOOKMARK_NOT_FOUND",
                          details: null,
                          requestId: "req_1234567890"
                        }
                      }
                    },
                    cvFileNotFound: {
                      value: {
                        success: false,
                        message: "CV tidak ditemukan",
                        data: null,
                        error: {
                          code: "CV_FILE_NOT_FOUND",
                          details: null,
                          requestId: "req_1234567890"
                        }
                      }
                    }
                  }
                }
              }
            },
            "413": errorResponse(
              "Uploaded CV exceeds the configured limit.",
              "PAYLOAD_TOO_LARGE",
              "Ukuran file CV melebihi batas maksimum",
              {
                path: "cvFile",
                maxBytes: config.uploads.cvUploadMaxBytes
              }
            ),
            "422": validationErrorResponse(
              "cvFile",
              "File CV PDF diperlukan untuk analisis"
            ),
            "502": errorResponse(
              "Downstream response is invalid.",
              "DOWNSTREAM_ERROR",
              "Model API mengembalikan data response yang tidak valid"
            ),
            "503": errorResponse(
              "Model API is unavailable.",
              "SERVICE_UNAVAILABLE",
              "Model API tidak tersedia"
            )
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT"
        },
        refreshTokenCookie: {
          type: "apiKey",
          in: "cookie",
          name: config.auth.refreshCookieName
        }
      },
      schemas: {
        ValidationIssue: {
          type: "object",
          additionalProperties: false,
          required: ["path", "message", "code"],
          properties: {
            path: { type: "string" },
            message: { type: "string" },
            code: { type: "string" }
          }
        },
        ErrorEnvelope: {
          type: "object",
          additionalProperties: false,
          required: ["success", "message", "data", "error"],
          properties: {
            success: { type: "boolean", const: false },
            message: { type: "string" },
            data: nullSchema,
            error: {
              type: "object",
              additionalProperties: false,
              required: ["code", "details", "requestId"],
              properties: {
                code: { type: "string" },
                details: {
                  anyOf: [
                    {
                      type: "array",
                      items: ref("ValidationIssue")
                    },
                    {
                      type: "object",
                      additionalProperties: true
                    },
                    nullSchema
                  ]
                },
                requestId: requestIdSchema
              }
            }
          }
        },
        PaginationMeta: {
          type: "object",
          additionalProperties: false,
          required: [
            "page",
            "limit",
            "total",
            "totalPages",
            "hasNextPage",
            "hasPrevPage"
          ],
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            total: { type: "integer", minimum: 0 },
            totalPages: { type: "integer", minimum: 0 },
            hasNextPage: { type: "boolean" },
            hasPrevPage: { type: "boolean" }
          }
        },
        SourcePlatform: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "slug"],
          properties: {
            id: uuidSchema,
            name: { type: "string" },
            slug: { type: "string" }
          }
        },
        CompanyCard: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "logoUrl"],
          properties: {
            id: uuidSchema,
            name: { type: "string" },
            logoUrl: {
              anyOf: [{ type: "string", format: "uri" }, nullSchema]
            }
          }
        },
        CompanyDetail: {
          allOf: [
            ref("CompanyCard"),
            {
              type: "object",
              additionalProperties: false,
              properties: {
                websiteUrl: {
                  anyOf: [{ type: "string", format: "uri" }, nullSchema]
                }
              }
            }
          ]
        },
        Location: {
          type: "object",
          additionalProperties: false,
          required: ["display", "province", "city"],
          properties: {
            display: { type: "string" },
            province: { type: "string" },
            city: {
              anyOf: [{ type: "string" }, nullSchema]
            }
          }
        },
        Salary: {
          type: "object",
          additionalProperties: false,
          required: ["min", "max", "currency", "period", "display"],
          properties: {
            min: { anyOf: [{ type: "integer", minimum: 0 }, nullSchema] },
            max: { anyOf: [{ type: "integer", minimum: 0 }, nullSchema] },
            currency: { type: "string", example: "IDR" },
            period: { type: "string", enum: ["MONTHLY", "YEARLY"] },
            display: { type: "string" }
          }
        },
        JobRequirement: {
          type: "object",
          additionalProperties: false,
          required: ["type", "value", "priority"],
          properties: {
            type: {
              type: "string",
              enum: [
                "SKILL",
                "EXPERIENCE",
                "EDUCATION",
                "RESPONSIBILITY",
                "OTHER"
              ]
            },
            value: { type: "string" },
            priority: {
              type: "string",
              enum: ["HIGH", "MEDIUM", "LOW", "UNKNOWN"]
            }
          }
        },
        JobCard: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "title",
            "company",
            "sourcePlatform",
            "workType",
            "employmentType",
            "experienceLevel",
            "location",
            "salary",
            "postedAt",
            "lastSeenAt",
            "isStale"
          ],
          properties: {
            id: uuidSchema,
            title: { type: "string" },
            company: ref("CompanyCard"),
            sourcePlatform: ref("SourcePlatform"),
            workType: { type: "string", enum: ["REMOTE", "HYBRID", "ONSITE"] },
            employmentType: {
              type: "string",
              enum: [
                "FULL_TIME",
                "PART_TIME",
                "INTERNSHIP",
                "CONTRACT",
                "FREELANCE"
              ]
            },
            experienceLevel: {
              type: "string",
              enum: ["ENTRY_LEVEL", "JUNIOR", "MID_LEVEL", "SENIOR", "LEAD"]
            },
            location: ref("Location"),
            salary: ref("Salary"),
            postedAt: isoDateTimeSchema,
            lastSeenAt: isoDateTimeSchema,
            isStale: { type: "boolean" }
          }
        },
        JobDetail: {
          allOf: [
            ref("JobCard"),
            {
              type: "object",
              additionalProperties: false,
              required: [
                "description",
                "requirements",
                "skills",
                "externalApplyUrl"
              ],
              properties: {
                company: ref("CompanyDetail"),
                description: { type: "string" },
                requirements: {
                  type: "array",
                  items: ref("JobRequirement")
                },
                skills: {
                  type: "array",
                  items: { type: "string" }
                },
                externalApplyUrl: {
                  anyOf: [{ type: "string", format: "uri" }, nullSchema]
                }
              }
            }
          ]
        },
        RegisterRequest: {
          type: "object",
          additionalProperties: false,
          required: [
            "username",
            "email",
            "phoneNumber",
            "password",
            "confirmPassword"
          ],
          properties: {
            username: {
              type: "string",
              minLength: 3,
              maxLength: 30,
              pattern: "^[a-z0-9_]+$"
            },
            email: { type: "string", format: "email" },
            phoneNumber: {
              type: "string",
              minLength: 8,
              maxLength: 20,
              pattern: "^\\+?62[0-9]{7,16}$"
            },
            password: { type: "string", minLength: 12, maxLength: 128 },
            confirmPassword: { type: "string" }
          }
        },
        LoginRequest: {
          type: "object",
          additionalProperties: false,
          required: ["identifier", "password"],
          properties: {
            identifier: { type: "string", minLength: 3, maxLength: 254 },
            password: { type: "string", minLength: 1, maxLength: 128 }
          }
        },
        ForgotPasswordRequest: {
          type: "object",
          additionalProperties: false,
          required: ["email"],
          properties: {
            email: { type: "string", format: "email" }
          }
        },
        ResetPasswordRequest: {
          type: "object",
          additionalProperties: false,
          required: ["token", "password", "confirmPassword"],
          properties: {
            token: { type: "string", minLength: 32, maxLength: 256 },
            password: { type: "string", minLength: 12, maxLength: 128 },
            confirmPassword: { type: "string" }
          }
        },
        VerifyEmailRequest: {
          type: "object",
          additionalProperties: false,
          required: ["email", "otp"],
          properties: {
            email: { type: "string", format: "email" },
            otp: { type: "string", pattern: "^[0-9]{6}$" }
          }
        },
        AuthUser: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "username",
            "email",
            "emailVerified",
            "onboardingStatus",
            "createdAt"
          ],
          properties: {
            id: uuidSchema,
            username: { type: "string" },
            email: { type: "string", format: "email" },
            emailVerified: { type: "boolean" },
            onboardingStatus: {
              type: "string",
              enum: ["PENDING", "IN_PROGRESS", "COMPLETED"]
            },
            createdAt: isoDateTimeSchema
          }
        },
        AuthSession: {
          type: "object",
          additionalProperties: false,
          required: ["accessToken", "expiresIn", "tokenType"],
          properties: {
            accessToken: { type: "string" },
            expiresIn: { type: "integer", minimum: 1 },
            tokenType: { type: "string", const: "Bearer" }
          }
        },
        ProfilePhoto: {
          type: "object",
          additionalProperties: false,
          required: ["url", "mimeType", "sizeBytes"],
          properties: {
            url: {
              anyOf: [{ type: "string", format: "uri" }, nullSchema]
            },
            mimeType: {
              type: "string",
              enum: ["image/jpeg", "image/png", "image/webp"]
            },
            sizeBytes: { type: "integer", minimum: 1, maximum: 5242880 }
          }
        },
        CurrentUserProfile: {
          type: "object",
          additionalProperties: false,
          required: ["careerStatus", "latestRole", "summary"],
          properties: {
            careerStatus: {
              anyOf: [
                {
                  type: "string",
                  enum: ["FRESH_GRADUATE", "EARLY_CAREER", "CAREER_SWITCHER"]
                },
                nullSchema
              ]
            },
            latestRole: {
              anyOf: [{ type: "string" }, nullSchema]
            },
            summary: {
              anyOf: [{ type: "string" }, nullSchema]
            }
          }
        },
        CurrentUserSkill: {
          type: "object",
          additionalProperties: false,
          required: ["id", "name", "level"],
          properties: {
            id: uuidSchema,
            name: { type: "string" },
            level: {
              anyOf: [
                { type: "string", enum: ["BASIC", "INTERMEDIATE", "ADVANCED"] },
                nullSchema
              ]
            }
          }
        },
        CurrentUserExperience: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "title",
            "company",
            "employmentType",
            "startDate",
            "endDate",
            "isCurrent",
            "description"
          ],
          properties: {
            id: uuidSchema,
            title: { type: "string" },
            company: { anyOf: [{ type: "string" }, nullSchema] },
            employmentType: {
              anyOf: [
                {
                  type: "string",
                  enum: [
                    "FULL_TIME",
                    "PART_TIME",
                    "INTERNSHIP",
                    "CONTRACT",
                    "FREELANCE"
                  ]
                },
                nullSchema
              ]
            },
            startDate: { anyOf: [isoDateSchema, nullSchema] },
            endDate: { anyOf: [isoDateSchema, nullSchema] },
            isCurrent: { type: "boolean" },
            description: { anyOf: [{ type: "string" }, nullSchema] }
          }
        },
        CurrentUserEducation: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "institution",
            "degree",
            "fieldOfStudy",
            "startYear",
            "endYear"
          ],
          properties: {
            id: uuidSchema,
            institution: { type: "string" },
            degree: { anyOf: [{ type: "string" }, nullSchema] },
            fieldOfStudy: { anyOf: [{ type: "string" }, nullSchema] },
            startYear: {
              anyOf: [
                { type: "integer", minimum: 1900, maximum: 2100 },
                nullSchema
              ]
            },
            endYear: {
              anyOf: [
                { type: "integer", minimum: 1900, maximum: 2100 },
                nullSchema
              ]
            }
          }
        },
        CurrentUser: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "username",
            "email",
            "emailVerified",
            "phoneNumber",
            "displayName",
            "profilePhoto",
            "onboardingStatus",
            "profile",
            "skills",
            "experience",
            "education",
            "createdAt",
            "updatedAt"
          ],
          properties: {
            id: uuidSchema,
            username: { type: "string" },
            email: { type: "string", format: "email" },
            emailVerified: { type: "boolean" },
            phoneNumber: { anyOf: [{ type: "string" }, nullSchema] },
            displayName: { anyOf: [{ type: "string" }, nullSchema] },
            profilePhoto: {
              anyOf: [ref("ProfilePhoto"), nullSchema]
            },
            onboardingStatus: {
              type: "string",
              enum: ["PENDING", "IN_PROGRESS", "COMPLETED"]
            },
            profile: {
              anyOf: [ref("CurrentUserProfile"), nullSchema]
            },
            skills: { type: "array", items: ref("CurrentUserSkill") },
            experience: { type: "array", items: ref("CurrentUserExperience") },
            education: { type: "array", items: ref("CurrentUserEducation") },
            createdAt: isoDateTimeSchema,
            updatedAt: isoDateTimeSchema
          }
        },
        UpdateCurrentUserRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            username: {
              type: "string",
              minLength: 3,
              maxLength: 30,
              pattern: "^[a-z0-9_]+$"
            },
            phoneNumber: {
              type: "string",
              minLength: 8,
              maxLength: 20,
              pattern: "^\\+?62[0-9]{7,16}$"
            },
            displayName: { type: "string", minLength: 1, maxLength: 80 }
          }
        },
        ProfilePhotoUpsertRequest: {
          type: "object",
          additionalProperties: false,
          required: ["storageKey", "mimeType", "sizeBytes"],
          properties: {
            storageKey: {
              type: "string",
              minLength: 1,
              maxLength: 512,
              pattern: "^[A-Za-z0-9/_\\-.]+$"
            },
            url: {
              anyOf: [
                { type: "string", format: "uri", maxLength: 1024 },
                nullSchema
              ]
            },
            mimeType: {
              type: "string",
              enum: ["image/jpeg", "image/png", "image/webp"]
            },
            sizeBytes: { type: "integer", minimum: 1, maximum: 5242880 }
          }
        },
        ReplaceSkillsRequest: {
          type: "object",
          additionalProperties: false,
          required: ["skills"],
          properties: {
            skills: {
              type: "array",
              maxItems: 100,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["name"],
                properties: {
                  name: { type: "string", minLength: 1, maxLength: 80 },
                  level: {
                    type: "string",
                    enum: ["BASIC", "INTERMEDIATE", "ADVANCED"]
                  }
                }
              }
            }
          }
        },
        ReplaceExperienceRequest: {
          type: "object",
          additionalProperties: false,
          required: ["experience"],
          properties: {
            experience: {
              type: "array",
              maxItems: 100,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["title"],
                properties: {
                  title: { type: "string", minLength: 1, maxLength: 120 },
                  company: {
                    anyOf: [
                      { type: "string", minLength: 1, maxLength: 120 },
                      nullSchema
                    ]
                  },
                  employmentType: {
                    anyOf: [
                      {
                        type: "string",
                        enum: [
                          "FULL_TIME",
                          "PART_TIME",
                          "INTERNSHIP",
                          "CONTRACT",
                          "FREELANCE"
                        ]
                      },
                      nullSchema
                    ]
                  },
                  startDate: { anyOf: [isoDateSchema, nullSchema] },
                  endDate: { anyOf: [isoDateSchema, nullSchema] },
                  isCurrent: { type: "boolean" },
                  description: {
                    anyOf: [{ type: "string", maxLength: 2000 }, nullSchema]
                  }
                }
              }
            }
          }
        },
        ReplaceEducationRequest: {
          type: "object",
          additionalProperties: false,
          required: ["education"],
          properties: {
            education: {
              type: "array",
              maxItems: 100,
              items: {
                type: "object",
                additionalProperties: false,
                required: ["institution", "degree", "fieldOfStudy"],
                properties: {
                  institution: { type: "string", minLength: 1, maxLength: 160 },
                  degree: { type: "string", minLength: 1, maxLength: 120 },
                  fieldOfStudy: {
                    type: "string",
                    minLength: 1,
                    maxLength: 160
                  },
                  startYear: {
                    anyOf: [
                      { type: "integer", minimum: 1900, maximum: 2100 },
                      nullSchema
                    ]
                  },
                  endYear: {
                    anyOf: [
                      { type: "integer", minimum: 1900, maximum: 2100 },
                      nullSchema
                    ]
                  }
                }
              }
            }
          }
        },
        PreferenceLocation: {
          type: "object",
          additionalProperties: false,
          required: ["province", "city"],
          properties: {
            province: { type: "string", minLength: 1, maxLength: 120 },
            city: { anyOf: [{ type: "string", maxLength: 120 }, nullSchema] }
          }
        },
        SalaryExpectation: {
          type: "object",
          additionalProperties: false,
          required: ["min", "max", "currency", "period"],
          properties: {
            min: { anyOf: [{ type: "integer", minimum: 0 }, nullSchema] },
            max: { anyOf: [{ type: "integer", minimum: 0 }, nullSchema] },
            currency: {
              type: "string",
              minLength: 3,
              maxLength: 3,
              example: "IDR"
            },
            period: { type: "string", enum: ["MONTHLY", "YEARLY"] }
          }
        },
        Preferences: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "careerStatus",
            "jobSeekingStatus",
            "targetRoles",
            "locations",
            "workTypes",
            "salaryExpectation",
            "emailNotificationsEnabled",
            "createdAt",
            "updatedAt"
          ],
          properties: {
            id: uuidSchema,
            careerStatus: {
              type: "string",
              enum: ["FRESH_GRADUATE", "EARLY_CAREER", "CAREER_SWITCHER"]
            },
            jobSeekingStatus: {
              type: "string",
              enum: ["IMMEDIATE", "ONE_MONTH", "THREE_MONTHS"]
            },
            targetRoles: { type: "array", items: { type: "string" } },
            locations: { type: "array", items: ref("PreferenceLocation") },
            workTypes: {
              type: "array",
              items: { type: "string", enum: ["REMOTE", "HYBRID", "ONSITE"] }
            },
            salaryExpectation: ref("SalaryExpectation"),
            emailNotificationsEnabled: { type: "boolean" },
            createdAt: isoDateTimeSchema,
            updatedAt: isoDateTimeSchema
          }
        },
        PreferencesUpsertRequest: {
          type: "object",
          additionalProperties: false,
          required: [
            "careerStatus",
            "jobSeekingStatus",
            "targetRoles",
            "locations",
            "workTypes",
            "salaryExpectation",
            "emailNotificationsEnabled"
          ],
          properties: {
            careerStatus: {
              type: "string",
              enum: ["FRESH_GRADUATE", "EARLY_CAREER", "CAREER_SWITCHER"]
            },
            jobSeekingStatus: {
              type: "string",
              enum: ["IMMEDIATE", "ONE_MONTH", "THREE_MONTHS"]
            },
            targetRoles: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: { type: "string", minLength: 1, maxLength: 120 }
            },
            locations: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: ref("PreferenceLocation")
            },
            workTypes: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", enum: ["REMOTE", "HYBRID", "ONSITE"] }
            },
            salaryExpectation: ref("SalaryExpectation"),
            emailNotificationsEnabled: { type: "boolean" }
          }
        },
        PreferencesPatchRequest: {
          type: "object",
          additionalProperties: false,
          properties: {
            careerStatus: {
              type: "string",
              enum: ["FRESH_GRADUATE", "EARLY_CAREER", "CAREER_SWITCHER"]
            },
            jobSeekingStatus: {
              type: "string",
              enum: ["IMMEDIATE", "ONE_MONTH", "THREE_MONTHS"]
            },
            targetRoles: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: { type: "string", minLength: 1, maxLength: 120 }
            },
            locations: {
              type: "array",
              minItems: 1,
              maxItems: 20,
              items: ref("PreferenceLocation")
            },
            workTypes: {
              type: "array",
              minItems: 1,
              maxItems: 3,
              items: { type: "string", enum: ["REMOTE", "HYBRID", "ONSITE"] }
            },
            salaryExpectation: {
              type: "object",
              additionalProperties: false,
              properties: {
                min: { anyOf: [{ type: "integer", minimum: 0 }, nullSchema] },
                max: { anyOf: [{ type: "integer", minimum: 0 }, nullSchema] },
                currency: { type: "string", minLength: 3, maxLength: 3 },
                period: { type: "string", enum: ["MONTHLY", "YEARLY"] }
              }
            },
            emailNotificationsEnabled: { type: "boolean" }
          }
        },
        SaveBookmarkRequest: {
          type: "object",
          additionalProperties: false,
          required: ["jobId"],
          properties: {
            jobId: uuidSchema
          }
        },
        BookmarkSummary: {
          type: "object",
          additionalProperties: false,
          required: ["id", "jobId", "createdAt"],
          properties: {
            id: uuidSchema,
            jobId: uuidSchema,
            createdAt: isoDateTimeSchema
          }
        },
        BookmarkResource: {
          type: "object",
          additionalProperties: false,
          required: ["id", "job", "createdAt"],
          properties: {
            id: uuidSchema,
            job: ref("JobCard"),
            createdAt: isoDateTimeSchema
          }
        },
        CreateApplicationRequest: {
          type: "object",
          additionalProperties: false,
          required: ["jobId"],
          properties: {
            jobId: uuidSchema,
            status: {
              type: "string",
              enum: ["APPLIED", "INTERVIEW", "REJECTED", "ACCEPTED"],
              default: "APPLIED"
            },
            notes: { type: "string", maxLength: 2000 },
            source: {
              type: "string",
              enum: ["MANUAL", "EXTERNAL_APPLY_CLICK"],
              default: "MANUAL"
            }
          }
        },
        UpdateApplicationRequest: {
          type: "object",
          additionalProperties: false,
          minProperties: 1,
          properties: {
            notes: {
              anyOf: [{ type: "string", maxLength: 2000 }, nullSchema]
            },
            source: { type: "string", enum: ["MANUAL", "EXTERNAL_APPLY_CLICK"] }
          }
        },
        UpdateApplicationStatusRequest: {
          type: "object",
          additionalProperties: false,
          required: ["status"],
          properties: {
            status: {
              type: "string",
              enum: ["APPLIED", "INTERVIEW", "REJECTED", "ACCEPTED"]
            },
            notes: { type: "string", maxLength: 2000 }
          }
        },
        ApplicationResource: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "status",
            "notes",
            "source",
            "appliedAt",
            "updatedAt",
            "job"
          ],
          properties: {
            id: uuidSchema,
            status: {
              type: "string",
              enum: ["APPLIED", "INTERVIEW", "REJECTED", "ACCEPTED"]
            },
            notes: { anyOf: [{ type: "string" }, nullSchema] },
            source: {
              type: "string",
              enum: ["MANUAL", "EXTERNAL_APPLY_CLICK"]
            },
            appliedAt: isoDateTimeSchema,
            updatedAt: isoDateTimeSchema,
            job: ref("JobCard")
          }
        },
        AnalyzeJobFitRequest: {
          type: "object",
          additionalProperties: false,
          required: ["jobId"],
          properties: {
            jobId: uuidSchema,
            persistResult: { type: "boolean", default: false }
          }
        },
        JobFitAnalysis: {
          type: "object",
          additionalProperties: false,
          required: [
            "jobId",
            "fitScore",
            "readinessLevel",
            "recommendation",
            "breakdown",
            "skillGaps",
            "model",
            "analyzedAt"
          ],
          properties: {
            jobId: uuidSchema,
            fitScore: { type: "integer", minimum: 0, maximum: 100 },
            readinessLevel: {
              type: "string",
              enum: [
                "READY",
                "READY_WITH_MINOR_GAPS",
                "NEEDS_PREPARATION",
                "NOT_RECOMMENDED_YET"
              ]
            },
            recommendation: {
              type: "object",
              additionalProperties: false,
              required: [
                "decision",
                "summary",
                "nextSteps",
                "successProbability"
              ],
              properties: {
                decision: {
                  type: "string",
                  enum: ["APPLY_NOW", "IMPROVE_FIRST", "SAVE_FOR_LATER"]
                },
                summary: { type: "string" },
                nextSteps: { type: "array", items: { type: "string" } },
                successProbability: { type: "number", minimum: 0, maximum: 1 }
              }
            },
            breakdown: {
              type: "object",
              additionalProperties: false,
              required: ["skillMatch", "experienceMatch", "preferenceMatch"],
              properties: {
                skillMatch: {
                  type: "object",
                  additionalProperties: false,
                  required: ["score", "matchedSkills", "missingSkills"],
                  properties: {
                    score: { type: "integer", minimum: 0, maximum: 100 },
                    matchedSkills: { type: "array", items: { type: "string" } },
                    missingSkills: { type: "array", items: { type: "string" } }
                  }
                },
                experienceMatch: {
                  type: "object",
                  additionalProperties: false,
                  required: ["score", "reason"],
                  properties: {
                    score: { type: "integer", minimum: 0, maximum: 100 },
                    reason: { type: "string" }
                  }
                },
                preferenceMatch: {
                  type: "object",
                  additionalProperties: false,
                  required: [
                    "score",
                    "matchedPreferences",
                    "unmatchedPreferences"
                  ],
                  properties: {
                    score: { type: "integer", minimum: 0, maximum: 100 },
                    matchedPreferences: {
                      type: "array",
                      items: { type: "string" }
                    },
                    unmatchedPreferences: {
                      type: "array",
                      items: { type: "string" }
                    }
                  }
                }
              }
            },
            skillGaps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["skill", "priority", "reason"],
                properties: {
                  skill: { type: "string" },
                  priority: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
                  reason: { type: "string" }
                }
              }
            },
            model: {
              type: "object",
              additionalProperties: false,
              required: ["name", "version"],
              properties: {
                name: { type: "string" },
                version: { type: "string" }
              }
            },
            analyzedAt: isoDateTimeSchema
          }
        },
        AnalyzeCvMultipartRequest: {
          type: "object",
          additionalProperties: false,
          required: ["jobId", "language", "inputMode"],
          properties: {
            jobId: uuidSchema,
            language: { type: "string", enum: ["id", "en"] },
            inputMode: { type: "string", enum: ["UPLOAD", "REFERENCE"] },
            compareSource: {
              type: "string",
              enum: ["BOOKMARK", "JOB_SEARCH", "DIRECT_JOB_DETAIL"],
              default: "JOB_SEARCH"
            },
            persistResult: {
              oneOf: [
                { type: "boolean" },
                { type: "string", enum: ["true", "false"] }
              ],
              default: false
            },
            cvFileId: uuidSchema,
            cvFile: {
              type: "string",
              format: "binary"
            }
          }
        },
        UploadCvFileMultipartRequest: {
          type: "object",
          additionalProperties: false,
          required: ["cvFile"],
          properties: {
            setAsActive: {
              oneOf: [
                { type: "boolean" },
                { type: "string", enum: ["true", "false"] }
              ],
              default: true
            },
            cvFile: {
              type: "string",
              format: "binary"
            }
          }
        },
        CvFile: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "originalFileName",
            "mimeType",
            "sizeBytes",
            "uploadedAt",
            "expiresAt",
            "isActive"
          ],
          properties: {
            id: uuidSchema,
            originalFileName: { type: "string", example: "resume.pdf" },
            mimeType: { type: "string", const: "application/pdf" },
            sizeBytes: { type: "integer", minimum: 1, example: 284321 },
            uploadedAt: isoDateTimeSchema,
            expiresAt: isoDateTimeSchema,
            isActive: { type: "boolean" }
          }
        },
        CvAnalysis: {
          type: "object",
          additionalProperties: false,
          required: [
            "jobId",
            "language",
            "overallImpression",
            "jobFitAlignment",
            "atsFriendliness",
            "keywordOptimization",
            "experienceQuantification",
            "actionableImprovements",
            "generatedCv",
            "model",
            "analyzedAt"
          ],
          properties: {
            jobId: uuidSchema,
            language: { type: "string", enum: ["id", "en"] },
            overallImpression: {
              type: "object",
              additionalProperties: false,
              required: ["score", "summary"],
              properties: {
                score: { type: "integer", minimum: 0, maximum: 100 },
                summary: { type: "string" }
              }
            },
            jobFitAlignment: {
              type: "object",
              additionalProperties: false,
              required: [
                "score",
                "summary",
                "matchedSignals",
                "missingSignals"
              ],
              properties: {
                score: { type: "integer", minimum: 0, maximum: 100 },
                summary: { type: "string" },
                matchedSignals: { type: "array", items: { type: "string" } },
                missingSignals: { type: "array", items: { type: "string" } }
              }
            },
            atsFriendliness: {
              type: "object",
              additionalProperties: false,
              required: ["score", "issues"],
              properties: {
                score: { type: "integer", minimum: 0, maximum: 100 },
                issues: { type: "array", items: { type: "string" } }
              }
            },
            keywordOptimization: {
              type: "object",
              additionalProperties: false,
              required: ["recommendedKeywords", "reason"],
              properties: {
                recommendedKeywords: {
                  type: "array",
                  items: { type: "string" }
                },
                reason: { type: "string" }
              }
            },
            experienceQuantification: {
              type: "object",
              additionalProperties: false,
              required: ["score", "suggestions"],
              properties: {
                score: { type: "integer", minimum: 0, maximum: 100 },
                suggestions: { type: "array", items: { type: "string" } }
              }
            },
            actionableImprovements: {
              type: "array",
              items: { type: "string" }
            },
            generatedCv: {
              type: "object",
              additionalProperties: false,
              required: ["available", "note"],
              properties: {
                available: { type: "boolean" },
                note: { type: "string" }
              }
            },
            model: {
              type: "object",
              additionalProperties: false,
              required: ["name", "version"],
              properties: {
                name: { type: "string" },
                version: { type: "string" }
              }
            },
            analyzedAt: isoDateTimeSchema
          }
        },
        HealthLiveData: {
          type: "object",
          additionalProperties: false,
          required: ["service", "status", "env"],
          properties: {
            service: { type: "string", const: config.app.name },
            status: { type: "string", const: "live" },
            env: { type: "string" }
          }
        },
        HealthReadyData: {
          type: "object",
          additionalProperties: false,
          required: ["service", "status", "env", "dependencies"],
          properties: {
            service: { type: "string", const: config.app.name },
            status: { type: "string", const: "ready" },
            env: { type: "string" },
            dependencies: {
              type: "object",
              additionalProperties: false,
              required: ["postgresql"],
              properties: {
                postgresql: {
                  type: "string",
                  enum: ["healthy", "unhealthy"]
                }
              }
            }
          }
        }
      }
    }
  };
}
