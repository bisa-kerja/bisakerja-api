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

  return {
    status: res.statusCode,
    headers: res._getHeaders(),
    body: rawBody ? (JSON.parse(rawBody) as unknown) : null
  };
}
