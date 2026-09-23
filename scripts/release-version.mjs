import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

// The initial 0.1.0 commit. Count first-parent commits after it so every
// new main-branch commit advances the patch number by exactly one.
const baseline = "4f022ff2d192935edb56e7d5b1c2f67704a88ab7";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
try {
  git("merge-base", "--is-ancestor", baseline, "HEAD");
} catch {
  throw new Error("The release baseline is not in this Git history");
}
const commits = Number(git("rev-list", "--first-parent", "--count", `${baseline}..HEAD`));
const version = `0.1.${commits + (process.argv.includes("--next") ? 1 : 0)}`;

if (process.argv.includes("--apply") || process.argv.includes("--next")) {
  for (const file of ["package.json", "package-lock.json"]) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    data.version = version;
    if (file === "package-lock.json") data.packages[""].version = version;
    writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
  }
}
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, `APP_VERSION=${version}\n`);
console.log(version);
