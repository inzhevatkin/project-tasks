import { createProject, createProjectType, createTask, itemName, normalizeWorkspace } from "./models.js";
import { textSpan } from "./ui/dom.js";
import { t } from "./i18n.js";
import { applyCommentCommand, renderCommentEditor, serializeCommentEditor } from "./comment-format.js";
import { changeTaskStatus, recordTaskDeletion, recordTaskEvent, taskStatus, workingTask } from "./task-journal.js";

export function createWorkspaceController(elements) {
  const state = {
    projectTypes: [], projects: [], calendarEvents: [], taskJournal: [], journalStartedAt: null, selectedTypeId: null,
    selectedProjectId: null, selectedTaskId: null, saveTimer: null, lastListClick: null
  };
  const selectedType = () => state.projectTypes.find((type) => type.id === state.selectedTypeId) ?? null;
  const projectsForSelectedType = () => state.projects.filter((project) => project.typeId === state.selectedTypeId);
  const selectedProject = () => state.projects.find((project) => project.id === state.selectedProjectId) ?? null;
  const selectedTask = () => selectedProject()?.tasks.find((task) => task.id === state.selectedTaskId) ?? null;
  const displayTypeName = (type) => type.id === "work" && type.name === "Работа" ? t("Работа") : type.name;
  const displayName = (name) => name === "Без названия" ? t(name) : name;
  const journalListeners = new Set();
  const notifyJournal = () => journalListeners.forEach((listener) => listener());
  const statusLabels = { pending: "К выполнению", in_progress: "В работе", completed: "Выполнена" };

  function renderTypes() {
    elements.typeList.replaceChildren(...state.projectTypes.map((type) => {
      const count = state.projects.filter((project) => project.typeId === type.id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `type-item${type.id === state.selectedTypeId ? " selected" : ""}`;
      button.dataset.typeId = type.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(type.id === state.selectedTypeId));
      button.title = t("Дважды щёлкните, чтобы переименовать раздел");
      button.append(textSpan(displayTypeName(type), "type-name"), textSpan(String(count), "type-count"));
      return button;
    }));
    elements.typeTitle.textContent = selectedType() ? displayTypeName(selectedType()) : t("Выберите раздел");
    elements.projectInput.disabled = !selectedType();
  }

  function renderProjects() {
    elements.projectList.replaceChildren(...projectsForSelectedType().map((project) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `list-item${project.id === state.selectedProjectId ? " selected" : ""}`;
      button.dataset.id = project.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(project.id === state.selectedProjectId));
      button.title = t("Дважды щёлкните, чтобы переименовать проект");
      button.append(textSpan(displayName(project.name), "item-title"), textSpan(t("{count} задач", { count: project.tasks.length }), "item-meta"));
      return button;
    }));
    elements.deleteProject.disabled = !selectedProject();
  }

  function renderTasks() {
    const project = selectedProject();
    elements.projectTitle.textContent = project ? displayName(project.name) : t("Выберите проект");
    elements.taskInput.disabled = !project;
    elements.addTask.disabled = !project;
    elements.taskList.replaceChildren(...(project?.tasks ?? []).map((task) => {
      const status = taskStatus(task);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `list-item task-item${status === "completed" ? " completed" : ""}${status === "in_progress" ? " in-progress" : ""}${task.id === state.selectedTaskId ? " selected" : ""}`;
      button.dataset.id = task.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(task.id === state.selectedTaskId));
      button.setAttribute("aria-label", `${displayName(task.title)} · ${t(statusLabels[status])}`);
      button.title = t("Дважды щёлкните, чтобы переименовать задачу");
      button.append(
        textSpan(status === "completed" ? "✓" : status === "in_progress" ? "▶" : "○", "task-state"),
        textSpan(displayName(task.title), "item-title"),
        textSpan(task.comment.trim() ? t("Комментарий") : "", "note-badge")
      );
      if (status === "in_progress") button.append(textSpan(t("В работе"), "task-status-badge"));
      return button;
    }));
  }

  function renderDetails() {
    const task = selectedTask();
    elements.details.hidden = !task;
    elements.detailsEmpty.hidden = Boolean(task);
    if (!task) return;
    if (document.activeElement !== elements.taskTitle) elements.taskTitle.value = task.title;
    renderCommentEditor(elements.taskComment, task.comment);
    elements.taskStatus.value = taskStatus(task);
  }

  function render() {
    renderTypes();
    renderProjects();
    renderTasks();
    renderDetails();
  }

  function selectType(id) {
    state.selectedTypeId = id;
    state.selectedProjectId = projectsForSelectedType()[0]?.id ?? null;
    state.selectedTaskId = selectedProject()?.tasks[0]?.id ?? null;
    render();
  }

  function selectProject(id) {
    state.selectedProjectId = id;
    state.selectedTaskId = selectedProject()?.tasks[0]?.id ?? null;
    render();
  }

  function selectTask(id) {
    state.selectedTaskId = id;
    render();
  }

  function scheduleSave() {
    clearTimeout(state.saveTimer);
    elements.saveStatus.textContent = t("Сохранение…");
    elements.calendarSaveStatus.textContent = t("Сохранение…");
    elements.journalSaveStatus.textContent = t("Сохранение…");
    elements.saveStatus.classList.remove("error");
    elements.calendarSaveStatus.classList.remove("error");
    elements.journalSaveStatus.classList.remove("error");
    state.saveTimer = setTimeout(async () => {
      state.saveTimer = null;
      try {
        await window.projectTasks.save(snapshot());
        elements.saveStatus.textContent = t("Все изменения сохранены");
        elements.calendarSaveStatus.textContent = t("Все изменения сохранены");
        elements.journalSaveStatus.textContent = t("Все изменения сохранены");
      } catch (error) {
        elements.saveStatus.textContent = t("Не удалось сохранить изменения");
        elements.calendarSaveStatus.textContent = t("Не удалось сохранить изменения");
        elements.journalSaveStatus.textContent = t("Не удалось сохранить изменения");
        elements.saveStatus.classList.add("error");
        elements.calendarSaveStatus.classList.add("error");
        elements.journalSaveStatus.classList.add("error");
        console.error(error);
      }
    }, 300);
  }

  function snapshot() {
    return {
      version: 4, projectTypes: state.projectTypes, projects: state.projects,
      calendarEvents: state.calendarEvents, taskJournal: state.taskJournal,
      journalStartedAt: state.journalStartedAt
    };
  }

  async function flushSave() {
    clearTimeout(state.saveTimer);
    state.saveTimer = null;
    try {
      await window.projectTasks.save(snapshot());
      for (const element of [elements.saveStatus, elements.calendarSaveStatus, elements.journalSaveStatus]) {
        element.textContent = t("Все изменения сохранены");
        element.classList.remove("error");
      }
    } catch (error) {
      for (const element of [elements.saveStatus, elements.calendarSaveStatus, elements.journalSaveStatus]) {
        element.textContent = t("Не удалось сохранить изменения");
        element.classList.add("error");
      }
      throw error;
    }
  }

  function askToDelete(title, message) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    elements.confirmDialog.showModal();
    return new Promise((resolve) => {
      elements.confirmDialog.addEventListener("close", () => resolve(elements.confirmDialog.returnValue === "confirm"), { once: true });
    });
  }

  function askToRename(title, currentName) {
    elements.renameTitle.textContent = title;
    elements.renameInput.value = currentName;
    elements.renameDialog.returnValue = "";
    elements.renameDialog.showModal();
    elements.renameInput.focus();
    elements.renameInput.select();
    return new Promise((resolve) => {
      elements.renameDialog.addEventListener("close", () => {
        const name = itemName(elements.renameInput.value);
        resolve(elements.renameDialog.returnValue === "confirm" ? name : null);
      }, { once: true });
    });
  }

  function isSecondClick(kind, id, event) {
    if (event.detail === 0) return false;
    const clickedAt = Date.now();
    const previous = state.lastListClick;
    const second = event.detail >= 2 || (previous?.kind === kind && previous.id === id && clickedAt - previous.clickedAt <= 800);
    state.lastListClick = second ? null : { kind, id, clickedAt };
    return second;
  }

  elements.renameCancel.addEventListener("click", () => elements.renameDialog.close("cancel"));

  elements.typeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.typeInput.value.trim();
    if (!name) return;
    const type = createProjectType(name);
    state.projectTypes.push(type);
    elements.typeInput.value = "";
    selectType(type.id);
    scheduleSave();
  });

  elements.typeList.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-type-id]");
    const type = state.projectTypes.find((candidate) => candidate.id === item?.dataset.typeId);
    if (!type) return;
    if (!isSecondClick("type", type.id, event)) {
      selectType(type.id);
      return;
    }
    const name = await askToRename(t("Переименовать раздел"), displayTypeName(type));
    if (!name || name === type.name) return;
    type.name = name;
    render();
    notifyJournal();
    scheduleSave();
  });

  elements.projectForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.projectInput.value.trim();
    const type = selectedType();
    if (!name || !type) return;
    const project = createProject(name, type.id);
    state.projects.push(project);
    elements.projectInput.value = "";
    selectProject(project.id);
    scheduleSave();
  });

  elements.projectList.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-id]");
    const project = state.projects.find((candidate) => candidate.id === item?.dataset.id);
    if (!project) return;
    if (!isSecondClick("project", project.id, event)) {
      selectProject(project.id);
      return;
    }
    const name = await askToRename(t("Переименовать проект"), project.name);
    if (!name || name === project.name) return;
    project.name = name;
    render();
    notifyJournal();
    scheduleSave();
  });

  elements.deleteProject.addEventListener("click", async () => {
    const project = selectedProject();
    if (!project || !await askToDelete(t("Удалить проект?"), t("Проект «{name}» и все его задачи будут удалены.", { name: project.name }))) return;
    const visibleIndex = projectsForSelectedType().indexOf(project);
    const deletedAt = new Date().toISOString();
    for (const task of project.tasks) recordTaskDeletion(state, project, task, deletedAt);
    state.projects.splice(state.projects.indexOf(project), 1);
    const remaining = projectsForSelectedType();
    state.selectedProjectId = remaining[Math.min(visibleIndex, remaining.length - 1)]?.id ?? null;
    state.selectedTaskId = selectedProject()?.tasks[0]?.id ?? null;
    render();
    notifyJournal();
    scheduleSave();
  });

  elements.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const project = selectedProject();
    const title = elements.taskInput.value.trim();
    if (!project || !title) return;
    const task = createTask(title);
    project.tasks.push(task);
    recordTaskEvent(state, project, task, "created", task.createdAt);
    state.selectedTaskId = task.id;
    elements.taskInput.value = "";
    render();
    notifyJournal();
    scheduleSave();
  });

  elements.taskList.addEventListener("click", async (event) => {
    const item = event.target.closest("[data-id]");
    const task = selectedProject()?.tasks.find((candidate) => candidate.id === item?.dataset.id);
    if (!task) return;
    if (!isSecondClick("task", task.id, event)) {
      selectTask(task.id);
      return;
    }
    const title = await askToRename(t("Переименовать задачу"), task.title);
    if (!title || title === task.title) return;
    task.title = title;
    state.selectedTaskId = task.id;
    render();
    notifyJournal();
    scheduleSave();
  });

  elements.taskTitle.addEventListener("input", () => {
    const task = selectedTask();
    if (!task) return;
    task.title = elements.taskTitle.value;
    renderProjects();
    renderTasks();
    notifyJournal();
    scheduleSave();
  });

  elements.taskStatus.addEventListener("change", () => {
    const task = selectedTask();
    const project = selectedProject();
    if (!task || !changeTaskStatus(state, project, task, elements.taskStatus.value)) return;
    renderTasks();
    notifyJournal();
    scheduleSave();
  });

  function saveComment() {
    const task = selectedTask();
    if (!task) return;
    const value = serializeCommentEditor(elements.taskComment);
    if (value === task.comment) return;
    task.comment = value;
    renderTasks();
    scheduleSave();
  }

  elements.commentToolbar.addEventListener("mousedown", (event) => {
    if (event.target.closest("[data-comment-format]")) event.preventDefault();
  });
  elements.commentToolbar.addEventListener("click", (event) => {
    const button = event.target.closest("[data-comment-format]");
    if (!button || !selectedTask()) return;
    applyCommentCommand(elements.taskComment, button.dataset.commentFormat);
    saveComment();
  });
  elements.taskComment.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const format = { b: "bold", i: "italic" }[event.key.toLowerCase()];
    if (!format) return;
    event.preventDefault();
    applyCommentCommand(elements.taskComment, format);
    saveComment();
  });
  elements.taskComment.addEventListener("paste", (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") ?? "");
  });
  elements.taskComment.addEventListener("drop", (event) => event.preventDefault());
  elements.taskComment.addEventListener("input", saveComment);

  elements.deleteTask.addEventListener("click", async () => {
    const project = selectedProject();
    const task = selectedTask();
    if (!project || !task || !await askToDelete(t("Удалить задачу?"), t("Задача «{name}» будет удалена.", { name: task.title }))) return;
    const index = project.tasks.indexOf(task);
    recordTaskDeletion(state, project, task);
    project.tasks.splice(index, 1);
    state.selectedTaskId = project.tasks[Math.min(index, project.tasks.length - 1)]?.id ?? null;
    render();
    notifyJournal();
    scheduleSave();
  });


  async function initialize() {
    const stored = await window.projectTasks.load();
    const workspace = normalizeWorkspace(stored);
    state.projectTypes = workspace.projectTypes;
    state.projects = workspace.projects;
    state.calendarEvents = workspace.calendarEvents;
    state.taskJournal = workspace.taskJournal;
    state.journalStartedAt = workspace.journalStartedAt;
    state.selectedTypeId = state.projectTypes[0]?.id ?? null;
    state.selectedProjectId = projectsForSelectedType()[0]?.id ?? null;
    state.selectedTaskId = selectedProject()?.tasks[0]?.id ?? null;
    render();
    notifyJournal();
    if (Array.isArray(stored) || stored?.version !== 4 || !Array.isArray(stored?.taskJournal)) {
      await window.projectTasks.save(workspace);
    }

  }
  return {
    initialize,
    flushSave,
    getTaskJournal: () => state.taskJournal,
    getJournalStartedAt: () => state.journalStartedAt,
    getWorkingTask: () => workingTask(state),
    subscribeJournal(listener) { journalListeners.add(listener); return () => journalListeners.delete(listener); },
    openTask(projectId, taskId) {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project?.tasks.some((task) => task.id === taskId)) return false;
      state.selectedTypeId = project.typeId;
      state.selectedProjectId = projectId;
      state.selectedTaskId = taskId;
      render();
      return true;
    },
    hasTask: (projectId, taskId) => state.projects.some((project) => project.id === projectId && project.tasks.some((task) => task.id === taskId)),
    stopWorking() {
      const current = workingTask(state);
      if (!current) return;
      changeTaskStatus(state, current.project, current.task, "pending");
      renderTasks();
      renderDetails();
      notifyJournal();
      scheduleSave();
    },
    getCalendarEvents: () => state.calendarEvents,
    setCalendarEvents(events) { state.calendarEvents = events; scheduleSave(); },
    confirmDeletion: askToDelete
  };
}
