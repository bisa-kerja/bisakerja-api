import { randomUUID } from "node:crypto";

import type { AppConfig } from "@/config/env";
import { logger } from "@/config/logger";
import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  ConflictError,
  NotImplementedError
} from "@/core/errors/app.error";
import type { AsyncJobPublisher } from "@/shared/async-workloads/async-workloads.types";
import { toAsyncJobIdempotencyKey } from "@/shared/async-workloads/async-workloads.utils";
import {
  authErrorCodes,
  genericForgotPasswordMessage
} from "@/modules/auth/auth.constants";
import { buildAuthEmailIdempotencyKey } from "@/modules/auth/auth.email";
import type {
  AuthRepository,
  AuthSession,
  AuthUser,
  AuthUserWithCredential,
  CreateRefreshTokenInput
} from "@/modules/auth/auth.types";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput
} from "@/modules/auth/auth.schema";
import {
  hashPassword,
  passwordHashAlgorithm,
  verifyPassword
} from "@/shared/utils/password";
import {
  createNumericOtp,
  createOpaqueToken,
  hashToken
} from "@/shared/utils/token";
import { issueAccessToken } from "@/shared/utils/jwt";
import { parseDurationMs } from "@/shared/utils/ttl";
import type { GoogleOauthAdapter } from "@/modules/auth/auth.google";

export type IssueContext = {
  userAgent?: string;
  ipAddress?: string;
};

type AuthSessionResult = {
  user: AuthUser;
  session: AuthSession;
  refreshToken: string;
};

export class AuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: AuthRepository,
    private readonly jobPublisher: AsyncJobPublisher,
    private readonly now: () => Date = () => new Date(),
    private readonly googleOauth?: GoogleOauthAdapter
  ) {}

  async register(
    input: RegisterInput,
    requestId?: string
  ): Promise<{ user: AuthUser; session: AuthSession }> {
    const existingEmail = await this.repository.findUserByEmail(input.email);

    if (existingEmail) {
      throw new ConflictError(
        "Email is already registered",
        authErrorCodes.emailAlreadyRegistered
      );
    }

    const existingUsername = await this.repository.findUserByUsername(
      input.username
    );

    if (existingUsername) {
      throw new ConflictError(
        "Username is already registered",
        authErrorCodes.usernameAlreadyRegistered
      );
    }

    const passwordHash = await hashPassword(input.password);
    const otp = createNumericOtp();
    const verificationExpiresAt = this.futureDate(
      this.config.auth.emailVerificationOtpTtl
    );
    const result = await this.repository.createAccountWithEmailVerificationJob({
      account: {
        email: input.email,
        username: input.username,
        phoneNumber: input.phoneNumber,
        passwordHash,
        passwordHashAlgorithm,
        verificationOtpHash: this.hashCredential(otp),
        verificationExpiresAt
      },
      job: {
        jobType: "auth.email-verification",
        requestId: requestId ?? null,
        actorId: null,
        idempotencyKey: toAsyncJobIdempotencyKey(
          "auth.email-verification",
          buildAuthEmailIdempotencyKey(
            "auth-email-verification",
            input.email,
            verificationExpiresAt
          )
        ),
        payload: {
          email: input.email,
          otp,
          expiresAt: verificationExpiresAt.toISOString()
        },
        maxAttempts: this.config.asyncWorkloads.maxAttempts
      }
    });

    this.triggerAsyncPublish(result.jobId, "auth.register.email-verification");

    return {
      user: result.user,
      session: issueAccessToken(this.config, toAccessTokenInput(result.user))
    };
  }

  async login(
    input: LoginInput,
    context: IssueContext = {}
  ): Promise<AuthSessionResult> {
    const user = await this.repository.findUserByIdentifier(input.identifier);

    const localCredential = user?.credentials.find(
      (credential) => credential.provider === "LOCAL"
    );

    if (!user || !localCredential?.passwordHash) {
      throw invalidCredentials();
    }

    const passwordMatches = await verifyPassword(
      localCredential.passwordHash,
      input.password
    );

    if (!passwordMatches) {
      throw invalidCredentials();
    }

    this.assertLoginAllowed(user);

    return this.issueSession(user, context);
  }

  startGoogleLogin(input: { state: string; nonce: string }): {
    authorizeUrl: string;
  } {
    const adapter = this.requireGoogleOauthAdapter();
    return { authorizeUrl: adapter.generateAuthorizeUrl(input) };
  }

  async loginWithGoogleAuthorizationCode(
    input: {
      code: string;
      expectedNonce: string;
    },
    context: IssueContext = {}
  ): Promise<AuthSessionResult> {
    const adapter = this.requireGoogleOauthAdapter();

    const profile = await adapter.exchangeCodeForProfile({
      code: input.code,
      expectedNonce: input.expectedNonce
    });

    if (!profile.emailVerified) {
      throw new AuthorizationError(
        "Google email is not verified",
        authErrorCodes.googleOauthEmailUnverified
      );
    }

    const existingByProvider = await this.repository.findUserByGoogleAccountId(
      profile.providerAccountId
    );

    if (existingByProvider) {
      this.assertLoginAllowed(existingByProvider);
      return this.issueSession(existingByProvider, context);
    }

    const existingByEmail = await this.repository.findUserByEmail(
      profile.email
    );

    if (existingByEmail) {
      if (existingByEmail.status !== "ACTIVE") {
        throw invalidCredentials();
      }
      const alreadyLinked = existingByEmail.credentials.find(
        (credential) => credential.provider === "GOOGLE"
      );

      if (
        alreadyLinked &&
        alreadyLinked.providerAccountId !== profile.providerAccountId
      ) {
        throw new ConflictError(
          "Akun sudah terhubung dengan akun Google lain",
          authErrorCodes.googleOauthAccountAlreadyLinked
        );
      }

      if (!alreadyLinked) {
        await this.repository.linkGoogleCredential({
          userId: existingByEmail.id,
          providerAccountId: profile.providerAccountId
        });
      }

      if (!existingByEmail.emailVerified) {
        await this.repository.markEmailVerifiedAt(
          existingByEmail.id,
          this.now()
        );
      }

      const refreshed = await this.repository.findUserById(existingByEmail.id);
      if (!refreshed) {
        throw unauthenticated();
      }
      return this.issueSession(refreshed, context);
    }

    const username = await this.buildUsernameForGoogle(profile.email);
    const created = await this.repository.createGoogleAccount({
      email: profile.email,
      username,
      providerAccountId: profile.providerAccountId,
      emailVerifiedAt: this.now()
    });

    this.assertLoginAllowed(created);
    return this.issueSession(created, context);
  }

  async refresh(
    rawRefreshToken: string | undefined,
    context: IssueContext = {}
  ): Promise<AuthSessionResult> {
    if (!rawRefreshToken) {
      throw new AuthenticationError();
    }

    const tokenHash = this.hashCredential(rawRefreshToken);
    const current = await this.repository.findActiveRefreshToken(tokenHash);

    if (!current) {
      throw unauthenticated();
    }

    if (current.expiresAt <= this.now()) {
      await this.repository.revokeRefreshToken(current.id);
      throw unauthenticated();
    }

    this.assertLoginAllowed(current.user);

    const rawNextRefreshToken = createOpaqueToken();
    await this.repository.rotateRefreshToken(
      current.id,
      this.buildRefreshTokenInput(current.userId, rawNextRefreshToken, {
        ...context,
        tokenFamilyId: current.tokenFamilyId
      })
    );

    return this.buildSessionResult(current.user, rawNextRefreshToken);
  }

  async logout(userId: string, rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) {
      return;
    }

    const current = await this.repository.findActiveRefreshToken(
      this.hashCredential(rawRefreshToken)
    );

    if (current?.userId === userId) {
      await this.repository.revokeRefreshToken(current.id);
    }
  }

  async forgotPassword(
    input: ForgotPasswordInput,
    requestId?: string
  ): Promise<{ message: string }> {
    const user = await this.repository.findUserByEmail(input.email);

    if (user?.status === "ACTIVE") {
      const token = createOpaqueToken();
      const expiresAt = this.futureDate(this.config.auth.passwordResetTokenTtl);

      const result = await this.repository.createPasswordResetTokenWithJob({
        userId: user.id,
        tokenHash: this.hashCredential(token),
        expiresAt,
        job: {
          jobType: "auth.password-reset",
          requestId: requestId ?? null,
          actorId: user.id,
          idempotencyKey: toAsyncJobIdempotencyKey(
            "auth.password-reset",
            buildAuthEmailIdempotencyKey(
              "auth-password-reset",
              input.email,
              expiresAt
            )
          ),
          payload: {
            email: input.email,
            token,
            expiresAt: expiresAt.toISOString()
          },
          maxAttempts: this.config.asyncWorkloads.maxAttempts
        }
      });

      this.triggerAsyncPublish(result.jobId, "auth.forgot-password.email");
    }

    return { message: genericForgotPasswordMessage };
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const token = await this.repository.findActivePasswordResetToken(
      this.hashCredential(input.token)
    );

    if (!token) {
      throw new BadRequestError(
        "Password reset token is invalid",
        authErrorCodes.passwordResetTokenInvalid
      );
    }

    if (token.expiresAt <= this.now()) {
      throw new BadRequestError(
        "Password reset token has expired",
        authErrorCodes.passwordResetTokenExpired
      );
    }

    const passwordHash = await hashPassword(input.password);
    await this.repository.completePasswordReset(
      token.id,
      token.userId,
      passwordHash,
      passwordHashAlgorithm
    );
  }

  async verifyEmail(
    input: VerifyEmailInput,
    context: IssueContext = {}
  ): Promise<AuthSessionResult> {
    const token = await this.repository.findActiveEmailVerificationToken(
      input.email,
      this.hashCredential(input.otp)
    );

    if (!token) {
      throw new BadRequestError(
        "Email verification OTP is invalid",
        authErrorCodes.emailVerificationInvalid
      );
    }

    if (token.expiresAt <= this.now()) {
      throw new BadRequestError(
        "Email verification OTP has expired",
        authErrorCodes.emailVerificationExpired
      );
    }

    const user = await this.repository.markEmailVerified(
      token.userId,
      token.id
    );
    return this.issueSession(user, context);
  }

  googleSsoPlaceholder(): never {
    throw new NotImplementedError(
      "Google SSO belum dikonfigurasi",
      authErrorCodes.googleSsoNotConfigured
    );
  }

  private async issueSession(
    user: AuthUserWithCredential,
    context: IssueContext
  ): Promise<AuthSessionResult> {
    const rawRefreshToken = createOpaqueToken();
    await this.repository.createRefreshToken(
      this.buildRefreshTokenInput(user.id, rawRefreshToken, context)
    );

    return this.buildSessionResult(user, rawRefreshToken);
  }

  private buildRefreshTokenInput(
    userId: string,
    rawRefreshToken: string,
    context: IssueContext & { tokenFamilyId?: string }
  ): CreateRefreshTokenInput {
    return {
      userId,
      tokenHash: this.hashCredential(rawRefreshToken),
      tokenFamilyId: context.tokenFamilyId ?? randomUUID(),
      expiresAt: this.futureDate(this.config.auth.refreshTokenTtl),
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null
    };
  }

  private hashCredential(value: string): string {
    return hashToken(value, this.config.auth.refreshTokenSecret);
  }

  private futureDate(ttl: string): Date {
    return new Date(this.now().getTime() + parseDurationMs(ttl));
  }

  private assertLoginAllowed(user: AuthUserWithCredential): void {
    if (user.status !== "ACTIVE") {
      throw invalidCredentials();
    }

    if (!user.emailVerified) {
      throw new AuthorizationError(
        "Email verification is required",
        authErrorCodes.emailNotVerified
      );
    }
  }

  private buildSessionResult(
    user: AuthUserWithCredential,
    refreshToken: string
  ): AuthSessionResult {
    return {
      user: safeUser(user),
      session: issueAccessToken(this.config, toAccessTokenInput(user)),
      refreshToken
    };
  }

  private triggerAsyncPublish(jobId: string, operation: string) {
    void this.jobPublisher.publish(jobId).catch((error: unknown) => {
      logger.warn(
        {
          error,
          jobId,
          operation
        },
        "Async job publish failed; pending outbox recovery required"
      );
    });
  }

  private assertGoogleOauthReady() {
    if (!this.config.integrations.googleOauth.enabled) {
      this.googleSsoPlaceholder();
    }

    if (!this.googleOauth) {
      throw new NotImplementedError(
        "Google SSO belum dikonfigurasi",
        authErrorCodes.googleSsoNotConfigured
      );
    }
  }

  private requireGoogleOauthAdapter(): GoogleOauthAdapter {
    this.assertGoogleOauthReady();
    if (!this.googleOauth) {
      this.googleSsoPlaceholder();
    }
    return this.googleOauth;
  }

  private async buildUsernameForGoogle(email: string): Promise<string> {
    const base = sanitizeUsername(email.split("@")[0] ?? "user");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const suffix =
        attempt === 0
          ? ""
          : `_${String(Math.floor(Math.random() * 10_000)).padStart(4, "0")}`;
      const candidate = trimUsername(`${base}${suffix}`);
      const existing = await this.repository.findUserByUsername(candidate);
      if (!existing) {
        return candidate;
      }
    }

    return trimUsername(`user_${createNumericOtp()}`);
  }
}

function sanitizeUsername(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "user";
}

function trimUsername(value: string) {
  const trimmed = value.slice(0, 30);
  if (trimmed.length >= 3) {
    return trimmed;
  }
  return `${trimmed}${"0".repeat(3 - trimmed.length)}`;
}

function invalidCredentials() {
  return new AuthenticationError(
    "Email, username, or password is invalid",
    authErrorCodes.invalidCredentials
  );
}

function unauthenticated() {
  return new AuthenticationError("Autentikasi diperlukan", "UNAUTHENTICATED");
}

function safeUser(user: AuthUserWithCredential): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    onboardingStatus: user.onboardingStatus,
    createdAt: user.createdAt
  };
}

function toAccessTokenInput(user: AuthUser) {
  return {
    userId: user.id,
    email: user.email,
    username: user.username
  };
}
