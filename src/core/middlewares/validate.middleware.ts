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

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) {
        parsePart(schemas.params, req.params, (parsed) => {
          req.params = parsed as Request["params"];
        });
      }

      if (schemas.query) {
        parsePart(schemas.query, req.query, (parsed) => {
          req.query = parsed as Request["query"];
        });
      }

      if (schemas.body) {
        parsePart(schemas.body, req.body, (parsed) => {
          req.body = parsed;
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
