import type { AiCvAnalyzerRouterOptions } from "@/modules/ai-cv-analyzer";
import type { AiJobFitRouterOptions } from "@/modules/ai-job-fit";
import type { AuthRouterOptions } from "@/modules/auth";
import type { ApplicationsRouterOptions } from "@/modules/applications";
import type { BookmarksRouterOptions } from "@/modules/bookmarks";
import type { HealthRouterOptions } from "@/modules/health";
import type { InternalRouterOptions } from "@/modules/internal";
import type { JobsRouterOptions } from "@/modules/jobs";
import type { PreferencesRouterOptions } from "@/modules/preferences";
import type { UsersRouterOptions } from "@/modules/users";

export type RouteOptions = {
  aiCvAnalyzer?: AiCvAnalyzerRouterOptions;
  aiJobFit?: AiJobFitRouterOptions;
  applications?: ApplicationsRouterOptions;
  auth?: AuthRouterOptions;
  bookmarks?: BookmarksRouterOptions;
  health?: HealthRouterOptions;
  internal?: InternalRouterOptions;
  jobs?: JobsRouterOptions;
  preferences?: PreferencesRouterOptions;
  users?: UsersRouterOptions;
};
