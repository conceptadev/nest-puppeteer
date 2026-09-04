import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const expectedRef = "refs/heads/main";

if (
  process.env.GITHUB_ACTIONS !== "true" ||
  process.env.GITHUB_REF !== expectedRef ||
  typeof process.env.GITHUB_SHA !== "string"
) {
  throw new Error(`Publishing is restricted to GitHub Actions on ${expectedRef}`);
}

const gitStatus = spawnSync("git", ["status", "--porcelain"], { encoding: "utf8" });

if (gitStatus.error) {
  throw new Error("Could not inspect the git worktree", { cause: gitStatus.error });
}

if (gitStatus.status !== 0) {
  throw new Error(`git status exited with status ${gitStatus.status ?? "unknown"}`);
}

if (gitStatus.stdout.trim().length !== 0) {
  throw new Error("Refusing to publish from a dirty git worktree");
}

const headResult = spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" });

if (headResult.error) {
  throw new Error("Could not resolve the git commit", { cause: headResult.error });
}

if (headResult.status !== 0) {
  throw new Error(`git rev-parse exited with status ${headResult.status ?? "unknown"}`);
}

if (headResult.stdout.trim() !== process.env.GITHUB_SHA) {
  throw new Error("Git HEAD does not match the GitHub Actions commit");
}

const require = createRequire(import.meta.url);
const changesetsBin = require.resolve("@changesets/cli/bin.js");
const publishResult = spawnSync(process.execPath, [changesetsBin, "publish"], {
  stdio: "inherit",
});

if (publishResult.error) {
  throw new Error("Could not start Changesets publish", { cause: publishResult.error });
}

if (publishResult.signal !== null) {
  throw new Error(`Changesets publish terminated with ${publishResult.signal}`);
}

process.exitCode = publishResult.status ?? 1;
