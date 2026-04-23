import { logger } from "@/config/logger";
import type { AppConfig } from "@/config/env";
import { ServiceUnavailableError } from "@/core/errors/app.error";
import { prisma } from "@/shared/libs/prisma";

export type DependencyCheck = () => Promise<void>;

export type HealthDependencyChecks = {
  postgresql: DependencyCheck;
};

type DependencyState = "healthy" | "unhealthy";

type DependencyResult = {
  status: DependencyState;
  durationMs: number;
  errorMessage: string | null;
};

export type ReadinessPayload = {
  service: string;
  status: "ready";
  env: AppConfig["app"]["env"];
  dependencies: {
    postgresql: "healthy";
  };
};

export const defaultHealthDependencyChecks: HealthDependencyChecks = {
  postgresql: async () => {
    await prisma.$queryRaw`SELECT 1`;
  }
};

export async function getReadinessPayload(
  config: AppConfig,
  requestId: string,
  checks: HealthDependencyChecks = defaultHealthDependencyChecks
): Promise<ReadinessPayload> {
  const postgresql = await checkDependency(
    "postgresql",
    "readiness",
    checks.postgresql,
    config.observability.healthCheckTimeoutMs,
    requestId
  );

  if (postgresql.status !== "healthy") {
    throw new ServiceUnavailableError(
      "Service is not ready",
      "SERVICE_UNAVAILABLE",
      {
        dependencies: {
          postgresql: postgresql.status
        }
      }
    );
  }

  return {
    service: config.app.name,
    status: "ready",
    env: config.app.env,
    dependencies: {
      postgresql: "healthy"
    }
  };
}

async function checkDependency(
  dependency: string,
  operation: string,
  check: DependencyCheck,
  timeoutMs: number,
  requestId: string
): Promise<DependencyResult> {
  const startedAt = performance.now();

  try {
    await runWithTimeout(check, timeoutMs, dependency);
    const durationMs = Math.round(performance.now() - startedAt);

    logger.debug(
      {
        requestId,
        dependency,
        operation,
        durationMs,
        result: "healthy"
      },
      "Dependency health check succeeded"
    );

    return {
      status: "healthy",
      durationMs,
      errorMessage: null
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.warn(
      {
        requestId,
        dependency,
        operation,
        durationMs,
        result: "unhealthy",
        errorMessage
      },
      "Dependency health check failed"
    );

    return {
      status: "unhealthy",
      durationMs,
      errorMessage
    };
  }
}

async function runWithTimeout(
  check: DependencyCheck,
  timeoutMs: number,
  dependency: string
) {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    await Promise.race([
      check(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error(`${dependency} health check timed out`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
