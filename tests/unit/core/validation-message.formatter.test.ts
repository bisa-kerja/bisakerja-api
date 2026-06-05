import { describe, expect, test } from "bun:test";
import { z } from "zod";

import { formatValidationIssues } from "@/core/middlewares/validation-message.formatter";
import { registerSchema } from "@/modules/auth/auth.schema";

function parseIssues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) {
    throw new Error("Expected schema validation to fail.");
  }

  return formatValidationIssues(result.error.issues);
}

describe("validation message formatter", () => {
  test("formats required and invalid type messages with field labels", () => {
    const issues = parseIssues(
      z.strictObject({
        email: z.email(),
        age: z.int()
      }),
      {
        age: "dua puluh"
      }
    );

    expect(issues).toContainEqual({
      path: "email",
      code: "invalid_type",
      message: "Email is required"
    });
    expect(issues).toContainEqual({
      path: "age",
      code: "invalid_type",
      message: "Age must be a number"
    });
  });

  test("preserves schema custom messages and deduplicates phone number noise", () => {
    const issues = parseIssues(registerSchema, {
      username: "SALMAN!",
      email: "invalid-email",
      phoneNumber: "0812",
      password: "weak",
      confirmPassword: "different"
    });

    expect(issues).toContainEqual({
      path: "username",
      code: "invalid_format",
      message:
        "Username may only contain lowercase letters, numbers, and underscores, for example salman_123"
    });
    expect(issues).toContainEqual({
      path: "phoneNumber",
      code: "invalid_format",
      message:
        "Phone number is invalid. Use an Indonesian phone number, for example +628123456789"
    });

    const passwordIssue = issues.find((issue) => issue.path === "password");
    expect(passwordIssue).toBeDefined();
    expect(passwordIssue?.message).toContain(
      "Password does not meet requirements"
    );
    expect(passwordIssue?.message).toContain("at least 12 characters");
    expect(passwordIssue?.message).toContain("uppercase letter");
  });

  test("formats unrecognized keys into field-level details", () => {
    const issues = parseIssues(
      z.strictObject({
        username: z.string()
      }),
      {
        username: "salman",
        unknownField: true
      }
    );

    expect(issues).toContainEqual({
      path: "unknownField",
      code: "unrecognized_keys",
      message: "Unknown Field is not recognized"
    });
  });

  test("resolves nested labels for numeric constraints", () => {
    const issues = parseIssues(
      z.strictObject({
        salaryExpectation: z.strictObject({
          min: z.number().nonnegative()
        })
      }),
      {
        salaryExpectation: {
          min: -1
        }
      }
    );

    expect(issues).toContainEqual({
      path: "salaryExpectation.min",
      code: "too_small",
      message: "Minimum salary expectation must be at least 0"
    });
  });

  test("formats enum violations with allowed values", () => {
    const issues = parseIssues(
      z.strictObject({
        workType: z.enum(["REMOTE", "HYBRID", "ONSITE"])
      }),
      {
        workType: "WFH"
      }
    );

    const workTypeIssue = issues.find((issue) => issue.path === "workType");
    expect(workTypeIssue).toBeDefined();
    expect(workTypeIssue?.message).toContain("Work type must be one of");
    expect(workTypeIssue?.message).toContain("REMOTE");
    expect(workTypeIssue?.message).toContain("HYBRID");
    expect(workTypeIssue?.message).toContain("ONSITE");
  });
});
