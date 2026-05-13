import { describe, expect, test } from "bun:test";

import { authErrorCodes } from "@/modules/auth/auth.constants";
import { GoogleOauthClient } from "@/modules/auth/auth.google";
import { testConfig } from "../../helpers/config";

describe("GoogleOauthClient", () => {
  test("generates authorize url with nonce and state", () => {
    const client = new GoogleOauthClient(
      testConfig({
        GOOGLE_OAUTH_ENABLED: "true",
        GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret",
        GOOGLE_OAUTH_REDIRECT_URI:
          "https://app.example.com/auth/google/callback"
      })
    );
    const oauthStub = {
      generateAuthUrl: (input: { state: string }) =>
        `https://accounts.google.com/o/oauth2/v2/auth?client_id=google-client-id&state=${encodeURIComponent(input.state)}`
    };
    setOauthClientStub(client, oauthStub);

    const url = client.generateAuthorizeUrl({
      state: "state-123",
      nonce: "nonce-456"
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get("state")).toBe("state-123");
    expect(parsed.searchParams.get("nonce")).toBe("nonce-456");
  });

  test("exchanges code and returns normalized profile", async () => {
    const client = new GoogleOauthClient(
      testConfig({
        GOOGLE_OAUTH_ENABLED: "true",
        GOOGLE_OAUTH_CLIENT_ID: "google-client-id",
        GOOGLE_OAUTH_CLIENT_SECRET: "google-client-secret"
      })
    );
    const oauthStub = {
      getToken: () => Promise.resolve({ tokens: { id_token: "token-123" } }),
      verifyIdToken: () =>
        Promise.resolve({
          getPayload: () => ({
            iss: "https://accounts.google.com",
            sub: "google-sub-123",
            email: "USER@EXAMPLE.COM",
            email_verified: true,
            nonce: "nonce-123",
            name: "User Name"
          })
        })
    };
    setOauthClientStub(client, oauthStub);

    const profile = await client.exchangeCodeForProfile({
      code: "oauth-code",
      expectedNonce: "nonce-123"
    });

    expect(profile).toEqual({
      providerAccountId: "google-sub-123",
      email: "user@example.com",
      emailVerified: true,
      displayName: "User Name"
    });
  });

  test("rejects nonce mismatch as bad request", async () => {
    const client = new GoogleOauthClient(testConfig());
    const oauthStub = {
      getToken: () => Promise.resolve({ tokens: { id_token: "token-123" } }),
      verifyIdToken: () =>
        Promise.resolve({
          getPayload: () => ({
            iss: "accounts.google.com",
            sub: "google-sub-123",
            email: "user@example.com",
            email_verified: true,
            nonce: "unexpected-nonce"
          })
        })
    };
    setOauthClientStub(client, oauthStub);

    try {
      await client.exchangeCodeForProfile({
        code: "oauth-code",
        expectedNonce: "nonce-123"
      });
      throw new Error("Expected nonce mismatch to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: authErrorCodes.googleOauthNonceInvalid
      });
    }
  });

  test("maps upstream runtime failures to downstream error", async () => {
    const client = new GoogleOauthClient(testConfig());
    const oauthStub = {
      getToken: () => Promise.reject(new Error("socket hang up"))
    };
    setOauthClientStub(client, oauthStub);

    try {
      await client.exchangeCodeForProfile({
        code: "oauth-code",
        expectedNonce: "nonce-123"
      });
      throw new Error("Expected Google exchange to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: authErrorCodes.googleOauthCodeInvalid
      });
    }
  });

  test("rejects missing id token as bad request", async () => {
    const client = new GoogleOauthClient(testConfig());
    const oauthStub = {
      getToken: () => Promise.resolve({ tokens: { id_token: undefined } })
    };
    setOauthClientStub(client, oauthStub);

    try {
      await client.exchangeCodeForProfile({
        code: "oauth-code",
        expectedNonce: "nonce-123"
      });
      throw new Error("Expected missing id token to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: authErrorCodes.googleOauthTokenInvalid
      });
    }
  });
});

function setOauthClientStub(client: GoogleOauthClient, stub: unknown) {
  (client as unknown as { client: unknown }).client = stub;
}
