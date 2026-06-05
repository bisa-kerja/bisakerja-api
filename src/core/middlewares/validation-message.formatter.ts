import type { ValidationIssue } from "@/core/middlewares/validate.types";

type ZodIssueLike = {
  code: string;
  message: string;
  path: PropertyKey[];
  expected?: unknown;
  received?: unknown;
  input?: unknown;
  validation?: unknown;
  format?: unknown;
  type?: unknown;
  origin?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  inclusive?: unknown;
  keys?: unknown;
  values?: unknown;
  options?: unknown;
};

type FormattedIssue = ValidationIssue & {
  priority: number;
};

const genericIssueMessagePatterns = [
  /^invalid input/i,
  /^invalid [a-z0-9 _-]+$/i,
  /^too small/i,
  /^too big/i,
  /^unrecognized key/i,
  /^invalid option/i,
  /^invalid value/i,
  /^input is invalid$/i,
  /^format is invalid$/i,
  /^value is not supported$/i,
  /^input tidak valid$/i,
  /^format tidak valid$/i,
  /^nilai tidak didukung$/i
];

const sensitivePathKeywords = [
  "password",
  "token",
  "otp",
  "secret",
  "authorization",
  "apikey",
  "api_key",
  "refresh",
  "access"
];

const fieldLabelDictionary: Record<string, string> = {
  username: "Username",
  email: "Email",
  phoneNumber: "Phone number",
  password: "Password",
  confirmPassword: "Password confirmation",
  identifier: "Email or username",
  otp: "OTP",
  token: "Token",
  state: "State",
  code: "Code",
  page: "Page",
  limit: "Limit",
  keyword: "Keyword",
  location: "Location",
  province: "Province",
  city: "City",
  workType: "Work type",
  employmentType: "Employment type",
  experienceLevel: "Experience level",
  salaryMin: "Minimum salary",
  salaryMax: "Maximum salary",
  sourcePlatform: "Source platform",
  skill: "Skill",
  category: "Category",
  sort: "Sort",
  jobId: "Job ID",
  applicationId: "Application ID",
  status: "Status",
  notes: "Notes",
  source: "Source",
  persistResult: "Persist result",
  inputMode: "Input mode",
  compareSource: "Compare source",
  language: "Language",
  cvFileId: "CV file ID",
  displayName: "Display name",
  storageKey: "Storage key",
  url: "URL",
  mimeType: "MIME type",
  sizeBytes: "File size",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  title: "Title",
  company: "Company",
  startDate: "Start date",
  endDate: "End date",
  isCurrent: "Current status",
  description: "Description",
  institution: "Institution",
  degree: "Degree",
  fieldOfStudy: "Field of study",
  startYear: "Start year",
  endYear: "End year",
  careerStatus: "Career status",
  jobSeekingStatus: "Job seeking status",
  targetRoles: "Target roles",
  locations: "Target locations",
  workTypes: "Work type preferences",
  salaryExpectation: "Salary expectation",
  "salaryExpectation.min": "Minimum salary expectation",
  "salaryExpectation.max": "Maximum salary expectation",
  "salaryExpectation.currency": "Salary currency",
  "salaryExpectation.period": "Salary period",
  emailNotificationsEnabled: "Email notifications",
  runId: "Run ID",
  candidates: "Candidates",
  eventId: "Event ID",
  syncEventId: "Sync event ID",
  externalJobId: "External job ID",
  companyName: "Company name",
  sourceUrl: "Source URL",
  lastSeenAt: "Last seen time",
  jobs: "Jobs",
  requirements: "Requirements",
  values: "Values"
};

function toPath(path: PropertyKey[]): string {
  return path.map(String).join(".");
}

function toPathSegments(path: PropertyKey[]): string[] {
  return path.map(String);
}

function toSentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function humanizeSegment(segment: string) {
  return toSentenceCase(
    segment
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .trim()
  );
}

function resolveFieldLabel(path: PropertyKey[]) {
  const segments = toPathSegments(path);
  const dotPath = segments.join(".");
  if (fieldLabelDictionary[dotPath]) {
    return fieldLabelDictionary[dotPath];
  }

  const lastSegment = segments.at(-1);
  if (!lastSegment) {
    return "Input";
  }

  if (fieldLabelDictionary[lastSegment]) {
    return fieldLabelDictionary[lastSegment];
  }

  if (/^\d+$/.test(lastSegment)) {
    const index = Number.parseInt(lastSegment, 10);
    return `Item ${String(index + 1)}`;
  }

  return humanizeSegment(lastSegment);
}

function translateParsedType(value: unknown) {
  if (typeof value !== "string") {
    return "unknown";
  }

  switch (value) {
    case "string":
      return "string";
    case "number":
    case "int":
    case "float":
    case "bigint":
      return "number";
    case "boolean":
      return "boolean";
    case "date":
      return "date";
    case "array":
    case "set":
      return "array";
    case "object":
    case "record":
    case "map":
      return "object";
    case "null":
      return "null";
    case "undefined":
      return "undefined";
    default:
      return value;
  }
}

function isLikelyGenericIssueMessage(message: string) {
  return genericIssueMessagePatterns.some((pattern) => pattern.test(message));
}

function containsSensitiveKeyword(value: string) {
  const normalized = value.replace(/\s+/g, "").toLowerCase();
  return sensitivePathKeywords.some((keyword) => normalized.includes(keyword));
}

function isSensitivePath(path: PropertyKey[]) {
  return toPathSegments(path).some((segment) =>
    containsSensitiveKeyword(segment)
  );
}

function sanitizeMessage(message: string) {
  return message.replace(/\s+/g, " ").trim();
}

function toSafeNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  return null;
}

function translateInvalidFormat(format: unknown) {
  if (typeof format !== "string") {
    return null;
  }

  switch (format) {
    case "email":
      return "Use a complete email format, for example name@domain.com";
    case "url":
      return "Use a valid URL format";
    case "uuid":
      return "Use a valid UUID";
    case "date":
      return "Use a valid date format";
    case "datetime":
      return "Use a valid ISO datetime format";
    default:
      return null;
  }
}

function formatInvalidTypeMessage(issue: ZodIssueLike, fieldLabel: string) {
  const receivedFromMessage =
    /received\s+([a-z_]+)/i.exec(issue.message)?.[1]?.toLowerCase() ?? null;
  const received =
    typeof issue.received === "string"
      ? issue.received
      : (receivedFromMessage ?? null);

  if (received === "undefined") {
    return `${fieldLabel} is required`;
  }

  if (issue.expected) {
    return `${fieldLabel} must be a ${translateParsedType(issue.expected)}`;
  }

  return `${fieldLabel} has an invalid type`;
}

function formatTooSmallMessage(issue: ZodIssueLike, fieldLabel: string) {
  const minimum = toSafeNumber(issue.minimum);
  const origin =
    typeof issue.origin === "string"
      ? issue.origin
      : typeof issue.type === "string"
        ? issue.type
        : "";
  const inclusive =
    typeof issue.inclusive === "boolean" ? issue.inclusive : true;

  if (origin === "string" && minimum !== null) {
    return `${fieldLabel} must be at least ${String(minimum)} characters`;
  }

  if ((origin === "array" || origin === "set") && minimum !== null) {
    return `${fieldLabel} must contain at least ${String(minimum)} items`;
  }

  if (
    (origin === "number" || origin === "int" || origin === "bigint") &&
    minimum !== null
  ) {
    return inclusive
      ? `${fieldLabel} must be at least ${String(minimum)}`
      : `${fieldLabel} must be greater than ${String(minimum)}`;
  }

  return `${fieldLabel} is too small`;
}

function formatTooBigMessage(issue: ZodIssueLike, fieldLabel: string) {
  const maximum = toSafeNumber(issue.maximum);
  const origin =
    typeof issue.origin === "string"
      ? issue.origin
      : typeof issue.type === "string"
        ? issue.type
        : "";
  const inclusive =
    typeof issue.inclusive === "boolean" ? issue.inclusive : true;

  if (origin === "string" && maximum !== null) {
    return `${fieldLabel} must be at most ${String(maximum)} characters`;
  }

  if ((origin === "array" || origin === "set") && maximum !== null) {
    return `${fieldLabel} must contain at most ${String(maximum)} items`;
  }

  if (
    (origin === "number" || origin === "int" || origin === "bigint") &&
    maximum !== null
  ) {
    return inclusive
      ? `${fieldLabel} must be at most ${String(maximum)}`
      : `${fieldLabel} must be less than ${String(maximum)}`;
  }

  return `${fieldLabel} is too large`;
}

function formatInvalidValueMessage(issue: ZodIssueLike, fieldLabel: string) {
  const values = Array.isArray(issue.values)
    ? issue.values
    : Array.isArray(issue.options)
      ? issue.options
      : [];
  const safeValues = values
    .filter((value) => typeof value === "string" || typeof value === "number")
    .map(String)
    .filter((value) => !containsSensitiveKeyword(value))
    .slice(0, 8);

  if (safeValues.length > 0) {
    return `${fieldLabel} must be one of: ${safeValues.join(", ")}`;
  }

  return `${fieldLabel} is not supported`;
}

function getIssuePriority(code: string) {
  switch (code) {
    case "custom":
      return 100;
    case "unrecognized_keys":
      return 95;
    case "invalid_format":
    case "invalid_string":
    case "invalid_enum_value":
    case "invalid_value":
      return 90;
    case "too_small":
    case "too_big":
    case "not_multiple_of":
      return 80;
    case "invalid_type":
      return 70;
    case "invalid_union":
    case "invalid_key":
    case "invalid_element":
      return 60;
    default:
      return 50;
  }
}

function shouldKeepSchemaMessage(issue: ZodIssueLike) {
  const message = sanitizeMessage(issue.message);
  if (!message) {
    return false;
  }

  if (isLikelyGenericIssueMessage(message)) {
    return false;
  }

  return true;
}

function formatSingleIssue(issue: ZodIssueLike): FormattedIssue[] {
  if (issue.code === "unrecognized_keys" && Array.isArray(issue.keys)) {
    const keys = issue.keys.filter(
      (key): key is PropertyKey =>
        typeof key === "string" ||
        typeof key === "number" ||
        typeof key === "symbol"
    );

    return keys.map((key) => {
      const path = [...issue.path, key];
      const fieldLabel = resolveFieldLabel(path);
      return {
        path: toPath(path),
        code: issue.code,
        message: `${fieldLabel} is not recognized`,
        priority: getIssuePriority(issue.code)
      };
    });
  }

  const path = toPath(issue.path);
  const fieldLabel = resolveFieldLabel(issue.path);
  const customMessage = shouldKeepSchemaMessage(issue)
    ? sanitizeMessage(issue.message)
    : null;

  if (customMessage) {
    return [
      {
        path,
        code: issue.code,
        message: customMessage,
        priority: getIssuePriority(issue.code)
      }
    ];
  }

  let message: string;
  switch (issue.code) {
    case "invalid_type":
      message = formatInvalidTypeMessage(issue, fieldLabel);
      break;
    case "invalid_format":
    case "invalid_string": {
      const hint = translateInvalidFormat(issue.format ?? issue.validation);
      message = hint
        ? `${fieldLabel} is invalid. ${hint}`
        : `${fieldLabel} is invalid`;
      break;
    }
    case "too_small":
      message = formatTooSmallMessage(issue, fieldLabel);
      break;
    case "too_big":
      message = formatTooBigMessage(issue, fieldLabel);
      break;
    case "invalid_enum_value":
    case "invalid_value":
      message = formatInvalidValueMessage(issue, fieldLabel);
      break;
    case "not_multiple_of":
      message = `${fieldLabel} must be a valid multiple`;
      break;
    case "invalid_union":
    case "invalid_key":
    case "invalid_element":
      message = `${fieldLabel} has an unsupported format`;
      break;
    case "custom":
      message = `${fieldLabel} is invalid`;
      break;
    default:
      message = `${fieldLabel} is invalid`;
      break;
  }

  return [
    {
      path,
      code: issue.code,
      message,
      priority: getIssuePriority(issue.code)
    }
  ];
}

function combinePasswordIssues(path: string, issues: FormattedIssue[]) {
  const combined = Array.from(
    new Set(
      issues.map((issue) =>
        issue.message
          .replace(/^Kata sandi\s*/i, "")
          .replace(/^Password\s*/i, "")
          .replace(/^must\s*/i, "must ")
          .replace(/^has\s*/i, "has ")
          .replace(/^is\s*/i, "is ")
          .replace(/^harus\s*/i, "must ")
          .replace(/^minimal\s*/i, "at least ")
          .replace(/^maksimal\s*/i, "at most ")
          .replace(/karakter/gi, "characters")
          .replace(/mengandung huruf kecil/gi, "contain a lowercase letter")
          .replace(/mengandung huruf besar/gi, "contain an uppercase letter")
          .replace(/mengandung angka/gi, "contain a number")
          .replace(/mengandung simbol/gi, "contain a symbol")
          .trim()
      )
    )
  )
    .filter((message) => message.length > 0)
    .slice(0, 4);

  if (combined.length <= 1) {
    return issues[0];
  }

  return {
    path,
    code: "custom",
    message: `Password does not meet requirements: ${combined.join("; ")}`,
    priority: 100
  };
}

function deduplicateIssues(issues: FormattedIssue[]) {
  const grouped = new Map<string, FormattedIssue[]>();

  for (const issue of issues) {
    const bucket = grouped.get(issue.path) ?? [];
    bucket.push(issue);
    grouped.set(issue.path, bucket);
  }

  const deduplicated: FormattedIssue[] = [];

  for (const [path, bucket] of grouped) {
    const ordered = bucket
      .sort((left, right) => right.priority - left.priority)
      .filter((issue, index, list) => {
        return (
          list.findIndex(
            (candidate) =>
              candidate.message === issue.message &&
              candidate.code === issue.code
          ) === index
        );
      });

    if (path.endsWith("password")) {
      const passwordIssue = combinePasswordIssues(path, ordered);
      if (passwordIssue) {
        deduplicated.push(passwordIssue);
      }
      continue;
    }

    if (path.endsWith("phoneNumber") && ordered.length > 1) {
      const preferred = ordered.find(
        (issue) => issue.code === "invalid_format"
      );
      const phoneIssue = preferred ?? ordered[0];
      if (phoneIssue) {
        deduplicated.push(phoneIssue);
      }
      continue;
    }

    const maxPerField = isSensitivePath(path.split(".")) ? 1 : 2;
    deduplicated.push(...ordered.slice(0, maxPerField));
  }

  return deduplicated;
}

export function formatValidationIssues(
  issues: ZodIssueLike[]
): ValidationIssue[] {
  const flattened = issues.flatMap((issue) => formatSingleIssue(issue));
  const deduplicated = deduplicateIssues(flattened);
  return deduplicated.map(({ path, message, code }) => ({
    path,
    message: sanitizeMessage(message),
    code
  }));
}
