import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

if (existsSync(".git")) {
  execFileSync("git", ["config", "--local", "core.hooksPath", ".githooks"]);
}
