export function createProject(name) {
  return {
    id: crypto.randomUUID(), name: name.trim(),
    createdAt: new Date().toISOString(), tasks: []
  };
}

export function createTask(title) {
  return {
    id: crypto.randomUUID(), title: title.trim(), comment: "",
    completed: false, createdAt: new Date().toISOString()
  };
}

export function normalizeProjects(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isObject).map((project) => ({
    id: textOr(project.id, crypto.randomUUID()),
    name: textOr(project.name, "Без названия"),
    createdAt: textOr(project.createdAt, new Date().toISOString()),
    tasks: Array.isArray(project.tasks) ? project.tasks.filter(isObject).map(normalizeTask) : []
  }));
}

function normalizeTask(task) {
  return {
    id: textOr(task.id, crypto.randomUUID()),
    title: textOr(task.title, "Без названия"),
    comment: typeof task.comment === "string" ? task.comment : "",
    completed: task.completed === true,
    createdAt: textOr(task.createdAt, new Date().toISOString())
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
