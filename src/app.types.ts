import type { registerRoutes } from "@/modules";

export type AppOptions = {
  routes?: Parameters<typeof registerRoutes>[2];
};
