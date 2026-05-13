import type { Router } from "express";

import type { AppConfig } from "@/config/env";
import { getMountedRouters } from "@/modules";
import type { RouteOptions } from "@/modules";

export type RegisteredRoute = {
  moduleId: string;
  method: string;
  path: string;
};

type RouterLayer = {
  handle?: {
    stack?: RouterLayer[];
  };
  route?: {
    path?: string | string[];
    methods?: Record<string, boolean>;
  };
};

export function listRegisteredRoutes(
  config: AppConfig,
  options: RouteOptions = {}
): RegisteredRoute[] {
  const mountedRouters = getMountedRouters(config, options);
  const routes = mountedRouters.flatMap(({ id, mountPath, router }) =>
    collectRoutesFromRouter(id, mountPath, router)
  );

  return routes.sort((left, right) => {
    if (left.path === right.path) {
      return left.method.localeCompare(right.method);
    }

    return left.path.localeCompare(right.path);
  });
}

export function renderRouteInventoryMarkdown(
  routes: RegisteredRoute[],
  generatedAt: string,
  sourceCommit: string
): string {
  const routeRows = routes
    .map(
      (route) =>
        `| \`${route.method}\` | \`${route.path}\` | \`${route.moduleId}\` |`
    )
    .join("\n");

  return `---
title: Backend API Route Inventory
description: Generated inventory of mounted Backend API routes and their owning modules.
owner: backend-owner
reviewers:
  - platform-docs-maintainer
  - engineering-lead
doc_status: draft
source_repo: backend-api
source_path: docs/generated/routes.md
last_reviewed: ${generatedAt.slice(0, 10)}
generated_by: route-inventory-script
generated_at: ${generatedAt}
source_commit: ${sourceCommit}
---

# Backend API Route Inventory

This page is generated from the route registry used by the application runtime. It exists to make route drift visible during documentation review and sync preparation.

## Summary

| Metric | Value |
| ------ | ----- |
| Total routes | ${String(routes.length)} |
| Generated at | \`${generatedAt}\` |
| Source commit | \`${sourceCommit}\` |

## Registered Routes

| Method | Path | Module |
| ------ | ---- | ------ |
${routeRows}
`;
}

function collectRoutesFromRouter(
  moduleId: string,
  mountPath: string,
  router: Router
): RegisteredRoute[] {
  const stack = readRouterStack(router);

  return collectRoutesFromStack(moduleId, mountPath, stack);
}

function collectRoutesFromStack(
  moduleId: string,
  basePath: string,
  stack: RouterLayer[]
): RegisteredRoute[] {
  const routes: RegisteredRoute[] = [];

  for (const layer of stack) {
    if (layer.route?.path) {
      const paths = Array.isArray(layer.route.path)
        ? layer.route.path
        : [layer.route.path];
      const methods = Object.entries(layer.route.methods ?? {})
        .filter(([, enabled]) => enabled)
        .map(([method]) => method.toUpperCase());

      for (const routePath of paths) {
        for (const method of methods) {
          routes.push({
            moduleId,
            method,
            path: normalizeRoutePath(basePath, routePath)
          });
        }
      }

      continue;
    }

    if (Array.isArray(layer.handle?.stack)) {
      routes.push(
        ...collectRoutesFromStack(moduleId, basePath, layer.handle.stack)
      );
    }
  }

  return routes;
}

function readRouterStack(router: Router): RouterLayer[] {
  const stack = (router as Router & { stack?: RouterLayer[] }).stack;

  return Array.isArray(stack) ? stack : [];
}

function normalizeRoutePath(basePath: string, routePath: string) {
  const normalizedBase = stripTrailingSlash(basePath);
  const normalizedRoute =
    routePath === "/"
      ? ""
      : routePath.startsWith("/")
        ? routePath
        : `/${routePath}`;
  const combined = `${normalizedBase}${normalizedRoute}`;

  return combined === "" ? "/" : combined;
}

function stripTrailingSlash(value: string) {
  if (value === "/") {
    return "";
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}
