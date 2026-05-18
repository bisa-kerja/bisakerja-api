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
  phoneNumber: "Nomor telepon",
  password: "Kata sandi",
  confirmPassword: "Konfirmasi kata sandi",
  identifier: "Email atau username",
  otp: "OTP",
  token: "Token",
  state: "State",
  code: "Kode",
  page: "Halaman",
  limit: "Batas data",
  keyword: "Kata kunci",
  location: "Lokasi",
  province: "Provinsi",
  city: "Kota",
  workType: "Tipe kerja",
  employmentType: "Tipe pekerjaan",
  experienceLevel: "Level pengalaman",
  salaryMin: "Gaji minimum",
  salaryMax: "Gaji maksimum",
  sourcePlatform: "Platform sumber",
  skill: "Keahlian",
  category: "Kategori",
  sort: "Urutan",
  jobId: "ID lowongan",
  applicationId: "ID lamaran",
  status: "Status",
  notes: "Catatan",
  source: "Sumber",
  persistResult: "Simpan hasil",
  inputMode: "Mode input",
  compareSource: "Sumber perbandingan",
  language: "Bahasa",
  cvFileId: "ID file CV",
  displayName: "Nama tampilan",
  storageKey: "Kunci penyimpanan",
  url: "URL",
  mimeType: "Tipe MIME",
  sizeBytes: "Ukuran file",
  skills: "Keahlian",
  experience: "Pengalaman",
  education: "Pendidikan",
  title: "Judul",
  company: "Perusahaan",
  startDate: "Tanggal mulai",
  endDate: "Tanggal selesai",
  isCurrent: "Status saat ini",
  description: "Deskripsi",
  institution: "Institusi",
  degree: "Gelar",
  fieldOfStudy: "Bidang studi",
  startYear: "Tahun mulai",
  endYear: "Tahun selesai",
  careerStatus: "Status karier",
  jobSeekingStatus: "Status pencarian kerja",
  targetRoles: "Target peran",
  locations: "Lokasi target",
  workTypes: "Preferensi tipe kerja",
  salaryExpectation: "Ekspektasi gaji",
  "salaryExpectation.min": "Ekspektasi gaji minimum",
  "salaryExpectation.max": "Ekspektasi gaji maksimum",
  "salaryExpectation.currency": "Mata uang gaji",
  "salaryExpectation.period": "Periode gaji",
  emailNotificationsEnabled: "Notifikasi email",
  runId: "ID run",
  candidates: "Kandidat",
  eventId: "ID event",
  syncEventId: "ID sinkronisasi event",
  externalJobId: "ID lowongan eksternal",
  companyName: "Nama perusahaan",
  sourceUrl: "URL sumber",
  lastSeenAt: "Waktu terakhir terlihat",
  jobs: "Daftar lowongan",
  requirements: "Persyaratan",
  values: "Nilai"
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
    return `Item ke-${String(index + 1)}`;
  }

  return humanizeSegment(lastSegment);
}

function translateParsedType(value: unknown) {
  if (typeof value !== "string") {
    return "tidak diketahui";
  }

  switch (value) {
    case "string":
      return "teks";
    case "number":
    case "int":
    case "float":
    case "bigint":
      return "angka";
    case "boolean":
      return "boolean";
    case "date":
      return "tanggal";
    case "array":
    case "set":
      return "daftar";
    case "object":
    case "record":
    case "map":
      return "objek";
    case "null":
      return "null";
    case "undefined":
      return "tidak ada";
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
      return "Gunakan format email yang valid";
    case "url":
      return "Gunakan format URL yang valid";
    case "uuid":
      return "Gunakan format UUID yang valid";
    case "date":
      return "Gunakan format tanggal yang valid";
    case "datetime":
      return "Gunakan format datetime ISO yang valid";
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
    return `${fieldLabel} wajib diisi`;
  }

  if (issue.expected) {
    return `${fieldLabel} harus berupa ${translateParsedType(issue.expected)}`;
  }

  return `${fieldLabel} tidak sesuai tipe data`;
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
    return `${fieldLabel} minimal ${String(minimum)} karakter`;
  }

  if ((origin === "array" || origin === "set") && minimum !== null) {
    return `${fieldLabel} minimal ${String(minimum)} item`;
  }

  if (
    (origin === "number" || origin === "int" || origin === "bigint") &&
    minimum !== null
  ) {
    return inclusive
      ? `${fieldLabel} minimal ${String(minimum)}`
      : `${fieldLabel} harus lebih dari ${String(minimum)}`;
  }

  return `${fieldLabel} nilainya terlalu kecil`;
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
    return `${fieldLabel} maksimal ${String(maximum)} karakter`;
  }

  if ((origin === "array" || origin === "set") && maximum !== null) {
    return `${fieldLabel} maksimal ${String(maximum)} item`;
  }

  if (
    (origin === "number" || origin === "int" || origin === "bigint") &&
    maximum !== null
  ) {
    return inclusive
      ? `${fieldLabel} maksimal ${String(maximum)}`
      : `${fieldLabel} harus kurang dari ${String(maximum)}`;
  }

  return `${fieldLabel} nilainya terlalu besar`;
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
    return `${fieldLabel} harus salah satu dari: ${safeValues.join(", ")}`;
  }

  return `Nilai ${fieldLabel.toLowerCase()} tidak didukung`;
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
        message: `${fieldLabel} tidak dikenali`,
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
        ? `${fieldLabel} tidak valid. ${hint}`
        : `${fieldLabel} tidak valid`;
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
      message = `${fieldLabel} harus kelipatan yang valid`;
      break;
    case "invalid_union":
    case "invalid_key":
    case "invalid_element":
      message = `${fieldLabel} memiliki format yang tidak didukung`;
      break;
    case "custom":
      message = `${fieldLabel} tidak valid`;
      break;
    default:
      message = `${fieldLabel} tidak valid`;
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
          .replace(/^harus\s*/i, "harus ")
          .replace(/^minimal\s*/i, "minimal ")
          .replace(/^maksimal\s*/i, "maksimal ")
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
    message: `Kata sandi tidak memenuhi syarat: ${combined.join("; ")}`,
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
