export const authErrorCodes = {
  emailAlreadyRegistered: "EMAIL_ALREADY_REGISTERED",
  usernameAlreadyRegistered: "USERNAME_ALREADY_REGISTERED",
  invalidCredentials: "INVALID_CREDENTIALS",
  emailNotVerified: "EMAIL_NOT_VERIFIED",
  passwordResetTokenExpired: "PASSWORD_RESET_TOKEN_EXPIRED",
  passwordResetTokenInvalid: "PASSWORD_RESET_TOKEN_INVALID",
  emailVerificationExpired: "EMAIL_VERIFICATION_EXPIRED",
  emailVerificationInvalid: "EMAIL_VERIFICATION_INVALID",
  googleSsoNotConfigured: "GOOGLE_SSO_NOT_CONFIGURED"
} as const;

export const genericForgotPasswordMessage =
  "Jika email terdaftar, instruksi reset kata sandi akan dikirim.";
