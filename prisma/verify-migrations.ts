const verificationEnv = {
  ...process.env,
  APP_ENV: "test",
  NODE_ENV: "test",
  RUN_DATABASE_TESTS: "true"
};

async function runStep(label: string, command: string[]) {
  console.info(`Running ${label}...`);

  const processResult = Bun.spawn(command, {
    env: verificationEnv,
    stdout: "inherit",
    stderr: "inherit"
  });
  const exitCode = await processResult.exited;

  if (exitCode !== 0) {
    throw new Error(`${label} failed with exit code ${exitCode}.`);
  }
}

await runStep("Prisma schema validation", ["bun", "run", "prisma:validate"]);
await runStep("Prisma client generation", ["bun", "run", "prisma:generate"]);
await runStep("Prisma migration deploy", [
  "bun",
  "run",
  "prisma:migrate:deploy"
]);
await runStep("repository integration tests", [
  "bun",
  "test",
  "tests/integration/repositories"
]);
