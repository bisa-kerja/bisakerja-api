import type { AppConfig } from "@/config/env";

export type DependencyCheck = () => Promise<void>;

export type HealthDependencyChecks = {
  postgresql: DependencyCheck;
  redis: DependencyCheck;
  modelApi: DependencyCheck;
};

export type DependencyState = "healthy" | "unhealthy";

export type DependencyResult = {
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
    redis: "healthy";
    modelApi: "healthy";
  };
};

export type HealthRouterOptions = {
  checks?: HealthDependencyChecks;
};
