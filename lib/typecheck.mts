import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const solution = JSON.parse(readFileSync("tsconfig.json", "utf8")) as {
  references: { path: string }[];
};

for (const { path } of solution.references) {
  const result = spawnSync(
    process.platform === "win32" ? "pnpm.cmd" : "pnpm",
    ["exec", "tsc", "--project", path, "--pretty", "false"],
    { encoding: "utf8" },
  );
  if (result.error) throw result.error;
  // Environment folders may be empty until application code is added.
  const output = result.stdout + result.stderr;
  if (result.status !== 0 && /^error TS18003:[^\n]*\n?$/.test(output)) continue;
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  if (result.status !== 0) process.exitCode = result.status ?? 1;
}
