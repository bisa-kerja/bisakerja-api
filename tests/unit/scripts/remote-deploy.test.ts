import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, test } from "bun:test";

describe("remote deploy topology", () => {
  test("deploy script starts runtime services and checks worker smoke", async () => {
    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, "scripts/deploy/remote-deploy.sh");
    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain('compose pull app worker redis');
    expect(script).toContain('compose up -d --wait --wait-timeout 120 redis app worker');
    expect(script).toContain('compose ps --quiet --status running worker');
    expect(script).toContain('compose logs --tail=100 worker | grep -Fq "Async worker started"');
    expect(script).not.toContain('up -d --wait app');
    expect(script).not.toContain('pull app\n');
  });

  test("deploy workflow collects worker diagnostics on failure", async () => {
    const rootDir = process.cwd();
    const workflowPath = path.join(rootDir, ".github/workflows/deploy.yml");
    const workflow = await readFile(workflowPath, "utf8");

    expect(workflow).toContain('logs --tail=100 app');
    expect(workflow).toContain('logs --tail=100 worker');
    expect(workflow).toContain('logs --tail=50 redis');
  });

  test("compose worker overrides app healthcheck with worker-specific probe", async () => {
    const rootDir = process.cwd();
    const composePath = path.join(rootDir, "docker-compose.yml");
    const composeFile = await readFile(composePath, "utf8");
    const workerSection = /worker:[\s\S]*?volumes:/.exec(composeFile)?.[0] ?? "";

    expect(workerSection).toContain("healthcheck:");
    expect(workerSection).toContain("CMD-SHELL");
    expect(workerSection).toContain("ps aux");
    expect(workerSection).toContain("grep '[b]un run worker:async'");
    expect(workerSection).toContain("src/scripts/worker-async.ts");
    expect(workerSection).not.toContain("/health/live");
  });
});
