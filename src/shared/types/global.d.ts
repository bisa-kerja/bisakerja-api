import type { Logger } from "pino";
import type { AuthRequestContext } from "@/modules/auth";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      logger?: Logger;
      auth?: AuthRequestContext;
    }
  }
}
