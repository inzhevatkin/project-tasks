import { normalizeCalendarEvents } from "./calendar.js";

export const DEFAULT_PROJECT_TYPE_ID = "work";

export function createProjectType(name) {
  return { id: crypto.randomUUID(), name: name.trim() };
}

export function createProject(name, typeId = DEFAULT_PROJECT_TYPE_ID) {
  return {
    id: crypto.randomUUID(), name: name.trim(), typeId,
    createdAt: new Date().toISOString(), tasks: []
  };
}

export function createTask(title) {
  return {
    id: crypto.randomUUID(), title: title.trim(), comment: "",
    completed: false, createdAt: new Date().toISOString()
  };
}

export function itemName(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeWorkspace(value) {
  const isLegacy = Array.isArray(value);
  const rawProjects = isLegacy ? value : value?.projects;
  const rawTypes = isLegacy ? [] : value?.projectTypes;
  const projectTypes = normalizeTypes(rawTypes);
  if (projectTypes.length === 0) {
    projectTypes.push({ id: DEFAULT_PROJECT_TYPE_ID, name: "Работа" });
  }

  const validTypeIds = new Set(projectTypes.map((type) => type.id));
  const fallbackTypeId = projectTypes[0].id;
  const projects = (Array.isArray(rawProjects) ? rawProjects : []).filter(isObject).map((project) => ({
    id: textOr(project.id, crypto.randomUUID()),
    name: textOr(project.name, "Без названия"),
    typeId: validTypeIds.has(project.typeId) ? project.typeId : fallbackTypeId,
    createdAt: textOr(project.createdAt, new Date().toISOString()),
    tasks: Array.isArray(project.tasks) ? project.tasks.filter(isObject).map(normalizeTask) : []
  }));

  return { version: 3, projectTypes, projects, calendarEvents: normalizeCalendarEvents(isLegacy ? [] : value?.calendarEvents) };
}

function normalizeTypes(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter(isObject).map((type) => ({
    id: textOr(type.id, crypto.randomUUID()),
    name: textOr(type.name, "Без названия")
  })).filter((type) => {
    if (seen.has(type.id)) return false;
    seen.add(type.id);
    return true;
  });
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
