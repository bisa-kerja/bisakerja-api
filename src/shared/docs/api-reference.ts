import { randomBytes } from "node:crypto";

import type { Express, Request, Response } from "express";

import type { AppConfig } from "@/config/env";
import { buildOpenApiDocument } from "@/shared/docs/openapi";

export function registerApiReferenceRoutes(app: Express, config: AppConfig) {
  app.get("/openapi.json", (_req: Request, res: Response) => {
    res.json(buildOpenApiDocument(config));
  });

  app.get(["/docs/api", "/docs/api/"], (_req: Request, res: Response) => {
    const nonce = createCspNonce();

    res
      .setHeader("Content-Security-Policy", buildDocsCsp(nonce))
      .type("html")
      .send(createScalarHtml("/openapi.json", nonce));
  });
}

function createScalarHtml(openApiUrl: string, nonce: string) {
  const serializedUrl = JSON.stringify(openApiUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Bisakerja Backend API Reference</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script nonce="${nonce}">
      Scalar.createApiReference('#app', {
        url: ${serializedUrl}
      })
    </script>
  </body>
</html>`;
}

function createCspNonce() {
  return randomBytes(16).toString("base64");
}

function buildDocsCsp(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "font-src 'self' https: data:",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "img-src 'self' data: https:",
    "object-src 'none'",
    "script-src 'self' https://cdn.jsdelivr.net 'nonce-" + nonce + "'",
    "script-src-attr 'none'",
    "style-src 'self' https: 'unsafe-inline'",
    "connect-src 'self' http: https:"
  ].join("; ");
}
