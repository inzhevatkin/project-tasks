import test from "node:test";
import assert from "node:assert/strict";
import { createProject, createTask, normalizeWorkspace } from "../src/models.js";
import { changeTaskStatus, filterTaskJournal, recordTaskDeletion, recordTaskEvent, workingTask } from "../src/task-journal.js";
import { localDateKey } from "../src/calendar.js";

function fixture() {
  const workspace = normalizeWorkspace({ version: 4, projects: [], taskJournal: [] });
  const project = createProject("Рабочий проект");
  const first = createTask("Первая задача");
  const second = createTask("Вторая задача");
  project.tasks.push(first, second);
  workspace.projects.push(project);
  return { workspace, project, first, second };
}

test("switching current work records both tasks; completing and reopening preserve dates", () => {
  const { workspace, project, first, second } = fixture();
  const otherProject = createProject("Другой проект");
  project.tasks = [first];
  otherProject.tasks.push(second);
  workspace.projects.push(otherProject);
  recordTaskEvent(workspace, project, first, "created", first.createdAt);
  assert.equal(changeTaskStatus(workspace, project, first, "in_progress", "2026-10-01T03:00:00.000Z"), true);
  assert.equal(changeTaskStatus(workspace, project, first, "in_progress", "2026-10-01T03:01:00.000Z"), false);
  changeTaskStatus(workspace, otherProject, second, "in_progress", "2026-10-01T04:00:00.000Z");
  assert.equal(first.status, "pending");
  assert.equal(first.workStartedAt, null);
  assert.equal(workingTask(workspace).task.id, second.id);
  changeTaskStatus(workspace, otherProject, second, "completed", "2026-10-01T05:00:00.000Z");
  assert.equal(workingTask(workspace), null);
  assert.equal(second.completed, true);
  assert.equal(second.completedAt, "2026-10-01T05:00:00.000Z");
  changeTaskStatus(workspace, otherProject, second, "in_progress", "2026-10-02T03:00:00.000Z");
  assert.equal(second.completed, false);
  assert.equal(second.completedAt, null);
  assert.deepEqual(workspace.taskJournal.map((entry) => entry.action), ["created", "started", "paused", "started", "completed", "reopened", "started"]);
  assert.equal(workspace.taskJournal[2].taskId, first.id);
  assert.equal(workspace.taskJournal[2].projectId, project.id);
  assert.equal(workspace.taskJournal[3].projectId, otherProject.id);
  assert.equal(workspace.taskJournal[3].at, workspace.taskJournal[2].at);
  const restored = normalizeWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.equal(workingTask(restored).task.workStartedAt, "2026-10-02T03:00:00.000Z");
  assert.deepEqual(restored.taskJournal, workspace.taskJournal);
});

test("journal snapshots survive task/project renaming and deletion", () => {
  const { workspace, project, first } = fixture();
  recordTaskEvent(workspace, project, first, "created");
  changeTaskStatus(workspace, project, first, "in_progress");
  first.title = "Переименованная задача";
  project.name = "Переименованный проект";
  recordTaskDeletion(workspace, project, first);
  workspace.projects = [];
  const restored = normalizeWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.equal(restored.taskJournal[0].taskTitle, "Первая задача");
  assert.equal(restored.taskJournal[0].projectName, "Рабочий проект");
  assert.deepEqual(restored.taskJournal.slice(-2).map((entry) => entry.action), ["paused", "deleted"]);
  assert.equal(restored.taskJournal.at(-1).taskTitle, "Переименованная задача");
  assert.equal(restored.taskJournal.at(-1).projectName, "Переименованный проект");
});

test("legacy migration preserves data and imports only known creation dates once", () => {
  const legacy = {
    version: 3, projectTypes: [{ id: "home", name: "Дом" }],
    projects: [{ id: "project", typeId: "home", name: "Проект", tasks: [
      { id: "known", title: "Закрытая", comment: "**Текст**", completed: true, createdAt: "2026-09-05T10:20:00Z" },
      { id: "unknown", title: "Без даты", comment: "Текст", completed: false }
    ] }],
    calendarEvents: [{ id: "event", title: "День рождения", date: "2026-10-01", annual: true }]
  };
  const migrated = normalizeWorkspace(legacy);
  assert.equal(migrated.projects[0].tasks[0].status, "completed");
  assert.equal(migrated.projects[0].tasks[0].completedAt, null);
  assert.equal(migrated.projects[0].tasks[0].comment, "**Текст**");
  assert.equal(migrated.calendarEvents[0].annual, true);
  assert.equal(migrated.taskJournal.length, 1);
  assert.equal(migrated.taskJournal[0].at, "2026-09-05T10:20:00.000Z");
  assert.equal(migrated.taskJournal[0].imported, true);
  assert.equal(migrated.projects[0].tasks[1].createdAt, null);
  const reloaded = normalizeWorkspace(migrated);
  assert.deepEqual(reloaded.taskJournal, migrated.taskJournal);
  assert.equal(reloaded.journalStartedAt, migrated.journalStartedAt);
});

test("date filters use local days, search snapshots and retain transition order", () => {
  const { workspace, project, first } = fixture();
  const start = new Date(2026, 9, 1, 23, 59, 0).toISOString();
  const next = new Date(2026, 9, 2, 0, 1, 0).toISOString();
  recordTaskEvent(workspace, project, first, "created", start);
  changeTaskStatus(workspace, project, first, "in_progress", start);
  changeTaskStatus(workspace, project, first, "completed", next);
  const day = localDateKey(new Date(start));
  assert.deepEqual(filterTaskJournal(workspace.taskJournal, { from: day, to: day, query: "первая" }).map((entry) => entry.action), ["started", "created"]);
  assert.equal(filterTaskJournal(workspace.taskJournal, { query: "другой проект" }).length, 0);
  assert.equal(filterTaskJournal(workspace.taskJournal)[0].action, "completed");
});
