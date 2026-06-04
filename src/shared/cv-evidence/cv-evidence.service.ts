import { createHash } from "node:crypto";

import type {
  BuildSharedCvEvidenceInput,
  SharedCvEvidence,
  SharedCvEvidenceConfidence,
  SharedCvEvidenceFreshnessInput,
  SharedCvEvidenceLatestAnalysis,
  SharedCvEvidenceMetadata,
  SharedCvEvidenceObservability,
  SharedCvEvidenceRequirementCoverage,
  SharedCvEvidenceSection,
  SharedCvEvidenceSkillGroup,
  SharedCvEvidenceSource
} from "@/shared/cv-evidence/cv-evidence.types";

export const sharedCvEvidenceSchemaVersion = "shared-cv-evidence-v1" as const;
export const backendCvEvidenceParserVersion = "backend-cv-evidence-parser-v1";
export const modelApiCvEvidenceParserVersion = "model-api-cv-evidence-v1";
export const cvGenerateTemplatePolicyVersion = "cv-generate-template-policy-v1";
export const mvpCvParserOwnershipDecision = {
  owner: "backend_mvp" as const,
  decision:
    "MVP cache ownership lives in Backend API. Backend owns sanitized shared evidence for analyzer wrapper and CV generate; Model API remains model-core/parser source when analyzer calls it.",
  rawTextCaching: "forbidden" as const,
  fallbackOrder: [
    "model_api",
    "backend_parser",
    "latest_analysis_cache",
    "metadata_only"
  ]
} as const;

const sectionHeadingAliases: Record<string, string> = {
  profile: "summary",
  summary: "summary",
  ringkasan: "summary",
  pengalaman: "experience",
  "work experience": "experience",
  experience: "experience",
  employment: "experience",
  projects: "projects",
  project: "projects",
  proyek: "projects",
  skills: "skills",
  skill: "skills",
  keahlian: "skills",
  education: "education",
  pendidikan: "education",
  certifications: "certifications",
  certification: "certifications",
  sertifikasi: "certifications",
  languages: "languages",
  language: "languages",
  bahasa: "languages"
};

const retainedFields = [
  "schemaVersion",
  "source",
  "parserOwner",
  "parserVersion",
  "parserConfidence",
  "sourceHash",
  "cvFile.fileId",
  "cvFile.mimeType",
  "cvFile.fileSize",
  "candidateSummary",
  "sectionEvidence",
  "skillEvidence",
  "atsEvidence",
  "confidenceFlags",
  "cache"
];

const forbiddenFields = [
  "raw_cv_text",
  "raw_pdf_content",
  "contact_email",
  "contact_phone",
  "address",
  "prompt_content",
  "provider_payload",
  "storage_identifier",
  "authorization_header",
  "token_value",
  "database_url"
];

export function buildBackendParsedSharedCvEvidence(
  input: BuildSharedCvEvidenceInput
): SharedCvEvidence {
  const parsedText = input.cvBytes ? extractUsableCvText(input.cvBytes) : "";
  const sections = parsedText
    ? splitCvSections(parsedText)
    : new Map<string, string[]>();
  const latestAnalysis = input.latestAnalysis ?? null;
  const sectionEvidence = buildSectionEvidence(sections, latestAnalysis);
  const candidateSummary =
    firstNonEmpty([
      summarizeSection(sections.get("summary") ?? [], 360),
      latestAnalysisText(latestAnalysis, "overallImpression", 360)
    ]) ?? null;
  const experienceBullets = boundedList(
    sectionLines(sections, "experience"),
    8,
    220
  );
  const projectBullets = boundedList(
    sectionLines(sections, "projects"),
    6,
    220
  );
  const skills = parseSkillList(sectionLines(sections, "skills"));
  const skillsByCategory =
    skills.length > 0 ? [{ category: "parsed_skills", skills }] : [];
  const education = boundedList(sectionLines(sections, "education"), 5, 180);
  const certifications = boundedList(
    sectionLines(sections, "certifications"),
    5,
    180
  );
  const languages = boundedList(sectionLines(sections, "languages"), 5, 80);
  const atsActionables = buildAtsAndActionables(latestAnalysis);
  const hasParsedEvidence =
    parsedText.length > 0 &&
    (experienceBullets.length > 0 ||
      projectBullets.length > 0 ||
      skills.length > 0 ||
      education.length > 0 ||
      certifications.length > 0 ||
      languages.length > 0 ||
      (sections.get("summary") ?? []).length > 0);
  const hasLatestEvidence = Boolean(latestAnalysis);
  const source: SharedCvEvidenceSource = hasParsedEvidence
    ? "backend_parser"
    : hasLatestEvidence
      ? "latest_analysis_cache"
      : "metadata_only";

  return buildSharedCvEvidence({
    input,
    source,
    parserVersion: backendCvEvidenceParserVersion,
    parserConfidence: hasParsedEvidence
      ? "medium"
      : hasLatestEvidence
        ? "low"
        : "low",
    sourceHash: hashSource(input.metadata, input.cvBytes),
    candidateSummary,
    sectionEvidence,
    experienceBullets,
    projectBullets,
    skillsByCategory,
    education,
    certifications,
    languages,
    atsEvidence: {
      score: atsScore(latestAnalysis),
      summary: atsSummary(latestAnalysis),
      actionables: atsActionables
    },
    atsAndActionableGaps: atsActionables,
    requirementCoverage: [],
    confidenceFlags: buildConfidenceFlags(
      parsedText,
      hasParsedEvidence,
      hasLatestEvidence
    )
  });
}

export function buildModelApiSharedCvEvidence(
  input: BuildSharedCvEvidenceInput
): SharedCvEvidence {
  const modelCore = input.modelCoreResponse;
  if (!modelCore) {
    return buildBackendParsedSharedCvEvidence(input);
  }

  const extractionEvidence = (modelCore.parsedCv.extractionEvidence ?? [])
    .filter(isString)
    .map((item) => boundedText(item, 220))
    .filter(Boolean);
  const detectedSections = modelCore.parsedCv.detectedSections
    .filter(isString)
    .map((item) => boundedText(item, 80))
    .filter(Boolean)
    .slice(0, 10);
  const sectionEvidence = detectedSections.map((sectionName, index) => ({
    sectionName,
    summary:
      extractionEvidence[index] ?? `Model API detected ${sectionName} section.`,
    confidence:
      modelCore.parsedCv.status === "parsed"
        ? ("high" as const)
        : ("low" as const),
    items: extractionEvidence[index] ? [extractionEvidence[index]] : []
  }));
  const matchedSkills = readStringList(
    modelCore.jobFitAlignment,
    "matchedSkills",
    20,
    80
  );
  const missingSkills = readStringList(
    modelCore.jobFitAlignment,
    "missingSkills",
    20,
    80
  );
  const skillsByCategory: SharedCvEvidenceSkillGroup[] =
    matchedSkills.length > 0
      ? [{ category: "model_matched_skills", skills: matchedSkills }]
      : [];
  const requirementCoverage: SharedCvEvidenceRequirementCoverage[] = [
    ...matchedSkills.map((skill) => ({
      requirement: skill,
      status: "matched" as const,
      evidence: [`Model API matched ${skill}`]
    })),
    ...missingSkills.map((skill) => ({
      requirement: skill,
      status: "missing" as const,
      evidence: [`Model API reported missing ${skill}`]
    }))
  ].slice(0, 30);
  const atsActionables = [
    ...readStringList(modelCore.atsFriendliness, "improvementHints", 8, 220),
    ...readStringList(modelCore.atsFriendliness, "issues", 8, 220),
    readOptionalString(modelCore.atsFriendliness, "summary", 220)
  ].filter(isString);
  const sourceHash = hashSource(
    input.metadata,
    input.cvBytes,
    `${modelCore.model.name}:${modelCore.model.version}`
  );

  return buildSharedCvEvidence({
    input,
    source: "model_api",
    parserVersion: modelApiCvEvidenceParserVersion,
    parserConfidence: modelCore.parsedCv.status === "parsed" ? "high" : "low",
    sourceHash,
    candidateSummary:
      firstNonEmpty([
        readOptionalString(modelCore.jobFitAlignment, "summary", 360),
        readOptionalString(modelCore.atsFriendliness, "summary", 360),
        latestAnalysisText(
          input.latestAnalysis ?? null,
          "overallImpression",
          360
        )
      ]) ?? null,
    sectionEvidence,
    experienceBullets: [],
    projectBullets: [],
    skillsByCategory,
    education: [],
    certifications: [],
    languages: [],
    atsEvidence: {
      score: readOptionalNumber(modelCore.atsFriendliness, "score"),
      summary: readOptionalString(modelCore.atsFriendliness, "summary", 360),
      actionables: boundedList(atsActionables, 8, 220)
    },
    atsAndActionableGaps: boundedList(atsActionables, 8, 220),
    requirementCoverage,
    confidenceFlags: [
      `model_api parser status: ${safeEvidenceText(modelCore.parsedCv.status)}`,
      `model_api text length: ${String(modelCore.parsedCv.textLength)}`
    ]
  });
}

export function isSharedCvEvidenceFresh(
  evidence: SharedCvEvidence,
  input: SharedCvEvidenceFreshnessInput
): boolean {
  return (
    evidence.cache.invalidationPolicy.sourceHash === input.sourceHash &&
    evidence.cache.invalidationPolicy.parserVersion === input.parserVersion &&
    evidence.cache.invalidationPolicy.analysisModelVersion ===
      (input.analysisModelVersion ?? null) &&
    evidence.cache.invalidationPolicy.templatePolicyVersion ===
      (input.templatePolicyVersion ?? null) &&
    new Date(evidence.cache.invalidationPolicy.expiresAt).getTime() >
      input.now.getTime()
  );
}

export function buildSharedCvEvidenceObservability(
  evidence: SharedCvEvidence
): SharedCvEvidenceObservability {
  return {
    schemaVersion: evidence.schemaVersion,
    source: evidence.source,
    parserOwner: evidence.parserOwner,
    parserVersion: evidence.parserVersion,
    parserConfidence: evidence.parserConfidence,
    cacheStatus: evidence.cache.status,
    sectionCount: evidence.sectionEvidence.length,
    skillCount: evidence.skillsByCategory.reduce(
      (count, group) => count + group.skills.length,
      0
    ),
    requirementCoverageCount: evidence.skillEvidence.requirementCoverage.length,
    actionablesCount: evidence.atsAndActionableGaps.length,
    noLeakChecks: {
      rawCvTextRetained: evidence.privacy.rawCvTextRetained,
      contactDataRetained: evidence.privacy.contactDataRetained,
      storageIdentifierRetained: evidence.privacy.storageIdentifierRetained
    }
  };
}

export function hashSharedCvEvidenceSource(
  metadata: SharedCvEvidenceMetadata,
  cvBytes?: Buffer,
  salt = ""
): string {
  return hashSource(metadata, cvBytes, salt);
}

function buildSharedCvEvidence(input: {
  input: BuildSharedCvEvidenceInput;
  source: SharedCvEvidenceSource;
  parserVersion: string;
  parserConfidence: SharedCvEvidenceConfidence;
  sourceHash: string;
  candidateSummary: string | null;
  sectionEvidence: SharedCvEvidenceSection[];
  experienceBullets: string[];
  projectBullets: string[];
  skillsByCategory: SharedCvEvidenceSkillGroup[];
  education: string[];
  certifications: string[];
  languages: string[];
  atsEvidence: SharedCvEvidence["atsEvidence"];
  atsAndActionableGaps: string[];
  requirementCoverage: SharedCvEvidenceRequirementCoverage[];
  confidenceFlags: string[];
}): SharedCvEvidence {
  const createdAt = input.input.now;
  const expiresAt = addDays(createdAt, input.input.retentionDays);
  const analysisModelVersion = input.input.modelCoreResponse
    ? `${input.input.modelCoreResponse.model.name}:${input.input.modelCoreResponse.model.version}`
    : null;
  const templatePolicyVersion = input.input.templatePolicyVersion ?? null;
  const cacheKey = createHash("sha256")
    .update(
      `${sharedCvEvidenceSchemaVersion}:${input.sourceHash}:${input.parserVersion}:${analysisModelVersion ?? "none"}:${templatePolicyVersion ?? "none"}`
    )
    .digest("hex");
  const sectionSummaries = input.sectionEvidence.map((section) => ({
    sectionName: section.sectionName,
    summary: section.summary,
    confidence: section.confidence
  }));

  return {
    schemaVersion: sharedCvEvidenceSchemaVersion,
    source: input.source,
    parserOwner:
      input.source === "model_api"
        ? "model_api_primary"
        : mvpCvParserOwnershipDecision.owner,
    parserVersion: input.parserVersion,
    parserConfidence: input.parserConfidence,
    sourceHash: input.sourceHash,
    cvFile: {
      fileId: input.input.metadata.id,
      mimeType: input.input.metadata.mimeType,
      fileSize: input.input.metadata.sizeBytes
    },
    cache: {
      key: cacheKey,
      status: input.input.cacheStatus ?? "miss",
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      invalidationPolicy: {
        sourceHash: input.sourceHash,
        parserVersion: input.parserVersion,
        analysisModelVersion,
        templatePolicyVersion,
        expiresAt: expiresAt.toISOString()
      },
      retentionPolicy: {
        retainedFields,
        forbiddenFields,
        expiresAt: expiresAt.toISOString()
      }
    },
    candidateSummary: input.candidateSummary,
    sectionEvidence: input.sectionEvidence,
    sectionSummaries,
    experienceBullets: input.experienceBullets,
    projectBullets: input.projectBullets,
    skillEvidence: {
      skillsByCategory: input.skillsByCategory,
      requirementCoverage: input.requirementCoverage
    },
    skillsByCategory: input.skillsByCategory,
    education: input.education,
    certifications: input.certifications,
    languages: input.languages,
    atsEvidence: input.atsEvidence,
    atsAndActionableGaps: input.atsAndActionableGaps,
    confidenceFlags: input.confidenceFlags,
    contactRedactionPolicy: "contact_data_removed",
    privacy: {
      rawCvTextRetained: false,
      contactDataRetained: false,
      promptsRetained: false,
      providerPayloadRetained: false,
      storageIdentifierRetained: false
    }
  };
}

function extractUsableCvText(buffer: Buffer) {
  const decoded = redactContactData(
    replaceControlCharacters(buffer.toString("utf8"))
  );
  const normalized = decoded
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) {
    return "";
  }

  const printableCount = Array.from(normalized).filter((char) => {
    const code = char.charCodeAt(0);
    return char === "\n" || (code >= 32 && code !== 127);
  }).length;
  const printableRatio = printableCount / normalized.length;
  const usefulLineCount = normalized
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter((line) => /[A-Za-z]{3,}/.test(line)).length;

  if (printableRatio < 0.85 || usefulLineCount < 2) {
    return "";
  }

  return normalized.slice(0, 12000);
}

function splitCvSections(value: string) {
  const sections = new Map<string, string[]>();
  let currentSection = "summary";

  for (const rawLine of value.split("\n")) {
    const line = safeEvidenceText(rawLine);
    if (!line || /\[redacted-(email|phone)\]/i.test(line)) {
      continue;
    }

    const heading = normalizeHeading(line);
    const aliasedHeading = sectionHeadingAliases[heading];

    if (aliasedHeading) {
      currentSection = aliasedHeading;
      if (!sections.has(currentSection)) {
        sections.set(currentSection, []);
      }
      continue;
    }

    const existing = sections.get(currentSection) ?? [];
    if (existing.length < 16) {
      sections.set(currentSection, [...existing, line]);
    }
  }

  return sections;
}

function buildSectionEvidence(
  sections: Map<string, string[]>,
  latestAnalysis: SharedCvEvidenceLatestAnalysis
): SharedCvEvidenceSection[] {
  const fromParsed = Array.from(sections.entries())
    .map(([sectionName, lines]) => ({
      sectionName,
      summary: summarizeSection(lines, 280),
      confidence: "medium" as const,
      items: boundedList(lines, 6, 180)
    }))
    .filter((section) => section.summary.length > 0)
    .slice(0, 8);
  const fromLatest = latestSectionReviews(latestAnalysis).map((section) => ({
    sectionName: safeEvidenceText(section.sectionName),
    summary: boundedText(section.analysis, 280),
    confidence: "high" as const,
    items: section.actionPoints
      .filter(isString)
      .map((item) => boundedText(item, 180))
      .slice(0, 4)
  }));

  return dedupeSectionEvidence([...fromParsed, ...fromLatest]).slice(0, 10);
}

function dedupeSectionEvidence(sections: SharedCvEvidenceSection[]) {
  const seen = new Set<string>();
  const result: SharedCvEvidenceSection[] = [];

  for (const section of sections) {
    const key = section.sectionName.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(section);
    }
  }

  return result;
}

function latestSectionReviews(latestAnalysis: SharedCvEvidenceLatestAnalysis) {
  const sectionReviews =
    latestAnalysis && typeof latestAnalysis === "object"
      ? latestAnalysis.sectionReviews
      : null;
  if (!Array.isArray(sectionReviews)) {
    return [];
  }

  return sectionReviews.filter(isSectionReview).slice(0, 6);
}

function buildAtsAndActionables(
  latestAnalysis: SharedCvEvidenceLatestAnalysis
) {
  const topActionables =
    latestAnalysis &&
    typeof latestAnalysis === "object" &&
    Array.isArray(latestAnalysis.topActionables)
      ? latestAnalysis.topActionables.filter(isString)
      : [];
  const summary = atsSummary(latestAnalysis);

  return boundedList([...topActionables, summary ?? ""], 8, 220);
}

function buildConfidenceFlags(
  parsedText: string,
  hasParsedEvidence: boolean,
  hasLatestEvidence: boolean
) {
  const flags: string[] = [];

  if (hasParsedEvidence) {
    flags.push("backend parser extracted bounded structured CV evidence");
  }

  if (hasLatestEvidence) {
    flags.push("latest analyzer evidence available for grounding");
  }

  if (!parsedText) {
    flags.push(
      "stored CV bytes did not expose reliable plain text; generation must avoid unsupported details"
    );
  }

  if (!hasParsedEvidence && !hasLatestEvidence) {
    flags.push("only request summary and CV metadata are available");
  }

  return flags;
}

function latestAnalysisText(
  latestAnalysis: SharedCvEvidenceLatestAnalysis,
  key: "overallImpression",
  maxLength: number
) {
  if (!latestAnalysis || typeof latestAnalysis !== "object") {
    return "";
  }

  const value = latestAnalysis[key];
  return typeof value === "string" ? boundedText(value, maxLength) : "";
}

function atsScore(latestAnalysis: SharedCvEvidenceLatestAnalysis) {
  const ats =
    latestAnalysis && typeof latestAnalysis === "object"
      ? latestAnalysis.atsFriendliness
      : null;
  return readOptionalNumber(ats, "score");
}

function atsSummary(latestAnalysis: SharedCvEvidenceLatestAnalysis) {
  const ats =
    latestAnalysis && typeof latestAnalysis === "object"
      ? latestAnalysis.atsFriendliness
      : null;
  return readOptionalString(ats, "summary", 360);
}

function readStringList(
  value: unknown,
  key: string,
  maxItems: number,
  maxLength: number
) {
  if (!value || typeof value !== "object") {
    return [];
  }

  const candidate = (value as Record<string, unknown>)[key];
  return Array.isArray(candidate)
    ? boundedList(candidate.filter(isString), maxItems, maxLength)
    : [];
}

function readOptionalString(value: unknown, key: string, maxLength: number) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string"
    ? boundedText(candidate, maxLength)
    : null;
}

function readOptionalNumber(value: unknown, key: string) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function sectionLines(sections: Map<string, string[]>, sectionName: string) {
  return sections.get(sectionName) ?? [];
}

function summarizeSection(lines: string[], maxLength: number) {
  return boundedText(lines.slice(0, 3).join(" "), maxLength);
}

function parseSkillList(lines: string[]) {
  const skills = lines.flatMap((line) =>
    line
      .split(/[,|•;]+|\s+-\s+/g)
      .map((item) => safeEvidenceText(item))
      .filter((item) => item.length >= 2 && item.length <= 60)
  );

  return Array.from(new Set(skills.map((skill) => skill.toLowerCase()))).slice(
    0,
    30
  );
}

function boundedList(values: string[], maxItems: number, maxLength: number) {
  return Array.from(
    new Set(
      values.map((value) => boundedText(value, maxLength)).filter(Boolean)
    )
  ).slice(0, maxItems);
}

function boundedText(value: string, maxLength: number) {
  const normalized = safeEvidenceText(value);
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trim()}…`
    : normalized;
}

function safeEvidenceText(value: string) {
  return redactContactData(replaceControlCharacters(value))
    .replace(/<[^>]*>/g, " ")
    .replace(
      /\b(storageKey|authorization|Bearer|DATABASE_URL|OPENAI_API_KEY|API_KEY|BEGIN PRIVATE KEY)\b/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function redactContactData(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/(?:\+?\d(?:[\d\s().-]*\d){9,})/g, "[redacted-phone]");
}

function replaceControlCharacters(value: string) {
  let sanitized = "";

  for (const char of value) {
    const code = char.charCodeAt(0);
    sanitized += isControlCharacterCode(code) ? " " : char;
  }

  return sanitized;
}

function isControlCharacterCode(code: number) {
  return (
    (code >= 0 && code <= 8) ||
    code === 11 ||
    code === 12 ||
    (code >= 14 && code <= 31) ||
    code === 127
  );
}

function normalizeHeading(value: string) {
  return value
    .toLowerCase()
    .replace(/[:：]+$/g, "")
    .trim();
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function firstNonEmpty(values: (string | null | undefined)[]) {
  return values.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSectionReview(value: unknown): value is {
  sectionName: string;
  analysis: string;
  actionPoints: string[];
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<{
    sectionName: unknown;
    analysis: unknown;
    actionPoints: unknown;
  }>;
  return (
    typeof candidate.sectionName === "string" &&
    typeof candidate.analysis === "string" &&
    Array.isArray(candidate.actionPoints)
  );
}

function hashSource(
  metadata: SharedCvEvidenceMetadata,
  cvBytes?: Buffer,
  salt = ""
) {
  const hash = createHash("sha256");
  hash.update(metadata.id);
  hash.update(metadata.mimeType);
  hash.update(String(metadata.sizeBytes));
  hash.update(metadata.uploadedAt?.toISOString() ?? "");
  hash.update(metadata.expiresAt?.toISOString() ?? "");
  hash.update(salt);
  if (cvBytes) {
    hash.update(cvBytes);
  }
  return `sha256:${hash.digest("hex")}`;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
}
