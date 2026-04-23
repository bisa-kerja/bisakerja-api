import { describe, expect, test } from "bun:test";

import { PrismaAuthRepository } from "@/modules/auth";
import { passwordHashAlgorithm } from "@/shared/utils/password";
import { hashToken } from "@/shared/utils/token";
import {
  createRepositoryTestContext,
  logRepositorySkip
} from "../../helpers/prisma";

describe("PrismaAuthRepository", () => {
  test("creates account, verifies email, stores refresh hash, and completes password reset", async () => {
    const context = await createRepositoryTestContext();

    if (context.skipped) {
      logRepositorySkip(context.reason);
      return;
    }

    try {
      const repository = new PrismaAuthRepository(context.prisma);
      const email = `auth-${context.runId}@example.test`;
      const username = `auth_${context.runId.replaceAll("-", "_")}`.slice(
        0,
        30
      );
      const tokenSecret = "test-refresh-token-secret-change-me-32";
      const user = await repository.createAccount({
        email,
        username,
        phoneNumber: "+6281234567890",
        passwordHash: "argon2id-test-hash",
        passwordHashAlgorithm,
        verificationOtpHash: hashToken("123456", tokenSecret),
        verificationExpiresAt: new Date(Date.now() + 600000)
      });

      expect(user.emailVerified).toBe(false);

      const verification = await repository.findActiveEmailVerificationToken(
        email,
        hashToken("123456", tokenSecret)
      );

      expect(verification?.userId).toBe(user.id);

      const verified = await repository.markEmailVerified(
        user.id,
        verification?.id ?? ""
      );

      expect(verified.emailVerified).toBe(true);

      const refresh = await repository.createRefreshToken({
        userId: user.id,
        tokenHash: hashToken("refresh-token", tokenSecret),
        tokenFamilyId: "family-1",
        expiresAt: new Date(Date.now() + 86400000),
        userAgent: "test",
        ipAddress: "127.0.0.1"
      });

      expect(refresh.tokenHash).not.toBe("refresh-token");
      expect(
        await repository.findActiveRefreshToken(
          hashToken("refresh-token", tokenSecret)
        )
      ).not.toBeNull();

      await repository.createPasswordResetToken(
        user.id,
        hashToken("reset-token", tokenSecret),
        new Date(Date.now() + 600000)
      );
      const reset = await repository.findActivePasswordResetToken(
        hashToken("reset-token", tokenSecret)
      );

      expect(reset?.userId).toBe(user.id);

      await repository.completePasswordReset(
        reset?.id ?? "",
        user.id,
        "argon2id-new-test-hash",
        passwordHashAlgorithm
      );

      expect(
        await repository.findActiveRefreshToken(
          hashToken("refresh-token", tokenSecret)
        )
      ).toBeNull();
    } finally {
      await context.cleanup();
    }
  });
});
