import test from "node:test";
import assert from "node:assert/strict";
import { createProject, createProjectType, createTask, itemName, normalizeWorkspace } from "../src/models.js";

test("создаёт проект и задачу с нужными полями", () => {
  const type = createProjectType("  Дом  ");
  const project = createProject("  Новый проект  ", type.id);
  const task = createTask("  Первая задача  ");
  project.tasks.push(task);
  assert.equal(project.name, "Новый проект");
  assert.equal(project.typeId, type.id);
  assert.equal(type.name, "Дом");
  assert.equal(task.title, "Первая задача");
  assert.equal(task.comment, "");
  assert.equal(task.completed, false);
});

test("нормализует повреждённые сохранённые данные", () => {
  const result = normalizeWorkspace({ projectTypes: [{ id: "home", name: "Дом" }], projects: [{ name: "Проект", typeId: "home", tasks: [null, { title: "Задача", completed: 1 }] }] });
  assert.equal(result.projects.length, 1);
  assert.equal(result.projects[0].tasks.length, 1);
  assert.equal(result.projects[0].tasks[0].title, "Задача");
  assert.equal(result.projects[0].tasks[0].completed, false);
});

test("переносит старые проекты в тип Работа", () => {
  const result = normalizeWorkspace([{ name: "Старый проект", tasks: [] }]);
  assert.equal(result.projectTypes[0].name, "Работа");
  assert.equal(result.projects[0].typeId, result.projectTypes[0].id);
  assert.deepEqual(result.calendarEvents, []);
});

test("старый файл проектов сохраняет задачи при добавлении календаря", () => {
  const old = {
    version: 2,
    projectTypes: [{ id: "home", name: "Дом" }],
    projects: [{ id: "project", name: "Ремонт", typeId: "home", tasks: [{ id: "task", title: "Купить краску", comment: "Синюю", completed: false }] }]
  };
  const result = normalizeWorkspace(old);
  assert.equal(result.version, 3);
  assert.equal(result.projects[0].tasks[0].comment, "Синюю");
  assert.equal(result.projectTypes[0].name, "Дом");
  assert.deepEqual(result.calendarEvents, []);
});

test("проверяет новое название при переименовании", () => {
  assert.equal(itemName("  Новое название  "), "Новое название");
  assert.equal(itemName("   "), null);
  assert.equal(itemName(null), null);
});
