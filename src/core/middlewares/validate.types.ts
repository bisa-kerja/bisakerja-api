import type { ZodType } from "zod";

export type ValidationSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

export type ValidationIssue = {
  path: string;
  message: string;
  code: string;
};
