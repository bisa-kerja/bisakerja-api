---
title: Auth Module
description: Authentication, session, verification, password reset, and Google SSO placeholder contract for the Bisakerja Backend API.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/modules/auth.md
last_reviewed: 2026-04-22
---

# Auth Module

The Auth module owns account entry flows for Bisakerja. It validates identity input, creates user accounts, verifies email ownership, starts and ends authenticated sessions, and supports password reset flows.

The Auth module uses short-lived access JWTs plus opaque refresh tokens stored in `HttpOnly` cookies and persisted server-side as hashes.

Auth email delivery is routed through the shared email service abstraction in `src/shared/email/**`. The default production-capable provider is Resend, while local and test environments may keep the fake provider for deterministic flows.

## Responsibility

The Auth module owns:

- Register.
- Login.
- Logout or session invalidation.
- Refresh token or session refresh.
- Forgot password request.
- Reset password completion.
- Email verification with OTP or token.
- Google SSO placeholder documentation.
- Auth-sensitive rate limiting and audit events.

The Auth module does not own:

- Profile completion beyond initial account fields.
- Career preference setup.
- Mentor onboarding.
- Authorization for business resources beyond establishing user identity.

## Route Prefix

```text
/api/v1/auth
```

## Endpoint Summary

| Method | Path                           | Auth                     | Purpose                                                |
| ------ | ------------------------------ | ------------------------ | ------------------------------------------------------ |
| `POST` | `/api/v1/auth/register`        | Public                   | Create a user account and start email verification     |
| `POST` | `/api/v1/auth/login`           | Public                   | Authenticate using email or username and password      |
| `POST` | `/api/v1/auth/logout`          | Authenticated            | Invalidate current session or refresh credential       |
| `POST` | `/api/v1/auth/refresh`         | Refresh credential       | Issue a new access credential                          |
| `POST` | `/api/v1/auth/forgot-password` | Public                   | Send password reset email or OTP                       |
| `POST` | `/api/v1/auth/reset-password`  | Public with token or OTP | Set a new password                                     |
| `POST` | `/api/v1/auth/verify-email`    | Public with token or OTP | Verify email ownership                                 |
| `POST` | `/api/v1/auth/google`          | Placeholder              | Reserved for Google SSO after OAuth config is approved |

Google SSO must stay a placeholder until OAuth client id, callback URL, token verification, account-linking rules, and redirect behavior are documented.
The placeholder route returns `501 GOOGLE_SSO_NOT_CONFIGURED` and must not start an OAuth flow, create accounts, or accept provider tokens until the OAuth contract is complete.

## Auth Rules

- Public routes still require validation, rate limiting, and safe error responses.
- Authenticated routes require a valid access credential.
- Refresh routes require a valid refresh cookie.
- Auth state must identify one `User`.
- Auth middleware must attach only safe identity context to request handling.
- Business resource ownership checks happen in the module that owns the resource.

## Request Schemas

### Register

```json
{
  "username": "salman",
  "email": "salman@example.com",
  "phoneNumber": "+6281234567890",
  "password": "StrongPassword123!",
  "confirmPassword": "StrongPassword123!"
}
```

Validation:

| Field             | Rule                                                                         |
| ----------------- | ---------------------------------------------------------------------------- |
| `username`        | Required, 3-30 chars, lowercase letters, numbers, and underscores            |
| `email`           | Required, valid email, normalized lowercase                                  |
| `phoneNumber`     | Required for current onboarding flow, Indonesian `+62` or `62` number format |
| `password`        | Required, 12-128 chars with lowercase, uppercase, number, and symbol         |
| `confirmPassword` | Required, must match `password`                                              |

### Login

```json
{
  "identifier": "salman@example.com",
  "password": "StrongPassword123!"
}
```

Validation:

| Field        | Rule                        |
| ------------ | --------------------------- |
| `identifier` | Required, email or username |
| `password`   | Required                    |

### Refresh

The refresh credential comes from the `HttpOnly` refresh cookie. The request body should be empty for MVP.

### Forgot Password

```json
{
  "email": "salman@example.com"
}
```

Security rule: response must be identical whether the email exists or not.

### Reset Password

```json
{
  "token": "reset_token_or_otp",
  "password": "NewStrongPassword123!",
  "confirmPassword": "NewStrongPassword123!"
}
```

### Verify Email

```json
{
  "email": "salman@example.com",
  "otp": "123456"
}
```

Email verification uses OTP for MVP.

## Response Schemas

### Auth User

```json
{
  "id": "user_123",
  "username": "salman",
  "email": "salman@example.com",
  "emailVerified": false,
  "onboardingStatus": "PENDING",
  "createdAt": "2026-04-22T00:00:00.000Z"
}
```

### Auth Session

```json
{
  "accessToken": "access_token_value",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

The raw refresh token is set only as an `HttpOnly` cookie and must not be returned in the JSON body.
Refresh cookies use the configured `AUTH_REFRESH_COOKIE_NAME`, `HttpOnly`, explicit `SameSite`, path `/`, and `Max-Age` derived from `AUTH_REFRESH_TOKEN_TTL`. Production environments must enable secure cookies.

### Register Response

```json
{
  "success": true,
  "message": "Account registered successfully. Please verify your email.",
  "data": {
    "user": {
      "id": "user_123",
      "username": "salman",
      "email": "salman@example.com",
      "emailVerified": false,
      "onboardingStatus": "PENDING",
      "createdAt": "2026-04-22T00:00:00.000Z"
    }
  },
  "meta": null
}
```

### Login Response

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "user_123",
      "username": "salman",
      "email": "salman@example.com",
      "emailVerified": true,
      "onboardingStatus": "COMPLETED",
      "createdAt": "2026-04-22T00:00:00.000Z"
    },
    "session": {
      "accessToken": "access_token_value",
      "expiresIn": 900,
      "tokenType": "Bearer"
    }
  },
  "meta": null
}
```

## Service Logic

### Register Flow

1. Validate request body with Zod.
2. Normalize email and username.
3. Check duplicate email and username.
4. Hash password with approved password hashing package.
5. Create `User` and `AuthCredential` in one transaction.
6. Create email verification token or OTP.
7. Send verification email.
8. Return user-safe account summary.
9. Emit audit event `auth.registered`.

MVP registration does not issue a full authenticated session before email verification.
Local and test environments use a fake email provider. The provider records or logs only safe delivery metadata; raw OTP and reset token values are used for delivery and must not appear in API responses or ordinary logs.

### Login Flow

1. Validate credentials.
2. Find user by email or username.
3. Compare password hash.
4. Reject disabled or deleted accounts.
5. Reject unverified email with `403 EMAIL_NOT_VERIFIED` until product policy allows limited access.
6. Issue short-lived access JWT and opaque refresh token.
7. Store only the refresh token hash and metadata server-side.
8. Set the raw refresh token in an `HttpOnly` cookie.
9. Emit audit event `auth.login_succeeded` or `auth.login_failed`.
10. Return user summary and access token session data.

### Logout Flow

1. Require authenticated identity.
2. Invalidate current refresh token or credential family.
3. Clear refresh cookie.
4. Emit audit event `auth.logout`.
5. Return `204` or success envelope.

### Refresh Flow

1. Validate refresh cookie.
2. Check persisted refresh token hash, token family, and expiration.
3. Rotate refresh credential and invalidate the previous token.
4. Issue new access credential.
5. Set the new raw refresh token in an `HttpOnly` cookie.
6. Emit audit event `auth.refreshed`.

### Forgot Password Flow

1. Validate email.
2. Always return safe generic response.
3. If user exists, create short-lived reset token or OTP.
4. Send password reset email.
5. Rate limit aggressively.
6. Emit audit event `auth.password_reset_requested`.

### Reset Password Flow

1. Validate reset token or OTP.
2. Validate and hash new password.
3. Update credential hash.
4. Invalidate used reset token or OTP.
5. Invalidate all active refresh credentials for the user.
6. Emit audit event `auth.password_reset_completed`.

### Verify Email Flow

1. Validate email and OTP/token.
2. Check token hash and expiration.
3. Mark user email as verified.
4. Invalidate used token.
5. Emit audit event `auth.email_verified`.

## Repository And Database Usage

Primary models:

- `User`
- `AuthCredential`
- `EmailVerificationToken`
- `PasswordResetToken`
- `RefreshToken`

Repository responsibilities:

- Find user by email or username.
- Check duplicate email and username.
- Create account and credentials transactionally.
- Store hashed tokens, not raw token values.
- Store hashed refresh tokens and token-family metadata.
- Mark verification and reset tokens used or expired.
- Invalidate refresh credentials.

Do not store plaintext passwords, raw OTP values, or raw reset tokens.

## Error Cases

| Case                                           | Status | Error code                     |
| ---------------------------------------------- | ------ | ------------------------------ |
| Invalid request body                           | 422    | `VALIDATION_ERROR`             |
| Duplicate email                                | 409    | `EMAIL_ALREADY_REGISTERED`     |
| Duplicate username                             | 409    | `USERNAME_ALREADY_REGISTERED`  |
| Invalid login credential                       | 401    | `INVALID_CREDENTIALS`          |
| Unverified email when verification is required | 403    | `EMAIL_NOT_VERIFIED`           |
| Expired reset token                            | 400    | `PASSWORD_RESET_TOKEN_EXPIRED` |
| Invalid reset token                            | 400    | `PASSWORD_RESET_TOKEN_INVALID` |
| Expired email verification OTP                 | 400    | `EMAIL_VERIFICATION_EXPIRED`   |
| Invalid email verification OTP                 | 400    | `EMAIL_VERIFICATION_INVALID`   |
| Rate limit exceeded                            | 429    | `RATE_LIMITED`                 |
| Email provider unavailable                     | 503    | `SERVICE_UNAVAILABLE`          |
| Google SSO not configured                      | 501    | `GOOGLE_SSO_NOT_CONFIGURED`    |

Use generic messages for login and password reset discovery paths to avoid account enumeration.

## Security Requirements

- Hash passwords with Argon2id through `argon2` unless scaffold compatibility testing blocks it.
- Hash persisted reset tokens, verification tokens, refresh tokens, or session secrets.
- Apply stricter rate limits to login, forgot password, reset password, and email verification.
- Do not log passwords, tokens, OTP values, or credential comparison results.
- Use secure refresh cookies.
- Rotate refresh tokens on every refresh.
- Invalidate refresh tokens after password reset.

## Observability

Log safe structured events:

- `auth.registered`
- `auth.login_succeeded`
- `auth.login_failed`
- `auth.logout`
- `auth.refreshed`
- `auth.password_reset_requested`
- `auth.password_reset_completed`
- `auth.email_verified`

Fields:

- `requestId`
- `userId` when known
- `emailHash` for unauthenticated email flows if needed
- `ip`
- `userAgent`
- `result`

Never log raw credentials or tokens.

## Test Scenarios

Unit tests:

- Register validation rejects invalid email, weak password, and password mismatch.
- Login validation accepts email or username identifier.
- Password hashing helper never returns plaintext.
- Token hashing and comparison work as expected.

Integration tests:

- Register creates `User`, `AuthCredential`, and verification token transactionally.
- Duplicate email returns `409`.
- Login with valid credential returns access token payload and sets refresh cookie.
- Login with invalid credential returns generic `401`.
- Forgot password response is identical for known and unknown email.
- Reset password updates credential and invalidates token.
- Email verification marks user verified and invalidates OTP/token.
- Logout invalidates current refresh credential and clears refresh cookie.

Route tests:

- All responses follow `docs/api-response-standard.md`.
- Auth-sensitive endpoints enforce rate limits.
- Public routes do not require auth.
- Authenticated logout requires auth.

## Deferred Decisions

- Whether username is required long term or only MVP display identity.
- Google account linking policy and callback behavior for a future OAuth implementation.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/environment.md`
- `src/modules/README.md`
