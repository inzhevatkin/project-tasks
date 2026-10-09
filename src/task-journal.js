import { localDateKey } from "./calendar.js";

export const TASK_STATUSES = ["pending", "in_progress", "completed"];
export const MAX_WORKING_TASKS = 3;
export const JOURNAL_ACTIONS = ["created", "started", "paused", "completed", "reopened", "deleted"];

export function taskStatus(task) {
  return TASK_STATUSES.includes(task.status) ? task.status : task.completed === true ? "completed" : "pending";
}

export function validTimestamp(value) {
  return typeof value === "string" && value.trim() && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString() : null;
}

export function recordTaskEvent(workspace, project, task, action, at = new Date().toISOString()) {
  const type = workspace.projectTypes.find((item) => item.id === project.typeId);
  const entry = {
    id: crypto.randomUUID(), action, at,
    taskId: task.id, taskTitle: task.title,
    projectId: project.id, projectName: project.name,
    typeId: project.typeId, typeName: type?.name ?? ""
  };
  workspace.taskJournal.push(entry);
  return entry;
}

export function workingTasks(workspace) {
  return workspace.projects.flatMap((project) => project.tasks
    .filter((task) => taskStatus(task) === "in_progress").map((task) => ({ project, task })));
}

// Starting another task never stops existing work. Reject excess starts before
// changing timestamps or recording journal entries.
export function changeTaskStatus(workspace, project, task, status, at = new Date().toISOString()) {
  if (!TASK_STATUSES.includes(status) || !workspace.projects.includes(project) || !project.tasks.includes(task)) return false;
  const previous = taskStatus(task);
  if (previous === status) return false;
  if (status === "in_progress" && workingTasks(workspace).length >= MAX_WORKING_TASKS) return false;
  if (previous === "completed") recordTaskEvent(workspace, project, task, "reopened", at);
  if (status === "in_progress") recordTaskEvent(workspace, project, task, "started", at);
  else if (status === "completed") recordTaskEvent(workspace, project, task, "completed", at);
  else if (previous === "in_progress") recordTaskEvent(workspace, project, task, "paused", at);
  task.status = status;
  task.completed = status === "completed";
  task.workStartedAt = status === "in_progress" ? at : null;
  task.completedAt = status === "completed" ? at : null;
  return true;
}

export function recordTaskDeletion(workspace, project, task, at = new Date().toISOString()) {
  if (taskStatus(task) === "in_progress") changeTaskStatus(workspace, project, task, "pending", at);
  recordTaskEvent(workspace, project, task, "deleted", at);
}

export function normalizeTaskJournal(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.filter((entry) => entry && typeof entry === "object"
    && JOURNAL_ACTIONS.includes(entry.action) && validTimestamp(entry.at)
    && typeof entry.taskId === "string" && typeof entry.projectId === "string")
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : crypto.randomUUID(),
      action: entry.action, at: validTimestamp(entry.at),
      taskId: entry.taskId, taskTitle: typeof entry.taskTitle === "string" ? entry.taskTitle : "Без названия",
      projectId: entry.projectId, projectName: typeof entry.projectName === "string" ? entry.projectName : "Без названия",
      typeId: typeof entry.typeId === "string" ? entry.typeId : "",
      typeName: typeof entry.typeName === "string" ? entry.typeName : "",
      ...(entry.imported === true ? { imported: true } : {})
    })).filter((entry) => {
      if (seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    });
}

// Use IDs to keep renamed projects together and distinguish matching names.
// Historical snapshots also make deleted projects available in the filter.
export function journalTypes(entries, projectTypes) {
  const choices = new Map();
  const latest = new Map();
  for (const entry of entries) {
    if (entry.typeId && (!latest.has(entry.typeId) || entry.at >= latest.get(entry.typeId))) {
      latest.set(entry.typeId, entry.at);
      choices.set(entry.typeId, { id: entry.typeId, name: entry.typeName, deleted: true });
    }
  }
  for (const type of projectTypes) choices.set(type.id, { ...type, deleted: false });
  return [...choices.values()];
}

export function journalProjects(entries, projects, projectTypes, typeId = "") {
  const choices = new Map();
  const latest = new Map();
  for (const entry of entries) {
    if (!latest.has(entry.projectId) || entry.at >= latest.get(entry.projectId)) {
      latest.set(entry.projectId, entry.at);
      choices.set(entry.projectId, {
        id: entry.projectId, name: entry.projectName,
        typeId: entry.typeId, typeName: entry.typeName, deleted: true
      });
    }
  }
  const types = new Map(projectTypes.map((type) => [type.id, type.name]));
  for (const project of projects) {
    choices.set(project.id, {
      id: project.id, name: project.name, typeId: project.typeId,
      typeName: types.get(project.typeId) ?? "", deleted: false
    });
  }
  return [...choices.values()].filter((project) => !typeId || project.typeId === typeId);
}

export function journalTasks(entries, projects, projectId = "", typeId = "") {
  const choices = new Map();
  const latest = new Map();
  const currentProjects = new Map(projects.map((project) => [project.id, project]));
  const projectChoices = new Map(journalProjects(entries, projects, []).map((project) => [project.id, project]));
  for (const entry of entries) {
    const key = JSON.stringify([entry.projectId, entry.taskId]);
    if (!latest.has(key) || entry.at >= latest.get(key)) {
      latest.set(key, entry.at);
      choices.set(key, {
        key, id: entry.taskId, title: entry.taskTitle, projectId: entry.projectId,
        projectName: currentProjects.get(entry.projectId)?.name ?? entry.projectName,
        typeId: projectChoices.get(entry.projectId)?.typeId ?? entry.typeId, deleted: true
      });
    }
  }
  for (const project of projects) {
    for (const task of project.tasks) {
      const key = JSON.stringify([project.id, task.id]);
      choices.set(key, {
        key, id: task.id, title: task.title, projectId: project.id,
        projectName: project.name, typeId: project.typeId, deleted: false
      });
    }
  }
  return [...choices.values()].filter((task) => (!projectId || task.projectId === projectId)
    && (!typeId || task.typeId === typeId));
}

export function filterTaskJournal(entries, { from = "", to = "", query = "", typeId = "", projectId = "", taskId = "" } = {}) {
  const search = query.trim().toLocaleLowerCase();
  return entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
    const day = localDateKey(new Date(entry.at));
    const content = `${entry.taskTitle} ${entry.projectName} ${entry.typeName}`.toLocaleLowerCase();
    return (!typeId || entry.typeId === typeId)
      && (!projectId || entry.projectId === projectId)
      && (!taskId || entry.taskId === taskId)
      && (!from || day >= from) && (!to || day <= to) && (!search || content.includes(search));
  }).sort((a, b) => b.entry.at.localeCompare(a.entry.at) || b.index - a.index).map(({ entry }) => entry);
}
