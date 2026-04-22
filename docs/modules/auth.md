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

The final access token, refresh token, or cookie session strategy remains an implementation decision from earlier phases. This module defines the product contract and security requirements that the chosen strategy must satisfy.

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

## Auth Rules

- Public routes still require validation, rate limiting, and safe error responses.
- Authenticated routes require a valid access credential.
- Refresh routes require a valid refresh credential or session credential, depending on final auth design.
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

| Field             | Rule                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| `username`        | Required, 3-30 chars, lowercase-safe display slug or documented username format |
| `email`           | Required, valid email, normalized lowercase                                     |
| `phoneNumber`     | Required for current onboarding flow, Indonesian phone number format preferred  |
| `password`        | Required, minimum length and complexity defined by security doc                 |
| `confirmPassword` | Required, must match `password`                                                 |

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

The request shape depends on final auth strategy:

- Cookie session strategy: credential comes from secure cookie.
- Refresh token strategy: credential comes from refresh token body or secure cookie.

If request body is used:

```json
{
  "refreshToken": "refresh_token_value"
}
```

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

If token-link verification is used instead of OTP, replace `otp` with `token` and document the final choice before implementation.

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
  "refreshToken": "refresh_token_value",
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

If cookie-based auth is selected, do not return raw tokens in the body unless that is explicitly part of the auth design.

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
      "refreshToken": "refresh_token_value",
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

### Login Flow

1. Validate credentials.
2. Find user by email or username.
3. Compare password hash.
4. Reject disabled or deleted accounts.
5. Issue access credential and refresh/session credential.
6. Store refresh/session state if the final auth design requires persistence.
7. Emit audit event `auth.login_succeeded` or `auth.login_failed`.
8. Return user summary and session data.

### Logout Flow

1. Require authenticated identity.
2. Invalidate current refresh token, session, or credential family based on auth design.
3. Clear auth cookie if cookie-based auth is selected.
4. Emit audit event `auth.logout`.
5. Return `204` or success envelope.

### Refresh Flow

1. Validate refresh credential.
2. Check token/session persistence and expiration.
3. Rotate refresh credential if refresh token rotation is selected.
4. Issue new access credential.
5. Emit audit event `auth.refreshed`.

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
5. Invalidate active refresh/session credentials if required by auth policy.
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
- `UserSession` or `RefreshToken` after auth strategy is finalized

Repository responsibilities:

- Find user by email or username.
- Check duplicate email and username.
- Create account and credentials transactionally.
- Store hashed tokens, not raw token values.
- Mark verification and reset tokens used or expired.
- Invalidate session or refresh credentials.

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

Use generic messages for login and password reset discovery paths to avoid account enumeration.

## Security Requirements

- Hash passwords with approved password hashing package.
- Hash persisted reset tokens, verification tokens, refresh tokens, or session secrets.
- Apply stricter rate limits to login, forgot password, reset password, and email verification.
- Do not log passwords, tokens, OTP values, or credential comparison results.
- Use secure cookies if cookie auth is selected.
- Rotate refresh tokens if token rotation is selected.
- Invalidate sessions after password reset unless explicitly documented otherwise.

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
- Login with valid credential returns session payload or cookie according to auth design.
- Login with invalid credential returns generic `401`.
- Forgot password response is identical for known and unknown email.
- Reset password updates credential and invalidates token.
- Email verification marks user verified and invalidates OTP/token.
- Logout invalidates current session or refresh credential.

Route tests:

- All responses follow `docs/api-response-standard.md`.
- Auth-sensitive endpoints enforce rate limits.
- Public routes do not require auth.
- Authenticated logout requires auth.

## Open Decisions

- Final token/session strategy.
- Whether verification uses numeric OTP, token link, or both.
- Whether register immediately issues a session before email verification.
- Whether username is required long term or only MVP display identity.
- Exact Google SSO route behavior and account linking policy.

## Related Docs

- `docs/api-reference.md`
- `docs/api-response-standard.md`
- `docs/architecture.md`
- `docs/database.md`
- `docs/environment.md`
