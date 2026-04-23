import type { AppConfig } from "@/config/env";
import {
  AuthenticationError,
  AuthorizationError,
  BadRequestError,
  ConflictError,
  NotImplementedError
} from "@/core/errors/app.error";
import {
  authErrorCodes,
  genericForgotPasswordMessage
} from "@/modules/auth/auth.constants";
import type {
  AuthRepository,
  AuthSession,
  AuthUser,
  AuthUserWithCredential,
  CreateRefreshTokenInput,
  EmailProvider
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
import { parseDurationMs } from "@/shared/utils/ttl";
import { issueAccessToken } from "@/shared/utils/jwt";

export type IssueContext = {
  userAgent?: string;
  ipAddress?: string;
};

export class AuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: AuthRepository,
    private readonly emailProvider: EmailProvider,
    private readonly now: () => Date = () => new Date()
  ) {}

  async register(input: RegisterInput): Promise<{ user: AuthUser }> {
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
    const user = await this.repository.createAccount({
      email: input.email,
      username: input.username,
      phoneNumber: input.phoneNumber,
      passwordHash,
      passwordHashAlgorithm,
      verificationOtpHash: this.hashCredential(otp),
      verificationExpiresAt
    });

    await this.emailProvider.sendEmailVerification({
      email: input.email,
      otp,
      expiresAt: verificationExpiresAt
    });

    return { user };
  }

  async login(
    input: LoginInput,
    context: IssueContext = {}
  ): Promise<{ user: AuthUser; session: AuthSession; refreshToken: string }> {
    const user = await this.repository.findUserByIdentifier(input.identifier);

    if (!user?.credential) {
      throw invalidCredentials();
    }

    const passwordMatches = await verifyPassword(
      user.credential.passwordHash,
      input.password
    );

    if (!passwordMatches) {
      throw invalidCredentials();
    }

    this.assertLoginAllowed(user);

    return this.issueSession(user, context);
  }

  async refresh(
    rawRefreshToken: string | undefined,
    context: IssueContext = {}
  ): Promise<{ user: AuthUser; session: AuthSession; refreshToken: string }> {
    if (!rawRefreshToken) {
      throw new AuthenticationError();
    }

    const tokenHash = this.hashCredential(rawRefreshToken);
    const current = await this.repository.findActiveRefreshToken(tokenHash);

    if (!current) {
      throw new AuthenticationError(
        "Authentication required",
        "UNAUTHENTICATED"
      );
    }

    if (current.expiresAt <= this.now()) {
      await this.repository.revokeRefreshToken(current.id);
      throw new AuthenticationError(
        "Authentication required",
        "UNAUTHENTICATED"
      );
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

    return {
      user: safeUser(current.user),
      session: issueAccessToken(this.config, toAccessTokenInput(current.user)),
      refreshToken: rawNextRefreshToken
    };
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
    input: ForgotPasswordInput
  ): Promise<{ message: string }> {
    const user = await this.repository.findUserByEmail(input.email);

    if (user?.status === "ACTIVE") {
      const token = createOpaqueToken();
      const expiresAt = this.futureDate(this.config.auth.passwordResetTokenTtl);

      await this.repository.createPasswordResetToken(
        user.id,
        this.hashCredential(token),
        expiresAt
      );
      await this.emailProvider.sendPasswordReset({
        email: input.email,
        token,
        expiresAt
      });
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

  async verifyEmail(input: VerifyEmailInput): Promise<{ user: AuthUser }> {
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
    return { user };
  }

  googleSsoPlaceholder(): never {
    throw new NotImplementedError(
      "Google SSO is not configured",
      authErrorCodes.googleSsoNotConfigured
    );
  }

  private async issueSession(
    user: AuthUserWithCredential,
    context: IssueContext
  ): Promise<{ user: AuthUser; session: AuthSession; refreshToken: string }> {
    const rawRefreshToken = createOpaqueToken();
    await this.repository.createRefreshToken(
      this.buildRefreshTokenInput(user.id, rawRefreshToken, context)
    );

    return {
      user: safeUser(user),
      session: issueAccessToken(this.config, toAccessTokenInput(user)),
      refreshToken: rawRefreshToken
    };
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
}

function invalidCredentials() {
  return new AuthenticationError(
    "Invalid email, username, or password",
    authErrorCodes.invalidCredentials
  );
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

function toAccessTokenInput(user: AuthUserWithCredential) {
  return {
    userId: user.id,
    email: user.email,
    username: user.username
  };
}
import { randomUUID } from "node:crypto";
