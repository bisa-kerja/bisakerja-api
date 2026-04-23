import { EventEmitter } from "node:events";

import type { Express } from "express";
import { createRequest, createResponse } from "node-mocks-http";

export type InjectOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
};

export type InjectResponse = {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
};

export async function injectRoute(
  app: Express,
  options: InjectOptions
): Promise<InjectResponse> {
  const req = createRequest({
    method: options.method ?? "GET",
    url: options.url,
    headers: options.headers,
    cookies: parseCookieHeader(
      options.headers?.Cookie ?? options.headers?.cookie
    ),
    body: options.body
  });
  const res = createResponse({
    eventEmitter: EventEmitter
  });

  await new Promise<void>((resolve, reject) => {
    res.on("end", resolve);
    res.on("error", reject);

    const expressApp = app as unknown as {
      handle: (request: typeof req, response: typeof res) => void;
    };

    expressApp.handle(req, res);
  });

  const rawBody = res._getData() as string;
  const headers = res._getHeaders();
  const cookies = (
    res as unknown as { cookies?: Record<string, ResponseCookie> }
  ).cookies;

  if (cookies && Object.keys(cookies).length > 0) {
    headers["set-cookie"] = Object.entries(cookies).map(([name, cookie]) =>
      serializeCookie(name, cookie)
    );
  }

  return {
    status: res.statusCode,
    headers,
    body: rawBody ? (JSON.parse(rawBody) as unknown) : null
  };
}

type ResponseCookie = {
  value: string;
  options?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
    path?: string;
    maxAge?: number;
    expires?: Date;
  };
};

function serializeCookie(name: string, cookie: ResponseCookie): string {
  const parts = [`${name}=${cookie.value}`];
  const options = cookie.options ?? {};

  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${String(Math.floor(options.maxAge / 1000))}`);
  }
  if (options.path) {
    parts.push(`Path=${options.path}`);
  }
  if (options.expires) {
    parts.push(`Expires=${options.expires.toUTCString()}`);
  }
  if (options.httpOnly) {
    parts.push("HttpOnly");
  }
  if (options.secure) {
    parts.push("Secure");
  }
  if (options.sameSite) {
    parts.push(`SameSite=${options.sameSite}`);
  }

  return parts.join("; ");
}

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((cookies, part) => {
    const [name, ...value] = part.trim().split("=");

    if (name && value.length > 0) {
      cookies[name] = value.join("=");
    }

    return cookies;
  }, {});
}
