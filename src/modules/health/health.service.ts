import { logger } from "@/config/logger";
import type { AppConfig } from "@/config/env";
import { ServiceUnavailableError } from "@/core/errors/app.error";
import { prisma } from "@/shared/libs/prisma";
import { createRedisHealthClient } from "@/shared/libs/redis";
import type {
  DependencyCheck,
  DependencyResult,
  HealthDependencyChecks,
  ReadinessPayload
} from "@/modules/health/health.types";

export function createDefaultHealthDependencyChecks(
  config: AppConfig
): HealthDependencyChecks {
  return {
    postgresql: async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    redis: async () => {
      await createRedisHealthClient(config).ping();
    }
  };
}

export async function getReadinessPayload(
  config: AppConfig,
  requestId: string,
  checks: HealthDependencyChecks = createDefaultHealthDependencyChecks(config)
): Promise<ReadinessPayload> {
  const postgresql = await checkDependency(
    "postgresql",
    "readiness",
    checks.postgresql,
    config.observability.healthCheckTimeoutMs,
    requestId
  );
  const redis = await checkDependency(
    "redis",
    "readiness",
    checks.redis,
    config.observability.healthCheckTimeoutMs,
    requestId
  );

  if (postgresql.status !== "healthy" || redis.status !== "healthy") {
    throw new ServiceUnavailableError(
      "Layanan belum siap",
      "SERVICE_UNAVAILABLE",
      {
        dependencies: {
          postgresql: postgresql.status,
          redis: redis.status
        }
      }
    );
  }

  return {
    service: config.app.name,
    status: "ready",
    env: config.app.env,
    dependencies: {
      postgresql: "healthy",
      redis: "healthy"
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
): Promise<void> {
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
