import IORedis from "ioredis";

import type { AppConfig } from "@/config/env";

let sharedHealthClient: IORedis | null = null;

export function createBullMqConnection(config: AppConfig) {
  return new IORedis(config.asyncWorkloads.redisUrl, {
    maxRetriesPerRequest: null
  });
}

export function createRedisHealthClient(config: AppConfig) {
  if (sharedHealthClient) {
    return sharedHealthClient;
  }

  sharedHealthClient = new IORedis(config.asyncWorkloads.redisUrl, {
    maxRetriesPerRequest: 1
  });

  return sharedHealthClient;
}

export async function closeRedisHealthClient() {
  if (!sharedHealthClient) {
    return;
  }

  await sharedHealthClient.quit();
  sharedHealthClient = null;
}
