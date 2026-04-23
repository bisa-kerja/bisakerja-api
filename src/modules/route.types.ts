import type { AiJobFitRouterOptions } from "@/modules/ai-job-fit";
import type { AuthRouterOptions } from "@/modules/auth";
import type { ApplicationsRouterOptions } from "@/modules/applications";
import type { BookmarksRouterOptions } from "@/modules/bookmarks";
import type { HealthRouterOptions } from "@/modules/health";
import type { JobsRouterOptions } from "@/modules/jobs";
import type { PreferencesRouterOptions } from "@/modules/preferences";
import type { UsersRouterOptions } from "@/modules/users";

export type RouteOptions = {
  aiJobFit?: AiJobFitRouterOptions;
  applications?: ApplicationsRouterOptions;
  auth?: AuthRouterOptions;
  bookmarks?: BookmarksRouterOptions;
  health?: HealthRouterOptions;
  jobs?: JobsRouterOptions;
  preferences?: PreferencesRouterOptions;
  users?: UsersRouterOptions;
};
