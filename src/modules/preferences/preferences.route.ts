import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { PreferencesController } from "@/modules/preferences/preferences.controller";
import { PrismaPreferencesRepository } from "@/modules/preferences/preferences.repository";
import {
  patchPreferencesSchema,
  upsertPreferencesSchema
} from "@/modules/preferences/preferences.schema";
import type { PreferencesRouterOptions } from "@/modules/preferences/preferences.types";

export function createPreferencesRouter(
  config: AppConfig,
  options: PreferencesRouterOptions = {}
): Router {
  const router = Router();
  const repository = options.repository ?? new PrismaPreferencesRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const controller = new PreferencesController({ repository });

  router.use(authMiddleware);

  router.get("/", controller.getPreferences);
  router.put(
    "/",
    validate({ body: upsertPreferencesSchema }),
    controller.upsertPreferences
  );
  router.patch(
    "/",
    validate({ body: patchPreferencesSchema }),
    controller.patchPreferences
  );

  return router;
}
