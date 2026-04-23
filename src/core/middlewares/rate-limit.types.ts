import type { RateLimitRequestHandler } from "express-rate-limit";

export type RateLimiterSet = {
  defaultLimiter: RateLimitRequestHandler;
  authLimiter: RateLimitRequestHandler;
  uploadLimiter: RateLimitRequestHandler;
  aiLimiter: RateLimitRequestHandler;
};
