import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12, "Kata sandi minimal 12 karakter")
  .max(128, "Kata sandi maksimal 128 karakter")
  .regex(/[a-z]/, "Kata sandi harus mengandung huruf kecil")
  .regex(/[A-Z]/, "Kata sandi harus mengandung huruf besar")
  .regex(/[0-9]/, "Kata sandi harus mengandung angka")
  .regex(/[^A-Za-z0-9]/, "Kata sandi harus mengandung simbol");

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(
    /^[a-z0-9_]+$/,
    "Username hanya boleh berisi huruf kecil, angka, dan underscore"
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
      .regex(/^\+?62[0-9]{7,16}$/, "Nomor telepon harus nomor Indonesia"),
    password: passwordSchema,
    confirmPassword: z.string()
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sesuai"
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
    message: "Konfirmasi kata sandi tidak sesuai"
  });

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  otp: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "OTP harus terdiri dari 6 digit")
});

export const emptyBodySchema = z.strictObject({}).optional();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
