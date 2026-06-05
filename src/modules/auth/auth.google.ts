import { OAuth2Client } from "google-auth-library";

import type { AppConfig } from "@/config/env";
import { BadRequestError, DownstreamError } from "@/core/errors/app.error";
import { authErrorCodes } from "@/modules/auth/auth.constants";

export type GoogleOauthProfile = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
};

export type GoogleOauthAdapter = {
  generateAuthorizeUrl(input: { state: string; nonce: string }): string;
  exchangeCodeForProfile(input: {
    code: string;
    expectedNonce: string;
  }): Promise<GoogleOauthProfile>;
};

export class GoogleOauthClient implements GoogleOauthAdapter {
  private readonly client: OAuth2Client;

  constructor(private readonly config: AppConfig) {
    this.client = new OAuth2Client(
      config.integrations.googleOauth.clientId,
      config.integrations.googleOauth.clientSecret,
      config.integrations.googleOauth.redirectUri
    );
  }

  generateAuthorizeUrl(input: { state: string; nonce: string }): string {
    const url = this.client.generateAuthUrl({
      response_type: "code",
      scope: ["openid", "email", "profile"],
      state: input.state,
      prompt: "select_account",
      redirect_uri: this.config.integrations.googleOauth.redirectUri
    });

    const withNonce = new URL(url);
    withNonce.searchParams.set("nonce", input.nonce);
    return withNonce.toString();
  }

  async exchangeCodeForProfile(input: {
    code: string;
    expectedNonce: string;
  }): Promise<GoogleOauthProfile> {
    try {
      const { tokens } = await this.client.getToken({
        code: input.code,
        redirect_uri: this.config.integrations.googleOauth.redirectUri
      });

      const idToken = tokens.id_token;
      if (!idToken) {
        throw new BadRequestError(
          "Google token is unavailable",
          authErrorCodes.googleOauthTokenInvalid
        );
      }

      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.config.integrations.googleOauth.clientId
      });
      const payload = ticket.getPayload();
      if (!payload) {
        throw new BadRequestError(
          "Google token payload is unavailable",
          authErrorCodes.googleOauthTokenInvalid
        );
      }

      const issuer = payload.iss;
      if (
        issuer !== "accounts.google.com" &&
        issuer !== "https://accounts.google.com"
      ) {
        throw new BadRequestError(
          "Google token issuer is invalid",
          authErrorCodes.googleOauthTokenInvalid
        );
      }

      const providerAccountId = payload.sub;
      const email = payload.email;
      const emailVerified = payload.email_verified;
      const nonce = payload.nonce;

      if (
        !providerAccountId ||
        typeof email !== "string" ||
        typeof emailVerified !== "boolean"
      ) {
        throw new BadRequestError(
          "Google token payload is incomplete",
          authErrorCodes.googleOauthTokenInvalid
        );
      }

      if (!nonce || nonce !== input.expectedNonce) {
        throw new BadRequestError(
          "Google nonce is invalid",
          authErrorCodes.googleOauthNonceInvalid
        );
      }

      return {
        providerAccountId,
        email: email.toLowerCase(),
        emailVerified,
        displayName: typeof payload.name === "string" ? payload.name : null
      };
    } catch (error) {
      if (error instanceof BadRequestError) {
        throw error;
      }

      throw new DownstreamError(
        "Google verification failed",
        authErrorCodes.googleOauthCodeInvalid
      );
    }
  }
}
