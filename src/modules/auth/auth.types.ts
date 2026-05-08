import type { RequestHandler } from "express";

import type { AppConfig } from "@/config/env";
import type {
  AsyncJobPublisher,
  EnqueueAsyncJobInput
} from "@/shared/async-workloads";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  onboardingStatus: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  createdAt: Date;
};

export type AuthRequestContext = {
  userId: string;
  user: AuthUser;
};

export type AuthSession = {
  accessToken: string;
  expiresIn: number;
  tokenType: "Bearer";
};

export type AuthCredentialRecord = {
  passwordHash: string;
  passwordHashAlgorithm: string;
};

export type AuthUserWithCredential = AuthUser & {
  status: "ACTIVE" | "DISABLED" | "DELETED";
  credential: AuthCredentialRecord | null;
};

export type RefreshTokenRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  tokenFamilyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthUserWithCredential;
};

export type PasswordResetTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type EmailVerificationTokenRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  usedAt: Date | null;
};

export type CreateAccountInput = {
  email: string;
  username: string;
  phoneNumber: string;
  passwordHash: string;
  passwordHashAlgorithm: string;
  verificationOtpHash: string;
  verificationExpiresAt: Date;
};

export type CreateRefreshTokenInput = {
  userId: string;
  tokenHash: string;
  tokenFamilyId: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
};

export type AuthRepository = {
  findUserByEmail(email: string): Promise<AuthUserWithCredential | null>;
  findUserByUsername(username: string): Promise<AuthUserWithCredential | null>;
  findUserById(userId: string): Promise<AuthUserWithCredential | null>;
  findUserByIdentifier(
    identifier: string
  ): Promise<AuthUserWithCredential | null>;
  createAccount(input: CreateAccountInput): Promise<AuthUser>;
  createAccountWithEmailVerificationJob(input: {
    account: CreateAccountInput;
    job: EnqueueAsyncJobInput<"auth.email-verification">;
  }): Promise<{ user: AuthUser; jobId: string }>;
  findActiveEmailVerificationToken(
    email: string,
    otpHash: string
  ): Promise<EmailVerificationTokenRecord | null>;
  markEmailVerified(
    userId: string,
    tokenId: string
  ): Promise<AuthUserWithCredential>;
  createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<void>;
  createPasswordResetTokenWithJob(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    job: EnqueueAsyncJobInput<"auth.password-reset">;
  }): Promise<{ jobId: string }>;
  findActivePasswordResetToken(
    tokenHash: string
  ): Promise<PasswordResetTokenRecord | null>;
  completePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
    passwordHashAlgorithm: string
  ): Promise<void>;
  createRefreshToken(
    input: CreateRefreshTokenInput
  ): Promise<RefreshTokenRecord>;
  findActiveRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  rotateRefreshToken(
    currentTokenId: string,
    input: CreateRefreshTokenInput
  ): Promise<RefreshTokenRecord>;
  revokeRefreshToken(tokenId: string): Promise<void>;
  revokeAllRefreshTokensForUser(userId: string): Promise<void>;
};

export type EmailProvider = {
  sendEmailVerification(input: {
    email: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void>;
  sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void>;
};

export type AuthServiceDependencies = {
  repository: AuthRepository;
  jobPublisher: AsyncJobPublisher;
  now?: () => Date;
};

export type AuthRouterOptions = Partial<AuthServiceDependencies> & {
  authMiddleware?: RequestHandler;
};

export type AuthCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

export type AuthControllerDependencies = AuthServiceDependencies & {
  config: AppConfig;
};
