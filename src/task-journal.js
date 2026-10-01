import { localDateKey } from "./calendar.js";

export const TASK_STATUSES = ["pending", "in_progress", "completed"];
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

export function workingTask(workspace) {
  for (const project of workspace.projects) {
    const task = project.tasks.find((item) => taskStatus(item) === "in_progress");
    if (task) return { project, task };
  }
  return null;
}

// One task can be marked as the current work. Merely selecting a task does not
// change its state or create an entry in the diary.
export function changeTaskStatus(workspace, project, task, status, at = new Date().toISOString()) {
  if (!TASK_STATUSES.includes(status) || !project.tasks.includes(task)) return false;
  const previous = taskStatus(task);
  if (previous === status) return false;
  if (status === "in_progress") {
    for (const otherProject of workspace.projects) {
      for (const otherTask of otherProject.tasks) {
        if (otherTask !== task && taskStatus(otherTask) === "in_progress") {
          changeTaskStatus(workspace, otherProject, otherTask, "pending", at);
        }
      }
    }
  }
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

export function filterTaskJournal(entries, { from = "", to = "", query = "" } = {}) {
  const search = query.trim().toLocaleLowerCase();
  return entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
    const day = localDateKey(new Date(entry.at));
    const content = `${entry.taskTitle} ${entry.projectName} ${entry.typeName}`.toLocaleLowerCase();
    return (!from || day >= from) && (!to || day <= to) && (!search || content.includes(search));
  }).sort((a, b) => b.entry.at.localeCompare(a.entry.at) || b.index - a.index).map(({ entry }) => entry);
}
