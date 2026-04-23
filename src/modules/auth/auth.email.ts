import { logger } from "@/config/logger";
import type { EmailProvider } from "@/modules/auth/auth.types";

export class FakeEmailProvider implements EmailProvider {
  sendEmailVerification(input: {
    email: string;
    otp: string;
    expiresAt: Date;
  }): Promise<void> {
    logger.info(
      {
        email: input.email,
        expiresAt: input.expiresAt.toISOString()
      },
      "Email verification OTP generated"
    );
    return Promise.resolve();
  }

  sendPasswordReset(input: {
    email: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    logger.info(
      {
        email: input.email,
        expiresAt: input.expiresAt.toISOString()
      },
      "Password reset token generated"
    );
    return Promise.resolve();
  }
}
