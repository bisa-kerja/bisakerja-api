import { Router } from "express";

import type { AppConfig } from "@/config/env";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { UsersController } from "@/modules/users/users.controller";
import { PrismaUsersRepository } from "@/modules/users/users.repository";
import {
  replaceEducationSchema,
  replaceExperienceSchema,
  replaceSkillsSchema,
  updateCurrentUserSchema,
  upsertProfilePhotoSchema
} from "@/modules/users/users.schema";
import type { UsersRouterOptions } from "@/modules/users/users.types";

export function createUsersRouter(
  config: AppConfig,
  options: UsersRouterOptions = {}
): Router {
  const router = Router();
  const repository = options.repository ?? new PrismaUsersRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const controller = new UsersController({ repository });

  router.use(authMiddleware);

  router.get("/", controller.getCurrentUser);
  router.patch(
    "/",
    validate({ body: updateCurrentUserSchema }),
    controller.patchCurrentUser
  );
  router.put(
    "/profile-photo",
    validate({ body: upsertProfilePhotoSchema }),
    controller.upsertProfilePhoto
  );
  router.put(
    "/skills",
    validate({ body: replaceSkillsSchema }),
    controller.replaceSkills
  );
  router.put(
    "/experience",
    validate({ body: replaceExperienceSchema }),
    controller.replaceExperience
  );
  router.put(
    "/education",
    validate({ body: replaceEducationSchema }),
    controller.replaceEducation
  );

  return router;
}
