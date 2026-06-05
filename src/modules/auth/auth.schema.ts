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
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be at most 30 characters")
  .regex(
    /^[a-z0-9_]+$/,
    "Username may only contain lowercase letters, numbers, and underscores, for example salman_123"
  )
  .transform((value) => value.toLowerCase());

const emailSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toLowerCase();
}, z.email("Email is invalid. Use a complete email format, for example name@domain.com"));

export const registerSchema = z
  .strictObject({
    username: usernameSchema,
    email: emailSchema,
    phoneNumber: z
      .string()
      .trim()
      .min(8, "Phone number must be at least 8 digits")
      .max(20, "Phone number must be at most 20 digits")
      .regex(
        /^\+?62[0-9]{7,16}$/,
        "Phone number is invalid. Use an Indonesian phone number, for example +628123456789"
      ),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Password confirmation is required")
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Password confirmation must match the password"
  });

export const loginSchema = z.strictObject({
  identifier: z
    .string()
    .trim()
    .min(3, "Email or username must be at least 3 characters")
    .max(254, "Email or username must be at most 254 characters")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must be at most 128 characters")
});

export const forgotPasswordSchema = z.strictObject({
  email: emailSchema
});

export const resetPasswordSchema = z
  .strictObject({
    token: z
      .string()
      .trim()
      .min(32, "Password reset token is invalid")
      .max(256, "Password reset token is invalid"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Password confirmation is required")
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Password confirmation must match the password"
  });

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  otp: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "OTP is invalid. Use 6 digits")
});

export const emptyBodySchema = z.strictObject({}).optional();

export const googleOauthExchangeSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(1, "OAuth code is required")
    .max(4096, "OAuth code is too long"),
  state: z
    .string()
    .trim()
    .min(16, "OAuth state is invalid")
    .max(512, "OAuth state is invalid")
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type GoogleOauthExchangeInput = z.infer<
  typeof googleOauthExchangeSchema
>;
