import { readFileSync } from "node:fs";
import { mkdir, writeFile, rename } from "node:fs/promises";
import { dirname } from "node:path";

export const LANGUAGES = ["ru", "en", "zh"];

export function createLanguageSettings(path, fallback = "ru") {
  let locale = LANGUAGES.includes(fallback) ? fallback : "ru";
  try {
    const saved = readFileSync(path, "utf8").trim();
    if (LANGUAGES.includes(saved)) locale = saved;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let pending = Promise.resolve();
  return {
    get: () => locale,
    set(value) {
      if (!LANGUAGES.includes(value)) return Promise.reject(new TypeError("Unsupported language"));
      const operation = pending.then(async () => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(`${path}.tmp`, value, "utf8");
        await rename(`${path}.tmp`, path);
        locale = value;
        return value;
      });
      pending = operation.catch(() => {});
      return operation;
    }
  };
}
