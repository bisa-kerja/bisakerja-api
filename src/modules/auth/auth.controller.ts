import type { Request, Response } from "express";

import type { AppConfig } from "@/config/env";
import {
  createdResponse,
  successResponse
} from "@/core/responses/response.formatter";
import { BadRequestError } from "@/core/errors/app.error";
import { genericForgotPasswordMessage } from "@/modules/auth/auth.constants";
import type {
  AuthCookieOptions,
  AuthControllerDependencies,
  AuthSession,
  AuthUser
} from "@/modules/auth/auth.types";
import { AuthService } from "@/modules/auth/auth.service";
import type { IssueContext } from "@/modules/auth/auth.service";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput
} from "@/modules/auth/auth.schema";
import { emitAuditEvent } from "@/shared/observability/audit-event";
import { parseDurationMs } from "@/shared/utils/ttl";
import { createOpaqueToken } from "@/shared/utils/token";
import { authErrorCodes } from "@/modules/auth/auth.constants";

export class AuthController {
  private readonly service: AuthService;

  constructor(private readonly dependencies: AuthControllerDependencies) {
    this.service = new AuthService(
      dependencies.config,
      dependencies.repository,
      dependencies.jobPublisher,
      dependencies.now,
      dependencies.googleOauthAdapter
    );
  }

  register = async (req: Request, res: Response) => {
    const result = await this.service.register(
      req.body as RegisterInput,
      req.requestId
    );

    emitAuditEvent({
      action: "auth.registered",
      requestId: req.requestId,
      actorId: result.user.id,
      resourceType: "user",
      resourceId: result.user.id,
      result: "success"
    });

    res.status(201).json(
      createdResponse(
        {
          user: serializeAuthUser(result.user),
          session: result.session
        },
        "Account registered successfully. Please verify your email"
      )
    );
  };

  login = async (req: Request, res: Response) => {
    try {
      const result = await this.service.login(
        req.body as LoginInput,
        this.getIssueContext(req)
      );

      setRefreshCookie(res, this.dependencies.config, result.refreshToken);
      emitAuditEvent({
        action: "auth.login_succeeded",
        requestId: req.requestId,
        actorId: result.user.id,
        resourceType: "user",
        resourceId: result.user.id,
        result: "success"
      });

      res.json(this.authSessionResponse(result, "Login successful"));
    } catch (error) {
      emitAuditEvent({
        action: "auth.login_failed",
        requestId: req.requestId,
        result: "failure",
        metadata: { reason: "invalid_or_blocked" }
      });
      throw error;
    }
  };

  refresh = async (req: Request, res: Response) => {
    const refreshToken = getRequestCookie(
      req,
      this.dependencies.config.auth.refreshCookieName
    );
    const result = await this.service.refresh(
      refreshToken,
      this.getIssueContext(req)
    );

    setRefreshCookie(res, this.dependencies.config, result.refreshToken);
    emitAuditEvent({
      action: "auth.refreshed",
      requestId: req.requestId,
      actorId: result.user.id,
      resourceType: "user",
      resourceId: result.user.id,
      result: "success"
    });

    res.json(this.authSessionResponse(result, "Session refreshed"));
  };

  logout = async (req: Request, res: Response) => {
    await this.service.logout(
      req.auth?.userId ?? "",
      getRequestCookie(req, this.dependencies.config.auth.refreshCookieName)
    );
    clearRefreshCookie(res, this.dependencies.config);

    emitAuditEvent({
      action: "auth.logout",
      requestId: req.requestId,
      actorId: req.auth?.userId,
      resourceType: "user",
      resourceId: req.auth?.userId,
      result: "success"
    });

    res.json(successResponse(null, "Logout successful"));
  };

  forgotPassword = async (req: Request, res: Response) => {
    await this.service.forgotPassword(
      req.body as ForgotPasswordInput,
      req.requestId
    );

    emitAuditEvent({
      action: "auth.password_reset_requested",
      requestId: req.requestId,
      result: "success"
    });

    res.json(successResponse(null, genericForgotPasswordMessage));
  };

  resetPassword = async (req: Request, res: Response) => {
    await this.service.resetPassword(req.body as ResetPasswordInput);

    emitAuditEvent({
      action: "auth.password_reset_completed",
      requestId: req.requestId,
      result: "success"
    });

    res.json(successResponse(null, "Password reset successful"));
  };

  verifyEmail = async (req: Request, res: Response) => {
    const result = await this.service.verifyEmail(
      req.body as VerifyEmailInput,
      this.getIssueContext(req)
    );
    setRefreshCookie(res, this.dependencies.config, result.refreshToken);

    emitAuditEvent({
      action: "auth.email_verified",
      requestId: req.requestId,
      actorId: result.user.id,
      resourceType: "user",
      resourceId: result.user.id,
      result: "success"
    });

    res.json(
      successResponse(
        {
          user: serializeAuthUser(result.user),
          session: result.session
        },
        "Email verified successfully"
      )
    );
  };

  googleStart = (_req: Request, res: Response) => {
    const state = createOpaqueToken();
    const nonce = createOpaqueToken();
    const result = this.service.startGoogleLogin({ state, nonce });

    setGoogleOauthCookie(res, this.dependencies.config, "state", state);
    setGoogleOauthCookie(res, this.dependencies.config, "nonce", nonce);

    res.json(
      successResponse(
        { authorizeUrl: result.authorizeUrl },
        "Google login URL created successfully"
      )
    );
  };

  googleExchange = async (req: Request, res: Response) => {
    if (!this.dependencies.config.integrations.googleOauth.enabled) {
      this.service.googleSsoPlaceholder();
    }

    const expectedState = getRequestCookie(
      req,
      googleOauthCookieName(this.dependencies.config, "state")
    );
    const expectedNonce = getRequestCookie(
      req,
      googleOauthCookieName(this.dependencies.config, "nonce")
    );

    if (!expectedState || !expectedNonce) {
      throw new BadRequestError(
        "Google OAuth state is invalid",
        authErrorCodes.googleOauthStateInvalid
      );
    }

    const { code, state } = req.body as { code: string; state: string };
    if (state !== expectedState) {
      clearGoogleOauthCookies(res, this.dependencies.config);
      throw new BadRequestError(
        "Google OAuth state is invalid",
        authErrorCodes.googleOauthStateInvalid
      );
    }

    const result = await this.service.loginWithGoogleAuthorizationCode(
      { code, expectedNonce },
      this.getIssueContext(req)
    );

    clearGoogleOauthCookies(res, this.dependencies.config);
    setRefreshCookie(res, this.dependencies.config, result.refreshToken);

    emitAuditEvent({
      action: "auth.login_succeeded",
      requestId: req.requestId,
      actorId: result.user.id,
      resourceType: "user",
      resourceId: result.user.id,
      result: "success",
      metadata: { provider: "google" }
    });

    res.json(this.authSessionResponse(result, "Google login successful"));
  };

  private authSessionResponse(
    result: {
      user: AuthUser;
      session: AuthSession;
    },
    message: string
  ) {
    return successResponse(
      {
        user: serializeAuthUser(result.user),
        session: result.session
      },
      message
    );
  }

  private getIssueContext(req: Request): IssueContext {
    return {
      userAgent: req.get("user-agent"),
      ipAddress: req.ip
    };
  }
}

export function serializeAuthUser(user: AuthUser) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    onboardingStatus: user.onboardingStatus,
    createdAt: user.createdAt.toISOString()
  };
}

function setRefreshCookie(res: Response, config: AppConfig, token: string) {
  res.cookie(
    config.auth.refreshCookieName,
    token,
    refreshCookieOptions(config)
  );
}

function clearRefreshCookie(res: Response, config: AppConfig) {
  res.clearCookie(config.auth.refreshCookieName, {
    ...refreshCookieOptions(config),
    maxAge: 0
  });
}

function refreshCookieOptions(config: AppConfig): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: config.auth.cookieSameSite,
    path: "/",
    maxAge: parseDurationMs(config.auth.refreshTokenTtl)
  };
}

function getRequestCookie(req: Request, name: string): string | undefined {
  const cookies: Record<string, unknown> = req.cookies;
  const value = cookies[name];

  return typeof value === "string" ? value : undefined;
}

type GoogleOauthCookieKind = "state" | "nonce";

function googleOauthCookieName(config: AppConfig, kind: GoogleOauthCookieKind) {
  return `${config.auth.refreshCookieName}_${kind}_google_oauth`;
}

function setGoogleOauthCookie(
  res: Response,
  config: AppConfig,
  kind: GoogleOauthCookieKind,
  value: string
) {
  res.cookie(googleOauthCookieName(config, kind), value, {
    httpOnly: true,
    secure: config.auth.cookieSecure,
    sameSite: config.auth.cookieSameSite,
    path: "/",
    maxAge: parseDurationMs("10m")
  });
}

function clearGoogleOauthCookies(res: Response, config: AppConfig) {
  for (const kind of ["state", "nonce"] as const) {
    res.clearCookie(googleOauthCookieName(config, kind), {
      httpOnly: true,
      secure: config.auth.cookieSecure,
      sameSite: config.auth.cookieSameSite,
      path: "/",
      maxAge: 0
    });
  }
}
