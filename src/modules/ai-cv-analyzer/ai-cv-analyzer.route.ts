import multer from "multer";
import type { RequestHandler, Router } from "express";
import { Router as createRouter } from "express";

import type { AppConfig } from "@/config/env";
import { PayloadTooLargeError, ValidationError } from "@/core/errors/app.error";
import { createAuthMiddleware } from "@/core/middlewares/auth.middleware";
import { createRateLimiters } from "@/core/middlewares/rate-limit.middleware";
import { validate } from "@/core/middlewares/validate.middleware";
import { AiCvAnalyzerController } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.controller";
import { PrismaAiCvAnalyzerRepository } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.repository";
import { analyzeCvSchema } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.schema";
import { LocalCvFileStorage } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.storage";
import type { AiCvAnalyzerRouterOptions } from "@/modules/ai-cv-analyzer/ai-cv-analyzer.types";
import { createModelApiClient } from "@/shared/integrations/model-api.client";

export function createAiCvAnalyzerRouter(
  config: AppConfig,
  options: AiCvAnalyzerRouterOptions = {}
): Router {
  const router = createRouter();
  const repository = options.repository ?? new PrismaAiCvAnalyzerRepository();
  const authMiddleware = options.authMiddleware ?? createAuthMiddleware(config);
  const modelApiClient = options.modelApiClient ?? createModelApiClient(config);
  const storage =
    options.storage ?? new LocalCvFileStorage(config.uploads.storagePath);
  const controller = new AiCvAnalyzerController({
    repository,
    config,
    modelApiClient,
    storage,
    now: options.now
  });
  const { aiLimiter, uploadLimiter } = createRateLimiters(config);

  router.use(authMiddleware);
  router.post(
    "/",
    uploadLimiter,
    aiLimiter,
    requireMultipartFormData(),
    createCvUploadMiddleware(config),
    validate({ body: analyzeCvSchema }),
    validateUploadPresence(),
    controller.analyzeCv
  );

  return router;
}

export function requireMultipartFormData(): RequestHandler {
  return (req, _res, next) => {
    if (!req.is("multipart/form-data")) {
      next(
        new ValidationError("Multipart form data diperlukan", [
          {
            path: "body",
            message: "Request harus multipart/form-data",
            code: "custom"
          }
        ])
      );
      return;
    }

    next();
  };
}

export function createCvUploadMiddleware(config: AppConfig): RequestHandler {
  const allowedMimeTypes = new Set(config.uploads.cvAllowedMimeTypes);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      files: 1,
      fileSize: config.uploads.cvUploadMaxBytes,
      fields: 8,
      parts: 9
    },
    fileFilter: (_req, file, callback) => {
      if (!allowedMimeTypes.has(file.mimetype.toLowerCase())) {
        callback(
          new ValidationError("Tipe file CV tidak didukung", [
            {
              path: "cvFile",
              message: `Tipe file CV tidak didukung. Gunakan ${config.uploads.cvAllowedMimeTypes.join(", ")}`,
              code: "custom"
            }
          ])
        );
        return;
      }

      callback(null, true);
    }
  });

  const middleware = upload.single("cvFile");

  return (req, res, next) => {
    middleware(req, res, (error) => {
      if (!error) {
        next();
        return;
      }

      if (error instanceof multer.MulterError) {
        next(mapMulterError(error, config));
        return;
      }

      next(error);
    });
  };
}

export function validateUploadPresence(): RequestHandler {
  return (req, _res, next) => {
    const input = req.body as { inputMode?: string };

    if (input.inputMode === "UPLOAD" && !req.file) {
      next(
        new ValidationError("File CV wajib diunggah", [
          {
            path: "cvFile",
            message: "File CV PDF diperlukan untuk analisis",
            code: "custom"
          }
        ])
      );
      return;
    }

    next();
  };
}

function mapMulterError(error: multer.MulterError, config: AppConfig) {
  if (error.code === "LIMIT_FILE_SIZE") {
    return new PayloadTooLargeError(
      "Ukuran file CV melebihi batas maksimum",
      "PAYLOAD_TOO_LARGE",
      {
        path: "cvFile",
        maxBytes: config.uploads.cvUploadMaxBytes
      }
    );
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return new ValidationError("Hanya satu file CV yang boleh diunggah", [
      {
        path: "cvFile",
        message: "Unggah tepat satu file pada field cvFile",
        code: error.code
      }
    ]);
  }

  return new ValidationError("Payload upload multipart tidak valid", [
    {
      path: "cvFile",
      message:
        "Payload upload CV tidak valid. Periksa kembali field multipart dan kirim ulang file CV.",
      code: error.code
    }
  ]);
}
