import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceStore } from "../electron/workspace-store.js";
import { normalizeWorkspace } from "../src/models.js";

test("concurrent saves preserve the latest snapshot", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "project-tasks-test-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const path = join(directory, "projects.json");
  const store = createWorkspaceStore(path);
  assert.deepEqual(await store.load(), []);
  const workspace = { projectTypes: [], projects: [] };
  const saves = [];
  for (let i = 0; i < 20; i++) {
    workspace.projects.push({ name: String(i) });
    saves.push(store.save(workspace));
  }
  await Promise.all(saves);
  assert.deepEqual(await store.load(), workspace);
  assert.equal(JSON.parse(await readFile(path, "utf8")).projects.length, 20);
});

test("invalid JSON is reported instead of silently replaced with empty data", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "project-tasks-test-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const path = join(directory, "projects.json");
  await writeFile(path, "broken JSON");
  await assert.rejects(createWorkspaceStore(path).load(), SyntaxError);
  assert.equal(await readFile(path, "utf8"), "broken JSON");
});

test("adding a calendar event preserves a legacy project and its tasks", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "project-tasks-test-"));
  t.after(() => rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));
  const path = join(directory, "projects.json");
  const legacy = {
    version: 2,
    projectTypes: [{ id: "work", name: "Работа" }],
    projects: [{ id: "project", typeId: "work", name: "Важный проект", tasks: [{ id: "task", title: "Не потерять", comment: "Текст" }] }]
  };
  await writeFile(path, JSON.stringify(legacy));
  const store = createWorkspaceStore(path);
  const workspace = normalizeWorkspace(await store.load());
  workspace.calendarEvents.push({ id: "event", title: "День рождения", date: "2026-09-14", time: "", annual: true });
  await store.save(workspace);
  const restored = await store.load();
  assert.equal(restored.version, 3);
  assert.equal(restored.projects[0].tasks[0].comment, "Текст");
  assert.equal(restored.projectTypes[0].name, "Работа");
  assert.equal(restored.calendarEvents[0].annual, true);
});
