import { normalizeCalendarEvents } from "./calendar.js";
import { normalizeTaskJournal, recordTaskEvent, taskStatus, validTimestamp } from "./task-journal.js";

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
    status: "pending", completed: false, createdAt: new Date().toISOString(),
    workStartedAt: null, completedAt: null
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
  const explicitlyEmpty = value?.version === 4 && Array.isArray(rawTypes) && rawTypes.length === 0
    && Array.isArray(rawProjects) && rawProjects.length === 0;
  if (projectTypes.length === 0 && !explicitlyEmpty) {
    projectTypes.push({ id: DEFAULT_PROJECT_TYPE_ID, name: "Работа" });
  }

  const validTypeIds = new Set(projectTypes.map((type) => type.id));
  const fallbackTypeId = projectTypes[0]?.id ?? DEFAULT_PROJECT_TYPE_ID;
  const projects = (Array.isArray(rawProjects) ? rawProjects : []).filter(isObject).map((project) => ({
    id: textOr(project.id, crypto.randomUUID()),
    name: textOr(project.name, "Без названия"),
    typeId: validTypeIds.has(project.typeId) ? project.typeId : fallbackTypeId,
    createdAt: textOr(project.createdAt, new Date().toISOString()),
    tasks: Array.isArray(project.tasks) ? project.tasks.filter(isObject).map(normalizeTask) : []
  }));

  const workspace = {
    version: 4, projectTypes, projects,
    calendarEvents: normalizeCalendarEvents(isLegacy ? [] : value?.calendarEvents),
    taskJournal: normalizeTaskJournal(value?.taskJournal),
    journalStartedAt: validTimestamp(value?.journalStartedAt) ?? new Date().toISOString()
  };
  // Recover only dates that were actually stored. Old completion times were
  // never recorded, so migration must not invent them.
  if (!Array.isArray(value?.taskJournal)) {
    for (const project of projects) {
      for (const task of project.tasks) {
        if (task.createdAt) recordTaskEvent(workspace, project, task, "created", task.createdAt).imported = true;
      }
    }
  }
  return workspace;
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
  const status = taskStatus(task);
  return {
    id: textOr(task.id, crypto.randomUUID()),
    title: textOr(task.title, "Без названия"),
    comment: typeof task.comment === "string" ? task.comment : "",
    status, completed: status === "completed",
    createdAt: validTimestamp(task.createdAt),
    workStartedAt: status === "in_progress" ? validTimestamp(task.workStartedAt) : null,
    completedAt: status === "completed" ? validTimestamp(task.completedAt) : null
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function textOr(value, fallback) {
  return typeof value === "string" && value.trim() ? value : fallback;
}
