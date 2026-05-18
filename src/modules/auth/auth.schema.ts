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
  .min(3, "Username minimal 3 karakter")
  .max(30, "Username maksimal 30 karakter")
  .regex(
    /^[a-z0-9_]+$/,
    "Username hanya boleh berisi huruf kecil, angka, dan underscore, contoh salman_123"
  )
  .transform((value) => value.toLowerCase());

const emailSchema = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }

  return value.trim().toLowerCase();
}, z.email("Email tidak valid. Gunakan format email lengkap, contoh nama@domain.com"));

export const registerSchema = z
  .strictObject({
    username: usernameSchema,
    email: emailSchema,
    phoneNumber: z
      .string()
      .trim()
      .min(8, "Nomor telepon minimal 8 digit")
      .max(20, "Nomor telepon maksimal 20 digit")
      .regex(
        /^\+?62[0-9]{7,16}$/,
        "Nomor telepon tidak valid. Gunakan nomor Indonesia, contoh +628123456789"
      ),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi")
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sesuai. Samakan dengan kata sandi"
  });

export const loginSchema = z.strictObject({
  identifier: z
    .string()
    .trim()
    .min(3, "Email atau username minimal 3 karakter")
    .max(254, "Email atau username maksimal 254 karakter")
    .transform((value) => value.toLowerCase()),
  password: z
    .string()
    .min(1, "Kata sandi wajib diisi")
    .max(128, "Kata sandi maksimal 128 karakter")
});

export const forgotPasswordSchema = z.strictObject({
  email: emailSchema
});

export const resetPasswordSchema = z
  .strictObject({
    token: z
      .string()
      .trim()
      .min(32, "Token reset kata sandi tidak valid")
      .max(256, "Token reset kata sandi tidak valid"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Konfirmasi kata sandi wajib diisi")
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi kata sandi tidak sesuai. Samakan dengan kata sandi"
  });

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  otp: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/, "OTP tidak valid. Gunakan 6 digit angka")
});

export const emptyBodySchema = z.strictObject({}).optional();

export const googleOauthExchangeSchema = z.strictObject({
  code: z
    .string()
    .trim()
    .min(1, "Kode OAuth wajib diisi")
    .max(4096, "Kode OAuth terlalu panjang"),
  state: z
    .string()
    .trim()
    .min(16, "State OAuth tidak valid")
    .max(512, "State OAuth tidak valid")
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type GoogleOauthExchangeInput = z.infer<
  typeof googleOauthExchangeSchema
>;
