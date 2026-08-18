import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

function run(command, args) {
  return spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

const gitleaks = run("gitleaks", ["version"]);

if (gitleaks.error) {
  console.error(
    "Gitleaks is not installed. Install it from https://github.com/gitleaks/gitleaks#installing, then run npm run setup again.",
  );
  process.exit(1);
}

if (gitleaks.status !== 0) {
  process.stderr.write(gitleaks.stderr || "Unable to run Gitleaks.\n");
  process.exit(gitleaks.status ?? 1);
}

const repository = run("git", ["rev-parse", "--show-toplevel"]);

if (repository.status !== 0) {
  process.stderr.write(
    repository.stderr || "Unable to find the Git repository.\n",
  );
  process.exit(repository.status ?? 1);
}

chmodSync(
  fileURLToPath(new URL("../.githooks/pre-commit", import.meta.url)),
  0o755,
);

const configuration = run("git", [
  "config",
  "--local",
  "core.hooksPath",
  ".githooks",
]);

if (configuration.status !== 0) {
  process.stderr.write(
    configuration.stderr || "Unable to configure the Git hooks path.\n",
  );
  process.exit(configuration.status ?? 1);
}

console.log(`Configured .githooks (${gitleaks.stdout.trim()}).`);
