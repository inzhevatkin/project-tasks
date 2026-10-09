import test from "node:test";
import assert from "node:assert/strict";
import { createProject, createTask, normalizeWorkspace } from "../src/models.js";
import { changeTaskStatus, filterTaskJournal, journalTypes, journalProjects, journalTasks, MAX_WORKING_TASKS, recordTaskDeletion, recordTaskEvent, workingTasks } from "../src/task-journal.js";
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

test("parallel work preserves both tasks; completing and reopening preserve dates", () => {
  const { workspace, project, first, second } = fixture();
  const otherProject = createProject("Другой проект");
  project.tasks = [first];
  otherProject.tasks.push(second);
  workspace.projects.push(otherProject);
  recordTaskEvent(workspace, project, first, "created", first.createdAt);
  assert.equal(changeTaskStatus(workspace, project, first, "in_progress", "2026-10-01T03:00:00.000Z"), true);
  assert.equal(changeTaskStatus(workspace, project, first, "in_progress", "2026-10-01T03:01:00.000Z"), false);
  changeTaskStatus(workspace, otherProject, second, "in_progress", "2026-10-01T04:00:00.000Z");
  assert.equal(first.status, "in_progress");
  assert.equal(first.workStartedAt, "2026-10-01T03:00:00.000Z");
  assert.deepEqual(workingTasks(workspace).map(({ task }) => task.id), [first.id, second.id]);
  changeTaskStatus(workspace, otherProject, second, "completed", "2026-10-01T05:00:00.000Z");
  assert.deepEqual(workingTasks(workspace).map(({ task }) => task.id), [first.id]);
  assert.equal(second.completed, true);
  assert.equal(second.completedAt, "2026-10-01T05:00:00.000Z");
  changeTaskStatus(workspace, otherProject, second, "in_progress", "2026-10-02T03:00:00.000Z");
  assert.equal(second.completed, false);
  assert.equal(second.completedAt, null);
  assert.deepEqual(workspace.taskJournal.map((entry) => entry.action), ["created", "started", "started", "completed", "reopened", "started"]);
  assert.equal(workspace.taskJournal[2].taskId, second.id);
  assert.equal(workspace.taskJournal[2].projectId, otherProject.id);
  const restored = normalizeWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.deepEqual(workingTasks(restored).map(({ task }) => task.workStartedAt), ["2026-10-01T03:00:00.000Z", "2026-10-02T03:00:00.000Z"]);
  assert.deepEqual(restored.taskJournal, workspace.taskJournal);
});

test("at most three tasks across all sections/projects; excess starts are atomic and freed slots can be reused", () => {
  const { workspace, project, first, second } = fixture();
  const other = createProject("Домашний проект", "home");
  const third = createTask("Третья");
  const fourth = createTask("Четвёртая");
  fourth.status = "completed";
  fourth.completed = true;
  fourth.completedAt = "2026-10-01T01:00:00.000Z";
  other.tasks.push(third, fourth);
  workspace.projects.push(other);
  assert.equal(MAX_WORKING_TASKS, 3);
  for (const [owner, task] of [[project, first], [project, second], [other, third]]) {
    assert.equal(changeTaskStatus(workspace, owner, task, "in_progress"), true);
  }
  const before = JSON.stringify(workspace);
  assert.equal(changeTaskStatus(workspace, other, fourth, "in_progress"), false);
  assert.equal(changeTaskStatus(workspace, project, first, "in_progress"), false);
  assert.equal(JSON.stringify(workspace), before);
  changeTaskStatus(workspace, project, first, "pending");
  assert.equal(changeTaskStatus(workspace, other, fourth, "in_progress"), true);
  assert.equal(workingTasks(workspace).length, 3);
  assert.deepEqual(workspace.taskJournal.slice(-3).map((entry) => entry.action), ["paused", "reopened", "started"]);
  recordTaskDeletion(workspace, other, third);
  other.tasks.splice(other.tasks.indexOf(third), 1);
  assert.equal(changeTaskStatus(workspace, project, first, "in_progress"), true);
  changeTaskStatus(workspace, project, second, "completed");
  assert.equal(workingTasks(workspace).length, 2);
  assert.equal(changeTaskStatus(workspace, project, second, "in_progress"), true);
  const restored = normalizeWorkspace(JSON.parse(JSON.stringify(workspace)));
  assert.equal(workingTasks(restored).length, 3);
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

test("project filter uses identity across renames and deletion, together with date and text filters", () => {
  const { workspace, project, first } = fixture();
  const other = createProject(project.name);
  const otherTask = createTask(first.title);
  other.tasks.push(otherTask);
  workspace.projects.push(other);
  const date = new Date(2026, 9, 6, 10).toISOString();
  recordTaskEvent(workspace, project, first, "created", date);
  recordTaskEvent(workspace, other, otherTask, "created", date);
  project.name = "Новое название";
  recordTaskEvent(workspace, project, first, "completed", new Date(2026, 9, 6, 11).toISOString());
  const day = localDateKey(new Date(date));
  assert.deepEqual(filterTaskJournal(workspace.taskJournal, { projectId: project.id, from: day, to: day, query: "первая" }).map((entry) => entry.action), ["completed", "created"]);
  assert.equal(filterTaskJournal(workspace.taskJournal, { projectId: other.id }).length, 1);
  assert.equal(filterTaskJournal(workspace.taskJournal, { projectId: project.id, to: "2000-01-01" }).length, 0);
  assert.equal(filterTaskJournal(workspace.taskJournal, { projectId: project.id, query: "нет такой задачи" }).length, 0);
  const currentChoices = journalProjects(workspace.taskJournal, workspace.projects, workspace.projectTypes);
  assert.equal(currentChoices.length, 2);
  assert.equal(currentChoices.find((choice) => choice.id === project.id).name, "Новое название");
  workspace.projects = [other];
  const deleted = journalProjects([...workspace.taskJournal].reverse(), workspace.projects, workspace.projectTypes).find((choice) => choice.id === project.id);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.name, "Новое название");
  assert.equal(filterTaskJournal(workspace.taskJournal, { projectId: project.id }).length, 2);
});

test("task choices follow their project and preserve renamed or deleted task history", () => {
  const { workspace, project, first, second } = fixture();
  const other = createProject("Другой проект");
  const duplicate = { ...createTask(first.title), id: first.id };
  other.tasks.push(duplicate);
  workspace.projects.push(other);
  const date = new Date(2026, 9, 6, 10).toISOString();
  recordTaskEvent(workspace, project, first, "created", date);
  recordTaskEvent(workspace, project, second, "created", date);
  recordTaskEvent(workspace, other, duplicate, "created", date);
  first.title = "Новое название задачи";
  recordTaskEvent(workspace, project, first, "completed", new Date(2026, 9, 6, 11).toISOString());
  const choices = journalTasks(workspace.taskJournal, workspace.projects);
  assert.equal(choices.length, 3);
  assert.equal(new Set(choices.map((task) => task.key)).size, 3);
  assert.equal(journalTasks(workspace.taskJournal, workspace.projects, other.id).length, 1);
  assert.equal(choices.find((task) => task.projectId === project.id && task.id === first.id).title, first.title);
  const day = localDateKey(new Date(date));
  assert.deepEqual(filterTaskJournal(workspace.taskJournal, { projectId: project.id, taskId: first.id, from: day, to: day }).map((entry) => entry.action), ["completed", "created"]);
  assert.equal(filterTaskJournal(workspace.taskJournal, { projectId: project.id, taskId: first.id, query: "новое" }).length, 1);
  assert.equal(filterTaskJournal(workspace.taskJournal, { projectId: project.id, taskId: first.id, to: "2000-01-01" }).length, 0);
  project.tasks = [second];
  const deleted = journalTasks([...workspace.taskJournal].reverse(), workspace.projects, project.id).find((task) => task.id === first.id);
  assert.equal(deleted.deleted, true);
  assert.equal(deleted.title, "Новое название задачи");
  assert.equal(deleted.projectId, project.id);
});

test("section, project and task filters cascade by identity and combine with dates and search", () => {
  const { workspace, project, first } = fixture();
  workspace.projectTypes.push({ id: "home", name: "Работа" }, { id: "empty", name: "Пустой" });
  const home = createProject(project.name, "home");
  const duplicate = { ...createTask(first.title), id: first.id };
  home.tasks.push(duplicate);
  workspace.projects.push(home);
  const date = new Date(2026, 9, 7, 10).toISOString();
  recordTaskEvent(workspace, project, first, "created", date);
  recordTaskEvent(workspace, home, duplicate, "created", date);
  workspace.projectTypes[0].name = "Офис";
  recordTaskEvent(workspace, project, first, "completed", new Date(2026, 9, 7, 11).toISOString());
  assert.equal(journalTypes(workspace.taskJournal, workspace.projectTypes).length, 3);
  assert.equal(journalTypes(workspace.taskJournal, workspace.projectTypes).find((type) => type.id === "work").name, "Офис");
  assert.deepEqual(journalProjects(workspace.taskJournal, workspace.projects, workspace.projectTypes, "home").map((choice) => choice.id), [home.id]);
  assert.deepEqual(journalTasks(workspace.taskJournal, workspace.projects, "", "home").map((choice) => choice.projectId), [home.id]);
  assert.equal(journalTasks(workspace.taskJournal, workspace.projects, project.id, "home").length, 0);
  const day = localDateKey(new Date(date));
  assert.deepEqual(filterTaskJournal(workspace.taskJournal, {
    typeId: "work", projectId: project.id, taskId: first.id, from: day, to: day, query: "первая"
  }).map((entry) => entry.action), ["completed", "created"]);
  assert.equal(filterTaskJournal(workspace.taskJournal, { typeId: "home" }).length, 1);
  assert.equal(filterTaskJournal(workspace.taskJournal, { typeId: "home", projectId: project.id }).length, 0);
  assert.equal(filterTaskJournal(workspace.taskJournal, { typeId: "empty" }).length, 0);
  assert.equal(filterTaskJournal(workspace.taskJournal, { typeId: "work", to: "2000-01-01" }).length, 0);
  assert.equal(filterTaskJournal(workspace.taskJournal, { typeId: "work", query: "неизвестная" }).length, 0);
  workspace.projects = [home];
  workspace.projectTypes = workspace.projectTypes.filter((type) => type.id !== "work");
  const entries = [...workspace.taskJournal].reverse();
  const deleted = journalTypes(entries, workspace.projectTypes).find((type) => type.id === "work");
  assert.deepEqual(deleted, { id: "work", name: "Офис", deleted: true });
  assert.equal(journalProjects(entries, workspace.projects, workspace.projectTypes, "work")[0].deleted, true);
  assert.equal(journalTasks(entries, workspace.projects, "", "work")[0].deleted, true);
  assert.equal(filterTaskJournal(entries, { typeId: "work", projectId: project.id, taskId: first.id }).length, 2);
});
