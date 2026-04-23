import type { AuthRouterOptions } from "@/modules/auth";
import type { HealthRouterOptions } from "@/modules/health";
import type { UsersRouterOptions } from "@/modules/users";

export type RouteOptions = {
  auth?: AuthRouterOptions;
  health?: HealthRouterOptions;
  users?: UsersRouterOptions;
};
