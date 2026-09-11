import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

// Serialize writes so two saves cannot share the temporary file concurrently.
export function createWorkspaceStore(path) {
  let pending = Promise.resolve();
  return {
    async load() {
      try {
        return JSON.parse(await readFile(path, "utf8"));
      } catch (error) {
        if (error.code === "ENOENT") return [];
        throw error;
      }
    },
    save(workspace) {
      if (!workspace || !Array.isArray(workspace.projectTypes) || !Array.isArray(workspace.projects)) {
        return Promise.reject(new TypeError("Ожидались типы проектов и список проектов"));
      }
      const json = JSON.stringify(workspace, null, 2);
      const operation = pending.then(async () => {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(`${path}.tmp`, json, "utf8");
        await rename(`${path}.tmp`, path);
        return true;
      });
      pending = operation.catch(() => {});
      return operation;
    }
  };
}
