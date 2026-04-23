import type { AuthRouterOptions } from "@/modules/auth";
import type { HealthRouterOptions } from "@/modules/health";

export type RouteOptions = {
  auth?: AuthRouterOptions;
  health?: HealthRouterOptions;
};
