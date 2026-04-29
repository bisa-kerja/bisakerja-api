import { describe, expect, test } from "bun:test";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

import { ValidationError } from "@/core/errors/app.error";
import { validate } from "@/core/middlewares/validate.middleware";

describe("validate middleware", () => {
  test("replaces readonly query and params getters with parsed values", () => {
    const middleware = validate({
      params: z.strictObject({
        jobId: z.uuid()
      }),
      query: z.strictObject({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20)
      })
    });
    const params = {
      jobId: "11111111-1111-4111-8111-111111111111"
    };
    const query = {
      page: "2",
      limit: "10"
    };
    const req = {} as Request;

    Object.defineProperty(req, "params", {
      configurable: true,
      enumerable: true,
      get: () => params
    });
    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      get: () => query
    });
    req.body = {};

    let nextError: unknown;

    middleware(
      req,
      {} as Response,
      ((error?: unknown) => {
        nextError = error;
      }) as NextFunction
    );

    expect(nextError).toBeUndefined();
    expect(req.params as unknown).toEqual({
      jobId: "11111111-1111-4111-8111-111111111111"
    });
    expect(req.query as unknown).toEqual({
      page: 2,
      limit: 10
    });
    expect(params).toEqual({
      jobId: "11111111-1111-4111-8111-111111111111"
    });
    expect(query).toEqual({
      page: "2",
      limit: "10"
    });
  });

  test("returns validation error for invalid readonly query", () => {
    const middleware = validate({
      query: z.strictObject({
        page: z.coerce.number().int().min(1),
        limit: z.coerce.number().int().min(1).max(100)
      })
    });
    const query = {
      page: "0",
      limit: "500"
    };
    const req = {} as Request;

    Object.defineProperty(req, "query", {
      configurable: true,
      enumerable: true,
      get: () => query
    });
    req.params = {};
    req.body = {};

    let nextError: unknown;

    middleware(
      req,
      {} as Response,
      ((error?: unknown) => {
        nextError = error;
      }) as NextFunction
    );

    expect(nextError).toBeInstanceOf(ValidationError);
    expect(query).toEqual({
      page: "0",
      limit: "500"
    });
  });
});
