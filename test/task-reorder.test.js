import test from "node:test";
import assert from "node:assert/strict";
import { createProject, createTask, moveTask, normalizeWorkspace } from "../src/models.js";
import { changeTaskStatus, recordTaskEvent } from "../src/task-journal.js";

test("tasks can move up/down, to first/last, and next to adjacent items", () => {
  for (const [from, to, placement, expected] of [
    ["a", "c", "after", ["b", "c", "a"]], ["c", "a", "before", ["c", "a", "b"]],
    ["a", "b", "after", ["b", "a", "c"]], ["b", "a", "before", ["b", "a", "c"]],
    ["c", "a", "after", ["a", "c", "b"]], ["a", "c", "before", ["b", "a", "c"]]
  ]) {
    const project = { tasks: ["a", "b", "c"].map((id) => ({ id })) };
    assert.equal(moveTask(project, from, to, placement), true);
    assert.deepEqual(project.tasks.map((task) => task.id), expected);
  }
});

test("no-op, canceled or foreign moves cannot remove, duplicate or change tasks", () => {
  const project = { tasks: ["a", "b", "c"].map((id) => ({ id })) };
  for (const args of [["a", "a"], ["a", "b", "before"], ["b", "a", "after"], ["foreign", "a"], ["a", "foreign"], ["a", "b", "invalid"]]) {
    assert.equal(moveTask(project, ...args), false);
    assert.deepEqual(project.tasks.map((task) => task.id), ["a", "b", "c"]);
  }
  assert.equal(moveTask(null, "a", "b"), false);
});

test("new order survives persistence without changing task IDs, comments, statuses, dates or journal", () => {
  const workspace = normalizeWorkspace({ version: 4, projects: [], taskJournal: [] });
  const project = createProject("Проект");
  workspace.projects.push(project);
  project.tasks.push(...["Первая", "Вторая", "Третья"].map(createTask));
  for (const task of project.tasks) {
    task.comment = "**Комментарий**";
    recordTaskEvent(workspace, project, task, "created", task.createdAt);
    changeTaskStatus(workspace, project, task, "in_progress");
  }
  const originals = [...project.tasks];
  const history = JSON.stringify(workspace.taskJournal);
  moveTask(project, originals[0].id, originals[2].id, "after");
  assert.deepEqual(project.tasks, [originals[1], originals[2], originals[0]]);
  assert.equal(project.tasks[2], originals[0]);
  const restored = normalizeWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.deepEqual(restored.projects[0].tasks, project.tasks);
  assert.equal(JSON.stringify(restored.taskJournal), history);
});
