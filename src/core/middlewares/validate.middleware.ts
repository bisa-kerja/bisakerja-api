import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import { ValidationError } from "@/core/errors/app.error";
import { formatValidationIssues } from "@/core/middlewares/validation-message.formatter";
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
  origin?: unknown;
  values?: unknown;
  options?: unknown;
};

function toValidationIssues(error: { issues: ZodIssueLike[] }) {
  return formatValidationIssues(error.issues) satisfies ValidationIssue[];
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
