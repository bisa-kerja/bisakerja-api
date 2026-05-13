import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

import type { Express } from "express";
import { createRequest, createResponse } from "node-mocks-http";

export type InjectOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";
  url: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  formData?: FormData;
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
  if (options.formData) {
    return injectMultipartRoute(app, options);
  }

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
    body: parseResponseBody(rawBody, readHeader(headers, "content-type"))
  };
}

async function injectMultipartRoute(
  app: Express,
  options: InjectOptions
): Promise<InjectResponse> {
  const request = new Request("http://localhost", {
    method: options.method ?? "POST",
    headers: options.headers,
    body: options.formData
  });
  const rawBody = Buffer.from(await request.arrayBuffer());
  const contentType = request.headers.get("content-type");
  const normalizedHeaders = Object.fromEntries(
    Object.entries(options.headers ?? {}).map(([name, value]) => [
      name.toLowerCase(),
      value
    ])
  );
  const req = Readable.from([rawBody]);

  Object.assign(req, {
    method: options.method ?? "POST",
    url: options.url,
    ip: "127.0.0.1",
    headers: {
      ...normalizedHeaders,
      ...(contentType ? { "content-type": contentType } : {}),
      "content-length": String(rawBody.byteLength)
    },
    httpVersion: "1.1",
    socket: {
      destroy: () => undefined,
      readable: true,
      remoteAddress: "127.0.0.1"
    },
    connection: {
      destroy: () => undefined,
      remoteAddress: "127.0.0.1"
    }
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

  const responseBody = res._getData() as string;
  const headers = res._getHeaders();

  return {
    status: res.statusCode,
    headers,
    body: parseResponseBody(responseBody, readHeader(headers, "content-type"))
  };
}

function parseResponseBody(
  rawBody: string,
  contentType: string | string[] | undefined
) {
  if (rawBody === "") {
    return null;
  }

  const normalizedContentType = Array.isArray(contentType)
    ? contentType[0]
    : contentType;

  if (normalizedContentType?.includes("application/json")) {
    return JSON.parse(rawBody) as unknown;
  }

  return rawBody;
}

function readHeader(
  headers: Record<string, string | string[] | undefined>,
  name: string
) {
  return headers[name];
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
