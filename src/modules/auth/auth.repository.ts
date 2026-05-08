import { prisma } from "@/shared/libs/prisma";
import type { PrismaTransaction } from "@/shared/libs/prisma";
import type { EnqueueAsyncJobInput } from "@/shared/async-workloads/async-workloads.types";
import { PrismaAsyncJobOutboxRepository } from "@/shared/async-workloads/async-workloads.repository";
import type {
  AuthRepository,
  AuthUser,
  AuthUserWithCredential,
  CreateAccountInput,
  CreateRefreshTokenInput,
  EmailVerificationTokenRecord,
  PasswordResetTokenRecord,
  RefreshTokenRecord
} from "@/modules/auth/auth.types";

type PrismaClientLike = typeof prisma | PrismaTransaction;

export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly client: PrismaClientLike = prisma) {}

  async findUserByEmail(email: string): Promise<AuthUserWithCredential | null> {
    const user = await this.client.user.findUnique({
      where: { email },
      include: { authCredential: true }
    });

    return user ? mapUserWithCredential(user) : null;
  }

  async findUserByUsername(
    username: string
  ): Promise<AuthUserWithCredential | null> {
    const user = await this.client.user.findUnique({
      where: { username },
      include: { authCredential: true }
    });

    return user ? mapUserWithCredential(user) : null;
  }

  async findUserById(userId: string): Promise<AuthUserWithCredential | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },
      include: { authCredential: true }
    });

    return user ? mapUserWithCredential(user) : null;
  }

  async findUserByIdentifier(
    identifier: string
  ): Promise<AuthUserWithCredential | null> {
    const user = await this.client.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }]
      },
      include: { authCredential: true }
    });

    return user ? mapUserWithCredential(user) : null;
  }

  async createAccount(input: CreateAccountInput): Promise<AuthUser> {
    const user = await this.client.user.create({
      data: {
        email: input.email,
        username: input.username,
        phoneNumber: input.phoneNumber,
        authCredential: {
          create: {
            passwordHash: input.passwordHash,
            passwordHashAlgorithm: input.passwordHashAlgorithm
          }
        },
        verificationTokens: {
          create: {
            otpHash: input.verificationOtpHash,
            expiresAt: input.verificationExpiresAt
          }
        }
      }
    });

    return mapAuthUser(user);
  }

  createAccountWithEmailVerificationJob(input: {
    account: CreateAccountInput;
    job: EnqueueAsyncJobInput<"auth.email-verification">;
  }): Promise<{ user: AuthUser; jobId: string }> {
    return this.client.$transaction(async (tx) => {
      const repository = new PrismaAsyncJobOutboxRepository(tx);
      const user = await tx.user.create({
        data: {
          email: input.account.email,
          username: input.account.username,
          phoneNumber: input.account.phoneNumber,
          authCredential: {
            create: {
              passwordHash: input.account.passwordHash,
              passwordHashAlgorithm: input.account.passwordHashAlgorithm
            }
          },
          verificationTokens: {
            create: {
              otpHash: input.account.verificationOtpHash,
              expiresAt: input.account.verificationExpiresAt
            }
          }
        }
      });
      const job = await repository.createJob({
        ...input.job,
        actorId: user.id
      });

      return {
        user: mapAuthUser(user),
        jobId: job.id
      };
    });
  }

  async findActiveEmailVerificationToken(
    email: string,
    otpHash: string
  ): Promise<EmailVerificationTokenRecord | null> {
    const token = await this.client.emailVerificationToken.findFirst({
      where: {
        otpHash,
        usedAt: null,
        user: { email }
      },
      orderBy: { createdAt: "desc" }
    });

    return token;
  }

  async markEmailVerified(
    userId: string,
    tokenId: string
  ): Promise<AuthUserWithCredential> {
    const user = await this.client.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
      include: { authCredential: true }
    });
    await this.client.emailVerificationToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() }
    });

    return mapUserWithCredential(user);
  }

  async createPasswordResetToken(
    userId: string,
    tokenHash: string,
    expiresAt: Date
  ): Promise<void> {
    await this.client.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt }
    });
  }

  createPasswordResetTokenWithJob(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    job: EnqueueAsyncJobInput<"auth.password-reset">;
  }): Promise<{ jobId: string }> {
    return this.client.$transaction(async (tx) => {
      const repository = new PrismaAsyncJobOutboxRepository(tx);

      await tx.passwordResetToken.create({
        data: {
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt
        }
      });

      const job = await repository.createJob(input.job);

      return { jobId: job.id };
    });
  }

  async findActivePasswordResetToken(
    tokenHash: string
  ): Promise<PasswordResetTokenRecord | null> {
    return this.client.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  async completePasswordReset(
    tokenId: string,
    userId: string,
    passwordHash: string,
    passwordHashAlgorithm: string
  ): Promise<void> {
    await this.client.authCredential.update({
      where: { userId },
      data: {
        passwordHash,
        passwordHashAlgorithm,
        passwordUpdatedAt: new Date()
      }
    });
    await this.client.passwordResetToken.update({
      where: { id: tokenId },
      data: { usedAt: new Date() }
    });
    await this.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  async createRefreshToken(
    input: CreateRefreshTokenInput
  ): Promise<RefreshTokenRecord> {
    const token = await this.client.refreshToken.create({
      data: input,
      include: { user: { include: { authCredential: true } } }
    });

    return mapRefreshToken(token);
  }

  async findActiveRefreshToken(
    tokenHash: string
  ): Promise<RefreshTokenRecord | null> {
    const token = await this.client.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { authCredential: true } } }
    });

    if (!token || token.revokedAt) {
      return null;
    }

    return mapRefreshToken(token);
  }

  async rotateRefreshToken(
    currentTokenId: string,
    input: CreateRefreshTokenInput
  ): Promise<RefreshTokenRecord> {
    return this.client.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: input,
        include: { user: { include: { authCredential: true } } }
      });

      await tx.refreshToken.update({
        where: { id: currentTokenId },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: created.id
        }
      });

      return mapRefreshToken(created);
    });
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.client.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() }
    });
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.client.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }
}

function mapAuthUser(user: {
  id: string;
  username: string;
  email: string;
  emailVerifiedAt: Date | null;
  onboardingStatus: AuthUser["onboardingStatus"];
  createdAt: Date;
}): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    onboardingStatus: user.onboardingStatus,
    createdAt: user.createdAt
  };
}

function mapUserWithCredential(user: {
  id: string;
  username: string;
  email: string;
  emailVerifiedAt: Date | null;
  onboardingStatus: AuthUser["onboardingStatus"];
  createdAt: Date;
  status: AuthUserWithCredential["status"];
  authCredential: {
    passwordHash: string;
    passwordHashAlgorithm: string;
  } | null;
}): AuthUserWithCredential {
  return {
    ...mapAuthUser(user),
    status: user.status,
    credential: user.authCredential
      ? {
          passwordHash: user.authCredential.passwordHash,
          passwordHashAlgorithm: user.authCredential.passwordHashAlgorithm
        }
      : null
  };
}

function mapRefreshToken(token: {
  id: string;
  userId: string;
  tokenHash: string;
  tokenFamilyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: Parameters<typeof mapUserWithCredential>[0];
}): RefreshTokenRecord {
  return {
    id: token.id,
    userId: token.userId,
    tokenHash: token.tokenHash,
    tokenFamilyId: token.tokenFamilyId,
    expiresAt: token.expiresAt,
    revokedAt: token.revokedAt,
    user: mapUserWithCredential(token.user)
  };
}
