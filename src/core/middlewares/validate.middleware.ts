import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import { ValidationError } from "@/core/errors/app.error";
import type {
  ValidationIssue,
  ValidationSchemas
} from "@/core/middlewares/validate.types";
export type { ValidationSchemas } from "@/core/middlewares/validate.types";

function toValidationIssues(error: {
  issues: { path: PropertyKey[]; message: string; code: string }[];
}) {
  return error.issues.map<ValidationIssue>((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
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
      "Validation failed",
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
