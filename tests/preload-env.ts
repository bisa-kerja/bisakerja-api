process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.ASYNC_QUEUE_NAME ??= "bisakerja-async-test";
process.env.ASYNC_QUEUE_PREFIX ??= "bisakerja-test";
process.env.ASYNC_QUEUE_CONCURRENCY ??= "2";
process.env.ASYNC_QUEUE_MAX_ATTEMPTS ??= "3";
process.env.ASYNC_QUEUE_BACKOFF_MS ??= "100";
process.env.ASYNC_QUEUE_RECOVERY_BATCH_SIZE ??= "20";
process.env.ASYNC_QUEUE_RECOVERY_INTERVAL_MS ??= "1000";
