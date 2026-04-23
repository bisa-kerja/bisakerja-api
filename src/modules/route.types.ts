import type { AuthRouterOptions } from "@/modules/auth";
import type { HealthRouterOptions } from "@/modules/health";
import type { PreferencesRouterOptions } from "@/modules/preferences";
import type { UsersRouterOptions } from "@/modules/users";

export type RouteOptions = {
  auth?: AuthRouterOptions;
  health?: HealthRouterOptions;
  preferences?: PreferencesRouterOptions;
  users?: UsersRouterOptions;
};
