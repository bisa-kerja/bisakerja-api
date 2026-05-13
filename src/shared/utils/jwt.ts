import * as jwt from "jsonwebtoken";
import type { JwtPayload, SignOptions } from "jsonwebtoken";

import type { AppConfig } from "@/config/env";
import { parseDurationSeconds } from "@/shared/utils/ttl";

export type AccessTokenPayload = JwtPayload & {
  sub: string;
  type: "access";
  email: string;
  username: string;
};

export type IssueAccessTokenInput = {
  userId: string;
  email: string;
  username: string;
};

export function issueAccessToken(
  config: AppConfig,
  input: IssueAccessTokenInput
) {
  const expiresIn = parseDurationSeconds(config.auth.accessTokenTtl);
  const options: SignOptions = {
    algorithm: "HS256",
    expiresIn,
    issuer: config.auth.issuer,
    audience: config.auth.audience,
    subject: input.userId
  };

  const token = jwt.sign(
    {
      type: "access",
      email: input.email,
      username: input.username
    },
    config.auth.accessTokenSecret,
    options
  );

  return {
    accessToken: token,
    expiresIn,
    tokenType: "Bearer" as const
  };
}

export function verifyAccessToken(
  config: AppConfig,
  token: string
): AccessTokenPayload | null {
  try {
    const payload = jwt.verify(token, config.auth.accessTokenSecret, {
      algorithms: ["HS256"],
      issuer: config.auth.issuer,
      audience: config.auth.audience
    });

    if (!isAccessTokenPayload(payload)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function isAccessTokenPayload(
  payload: string | JwtPayload
): payload is AccessTokenPayload {
  return (
    typeof payload === "object" &&
    typeof payload.sub === "string" &&
    payload.type === "access" &&
    typeof payload.email === "string" &&
    typeof payload.username === "string"
  );
}
