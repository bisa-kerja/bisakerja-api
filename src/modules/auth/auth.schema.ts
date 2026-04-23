import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^A-Za-z0-9]/, "Password must contain a symbol");

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(
    /^[a-z0-9_]+$/,
    "Username may contain lowercase letters, numbers, and underscores"
  )
  .transform((value) => value.toLowerCase());

const emailSchema = z.email().trim().toLowerCase();

export const registerSchema = z
  .strictObject({
    username: usernameSchema,
    email: emailSchema,
    phoneNumber: z
      .string()
      .trim()
      .min(8)
      .max(20)
      .regex(/^\+?62[0-9]{7,16}$/, "Phone number must be an Indonesian number"),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Password confirmation does not match"
  });

export const loginSchema = z.strictObject({
  identifier: z
    .string()
    .trim()
    .min(3)
    .max(254)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128)
});

export const forgotPasswordSchema = z.strictObject({
  email: emailSchema
});

export const resetPasswordSchema = z
  .strictObject({
    token: z.string().trim().min(32).max(256),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Password confirmation does not match"
  });

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  otp: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "OTP must contain 6 digits")
});

export const emptyBodySchema = z.strictObject({}).optional();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
