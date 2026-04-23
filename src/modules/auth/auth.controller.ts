import type { Request, Response } from "express";

import type { AppConfig } from "@/config/env";
import {
  createdResponse,
  successResponse
} from "@/core/responses/response.formatter";
import { genericForgotPasswordMessage } from "@/modules/auth/auth.constants";
import type {
  AuthCookieOptions,
  AuthControllerDependencies,
  AuthUser
} from "@/modules/auth/auth.types";
import { AuthService } from "@/modules/auth/auth.service";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput
} from "@/modules/auth/auth.schema";
import { emitAuditEvent } from "@/shared/observability/audit-event";
import { parseDurationMs } from "@/shared/utils/ttl";

export class AuthController {
  private readonly service: AuthService;

  constructor(private readonly dependencies: AuthControllerDependencies) {
    this.service = new AuthService(
      dependencies.config,
      dependencies.repository,
      dependencies.emailProvider,
      dependencies.now
    );
  }

  register = async (req: Request, res: Response) => {
    const result = await this.service.register(req.body as RegisterInput);

    emitAuditEvent({
      action: "auth.registered",
      requestId: req.requestId,
      actorId: result.user.id,
      resourceType: "user",
      resourceId: result.user.id,
      result: "success"
    });

    res
      .status(201)
      .json(
        createdResponse(
          { user: serializeAuthUser(result.user) },
          "Account registered successfully. Please verify your email."
        )
      );
  };

  login = async (req: Request, res: Response) => {
    try {
      const result = await this.service.login(req.body as LoginInput, {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip
      });

      setRefreshCookie(res, this.dependencies.config, result.refreshToken);
      emitAuditEvent({
        action: "auth.login_succeeded",
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
          "Login successful"
        )
      );
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
    const result = await this.service.refresh(
      getRequestCookie(req, this.dependencies.config.auth.refreshCookieName),
      {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip
      }
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

    res.json(
      successResponse(
        {
          user: serializeAuthUser(result.user),
          session: result.session
        },
        "Session refreshed"
      )
    );
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
    await this.service.forgotPassword(req.body as ForgotPasswordInput);

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
    const result = await this.service.verifyEmail(req.body as VerifyEmailInput);

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
        { user: serializeAuthUser(result.user) },
        "Email verified successfully"
      )
    );
  };

  google = (_req: Request, _res: Response) => {
    this.service.googleSsoPlaceholder();
  };
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
