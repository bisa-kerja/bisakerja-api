import type { AuthRouterOptions } from "@/modules/auth";
import type { HealthRouterOptions } from "@/modules/health";
import type { JobsRouterOptions } from "@/modules/jobs";
import type { PreferencesRouterOptions } from "@/modules/preferences";
import type { UsersRouterOptions } from "@/modules/users";

export type RouteOptions = {
  auth?: AuthRouterOptions;
  health?: HealthRouterOptions;
  jobs?: JobsRouterOptions;
  preferences?: PreferencesRouterOptions;
  users?: UsersRouterOptions;
};
