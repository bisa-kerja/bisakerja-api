import type { logger } from "@/config/logger";

export type RequestLogger = Pick<typeof logger, "info">;
