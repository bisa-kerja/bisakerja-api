export { createAuthRouter } from "@/modules/auth/auth.route";
export { AuthService } from "@/modules/auth/auth.service";
export { PrismaAuthRepository } from "@/modules/auth/auth.repository";
export { FakeEmailProvider } from "@/modules/auth/auth.email";
export type {
  AuthRequestContext,
  AuthRepository,
  AuthRouterOptions,
  AuthSession,
  AuthUser,
  AuthUserWithCredential,
  CreateAccountInput,
  CreateRefreshTokenInput,
  EmailProvider,
  EmailVerificationTokenRecord,
  PasswordResetTokenRecord,
  RefreshTokenRecord
} from "@/modules/auth/auth.types";
