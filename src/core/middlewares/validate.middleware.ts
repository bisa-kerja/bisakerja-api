import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import { ValidationError } from "@/core/errors/app.error";
import type {
  ValidationIssue,
  ValidationSchemas
} from "@/core/middlewares/validate.types";
export type { ValidationSchemas } from "@/core/middlewares/validate.types";

type ZodIssueLike = {
  code: string;
  message: string;
  path: PropertyKey[];
  expected?: unknown;
  received?: unknown;
  validation?: unknown;
  format?: unknown;
  type?: unknown;
  minimum?: unknown;
  maximum?: unknown;
  inclusive?: unknown;
  keys?: unknown;
};

function translateParsedType(value: unknown) {
  if (typeof value !== "string") {
    return "tidak diketahui";
  }

  switch (value) {
    case "string":
      return "teks";
    case "number":
      return "angka";
    case "boolean":
      return "boolean";
    case "date":
      return "tanggal";
    case "array":
      return "array";
    case "object":
      return "objek";
    case "null":
      return "null";
    case "undefined":
      return "tidak ada";
    default:
      return value;
  }
}

function translateInvalidString(validation: unknown) {
  if (validation === "email") {
    return "Format email tidak valid";
  }

  if (validation === "url") {
    return "Format URL tidak valid";
  }

  if (validation === "uuid") {
    return "Format UUID tidak valid";
  }

  if (validation === "date") {
    return "Format tanggal tidak valid";
  }

  if (validation === "datetime") {
    return "Format datetime tidak valid";
  }

  return "Format tidak valid";
}

function translateIssueMessage(issue: ZodIssueLike) {
  const code = issue.code;

  if (code === "custom") {
    return issue.message;
  }

  if (code === "invalid_type") {
    const received = (issue as unknown as { received?: unknown }).received;
    const expected = (issue as unknown as { expected?: unknown }).expected;

    if (received === "undefined") {
      return "Wajib diisi";
    }

    if (expected && received) {
      return `Tipe tidak sesuai: diharapkan ${translateParsedType(expected)}, diterima ${translateParsedType(received)}`;
    }

    return "Tipe tidak sesuai";
  }

  if (code === "invalid_string" || code === "invalid_format") {
    const validation = (issue as unknown as { validation?: unknown })
      .validation;
    const format = (issue as unknown as { format?: unknown }).format;
    return translateInvalidString(validation ?? format);
  }

  if (code === "too_small") {
    const type = (issue as unknown as { type?: unknown }).type;
    const minimum = (issue as unknown as { minimum?: unknown }).minimum;
    const inclusive = (issue as unknown as { inclusive?: unknown }).inclusive;
    const inclusiveFlag = typeof inclusive === "boolean" ? inclusive : true;

    if (type === "string" && typeof minimum === "number") {
      return `Minimal ${String(minimum)} karakter`;
    }

    if (type === "array" && typeof minimum === "number") {
      return `Minimal ${String(minimum)} item`;
    }

    if (type === "number" && typeof minimum === "number") {
      return inclusiveFlag
        ? `Minimal ${String(minimum)}`
        : `Harus lebih dari ${String(minimum)}`;
    }

    return "Nilai terlalu kecil";
  }

  if (code === "too_big") {
    const type = (issue as unknown as { type?: unknown }).type;
    const maximum = (issue as unknown as { maximum?: unknown }).maximum;
    const inclusive = (issue as unknown as { inclusive?: unknown }).inclusive;
    const inclusiveFlag = typeof inclusive === "boolean" ? inclusive : true;

    if (type === "string" && typeof maximum === "number") {
      return `Maksimal ${String(maximum)} karakter`;
    }

    if (type === "array" && typeof maximum === "number") {
      return `Maksimal ${String(maximum)} item`;
    }

    if (type === "number" && typeof maximum === "number") {
      return inclusiveFlag
        ? `Maksimal ${String(maximum)}`
        : `Harus kurang dari ${String(maximum)}`;
    }

    return "Nilai terlalu besar";
  }

  if (code === "invalid_enum_value") {
    return "Nilai tidak didukung";
  }

  if (code === "unrecognized_keys") {
    const keys = (issue as unknown as { keys?: unknown }).keys;
    if (Array.isArray(keys) && keys.length > 0) {
      return `Field tidak dikenal: ${keys.join(", ")}`;
    }
    return "Field tidak dikenal";
  }

  if (code === "invalid_literal") {
    return "Nilai tidak sesuai";
  }

  if (code === "invalid_union" || code === "invalid_intersection_types") {
    return "Format input tidak didukung";
  }

  if (code === "invalid_union_discriminator") {
    return "Format input tidak didukung";
  }

  return "Input tidak valid";
}

function toValidationIssues(error: { issues: ZodIssueLike[] }) {
  return error.issues.map<ValidationIssue>((issue) => ({
    path: issue.path.map(String).join("."),
    message: translateIssueMessage(issue),
    code: issue.code
  }));
}

function parsePart(
  schema: ZodType,
  value: unknown,
  assign: (parsed: unknown) => void
) {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ValidationError(
      "Validasi gagal",
      toValidationIssues(result.error)
    );
  }

  assign(result.data);
}

function replaceRequestPart(
  req: Request,
  key: "params" | "query" | "body",
  value: unknown
) {
  Object.defineProperty(req, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value
  });
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        parsePart(schemas.params, req.params, (parsed) => {
          replaceRequestPart(req, "params", parsed);
        });
      }

      if (schemas.query) {
        parsePart(schemas.query, req.query, (parsed) => {
          replaceRequestPart(req, "query", parsed);
        });
      }

      if (schemas.body) {
        parsePart(schemas.body, req.body, (parsed) => {
          replaceRequestPart(req, "body", parsed);
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
