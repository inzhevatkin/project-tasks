import test from "node:test";
import assert from "node:assert/strict";
import { createProject, createTask, normalizeProjects } from "../src/models.js";

test("создаёт проект и задачу с нужными полями", () => {
  const project = createProject("  Новый проект  ");
  const task = createTask("  Первая задача  ");
  project.tasks.push(task);
  assert.equal(project.name, "Новый проект");
  assert.equal(task.title, "Первая задача");
  assert.equal(task.comment, "");
  assert.equal(task.completed, false);
});

test("нормализует повреждённые сохранённые данные", () => {
  const result = normalizeProjects([{ name: "Проект", tasks: [null, { title: "Задача", completed: 1 }] }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].tasks.length, 1);
  assert.equal(result[0].tasks[0].title, "Задача");
  assert.equal(result[0].tasks[0].completed, false);
});
