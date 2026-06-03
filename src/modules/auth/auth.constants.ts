export const authErrorCodes = {
  emailAlreadyRegistered: "EMAIL_ALREADY_REGISTERED",
  usernameAlreadyRegistered: "USERNAME_ALREADY_REGISTERED",
  invalidCredentials: "INVALID_CREDENTIALS",
  emailNotVerified: "EMAIL_NOT_VERIFIED",
  passwordResetTokenExpired: "PASSWORD_RESET_TOKEN_EXPIRED",
  passwordResetTokenInvalid: "PASSWORD_RESET_TOKEN_INVALID",
  emailVerificationExpired: "EMAIL_VERIFICATION_EXPIRED",
  emailVerificationInvalid: "EMAIL_VERIFICATION_INVALID",
  googleSsoNotConfigured: "GOOGLE_SSO_NOT_CONFIGURED",
  googleOauthStateInvalid: "GOOGLE_OAUTH_STATE_INVALID",
  googleOauthNonceInvalid: "GOOGLE_OAUTH_NONCE_INVALID",
  googleOauthCodeInvalid: "GOOGLE_OAUTH_CODE_INVALID",
  googleOauthTokenInvalid: "GOOGLE_OAUTH_TOKEN_INVALID",
  googleOauthEmailUnverified: "GOOGLE_OAUTH_EMAIL_UNVERIFIED",
  googleOauthAccountAlreadyLinked: "GOOGLE_OAUTH_ACCOUNT_ALREADY_LINKED"
} as const;

export const genericForgotPasswordMessage =
  "If the email is registered, password reset instructions will be sent";
