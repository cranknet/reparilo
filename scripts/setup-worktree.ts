#!/usr/bin/env node

import { spawnSync } from "node:child_process";

function getWorktreeSetupSteps() {
  return [
    { label: "Install dependencies", command: "pnpm", args: ["install"] },
    {
      label: "Generate Prisma client",
      command: "pnpm",
      args: ["exec", "prisma", "generate"],
    },
  ];
}

function formatStepCommand(step: { command: string; args: string[] }) {
  return [step.command, ...step.args].join(" ");
}

function defaultRunner(command: string, args: string[]) {
  return spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
}

function runWorktreeSetup(options?: {
  runner?: (cmd: string, args: string[]) => ReturnType<typeof spawnSync>;
  io?: { out: (msg: string) => void; error: (msg: string) => void };
  steps?: ReturnType<typeof getWorktreeSetupSteps>;
}) {
  const runner = options?.runner || defaultRunner;
  const io = options?.io || {
    out: (m: string) => process.stdout.write(m),
    error: (m: string) => process.stderr.write(m),
  };
  const steps = options?.steps || getWorktreeSetupSteps();

  io.out("Bootstrapping worktree dependencies and Prisma client...\n");

  for (const step of steps) {
    io.out(`-> ${step.label}: ${formatStepCommand(step)}\n`);
    const result = runner(step.command, step.args);

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      throw new Error(`Worktree setup failed during: ${step.label}`);
    }
  }

  io.out(
    "Worktree bootstrap complete. Use the repo's local .env for dev/build commands.\n"
  );
}

runWorktreeSetup();
