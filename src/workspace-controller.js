import { createProject, createProjectType, createTask, normalizeWorkspace } from "./models.js";
import { textSpan } from "./ui/dom.js";

export function createWorkspaceController(elements) {
  const state = {
    projectTypes: [], projects: [], calendarEvents: [], selectedTypeId: null,
    selectedProjectId: null, selectedTaskId: null, saveTimer: null
  };
  const selectedType = () => state.projectTypes.find((type) => type.id === state.selectedTypeId) ?? null;
  const projectsForSelectedType = () => state.projects.filter((project) => project.typeId === state.selectedTypeId);
  const selectedProject = () => state.projects.find((project) => project.id === state.selectedProjectId) ?? null;
  const selectedTask = () => selectedProject()?.tasks.find((task) => task.id === state.selectedTaskId) ?? null;

  function renderTypes() {
    elements.typeList.replaceChildren(...state.projectTypes.map((type) => {
      const count = state.projects.filter((project) => project.typeId === type.id).length;
      const button = document.createElement("button");
      button.type = "button";
      button.className = `type-item${type.id === state.selectedTypeId ? " selected" : ""}`;
      button.dataset.typeId = type.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(type.id === state.selectedTypeId));
      button.append(textSpan(type.name, "type-name"), textSpan(String(count), "type-count"));
      return button;
    }));
    elements.typeTitle.textContent = selectedType()?.name ?? "Выберите раздел";
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
      button.append(textSpan(project.name, "item-title"), textSpan(`${project.tasks.length} задач`, "item-meta"));
      return button;
    }));
    elements.deleteProject.disabled = !selectedProject();
  }

  function renderTasks() {
    const project = selectedProject();
    elements.projectTitle.textContent = project?.name ?? "Выберите проект";
    elements.taskInput.disabled = !project;
    elements.addTask.disabled = !project;
    elements.taskList.replaceChildren(...(project?.tasks ?? []).map((task) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `list-item task-item${task.completed ? " completed" : ""}${task.id === state.selectedTaskId ? " selected" : ""}`;
      button.dataset.id = task.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", String(task.id === state.selectedTaskId));
      button.append(
        textSpan(task.completed ? "✓" : "○", "task-state"),
        textSpan(task.title, "item-title"),
        textSpan(task.comment.trim() ? "Комментарий" : "", "note-badge")
      );
      return button;
    }));
  }

  function renderDetails() {
    const task = selectedTask();
    elements.details.hidden = !task;
    elements.detailsEmpty.hidden = Boolean(task);
    if (!task) return;
    if (document.activeElement !== elements.taskTitle) elements.taskTitle.value = task.title;
    if (document.activeElement !== elements.taskComment) elements.taskComment.value = task.comment;
    elements.taskCompleted.checked = task.completed;
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
    elements.saveStatus.textContent = "Сохранение…";
    elements.calendarSaveStatus.textContent = "Сохранение…";
    elements.saveStatus.classList.remove("error");
    elements.calendarSaveStatus.classList.remove("error");
    state.saveTimer = setTimeout(async () => {
      try {
        await window.projectTasks.save({
          version: 3, projectTypes: state.projectTypes, projects: state.projects,
          calendarEvents: state.calendarEvents
        });
        elements.saveStatus.textContent = "Все изменения сохранены";
        elements.calendarSaveStatus.textContent = "Все изменения сохранены";
      } catch (error) {
        elements.saveStatus.textContent = "Не удалось сохранить изменения";
        elements.calendarSaveStatus.textContent = "Не удалось сохранить изменения";
        elements.saveStatus.classList.add("error");
        elements.calendarSaveStatus.classList.add("error");
        console.error(error);
      }
    }, 300);
  }

  function askToDelete(title, message) {
    elements.confirmTitle.textContent = title;
    elements.confirmMessage.textContent = message;
    elements.confirmDialog.showModal();
    return new Promise((resolve) => {
      elements.confirmDialog.addEventListener("close", () => resolve(elements.confirmDialog.returnValue === "confirm"), { once: true });
    });
  }

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

  elements.typeList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-type-id]");
    if (item) selectType(item.dataset.typeId);
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

  elements.projectList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (item) selectProject(item.dataset.id);
  });

  elements.deleteProject.addEventListener("click", async () => {
    const project = selectedProject();
    if (!project || !await askToDelete("Удалить проект?", `Проект «${project.name}» и все его задачи будут удалены.`)) return;
    const visibleIndex = projectsForSelectedType().indexOf(project);
    state.projects.splice(state.projects.indexOf(project), 1);
    const remaining = projectsForSelectedType();
    state.selectedProjectId = remaining[Math.min(visibleIndex, remaining.length - 1)]?.id ?? null;
    state.selectedTaskId = selectedProject()?.tasks[0]?.id ?? null;
    render();
    scheduleSave();
  });

  elements.taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const project = selectedProject();
    const title = elements.taskInput.value.trim();
    if (!project || !title) return;
    const task = createTask(title);
    project.tasks.push(task);
    state.selectedTaskId = task.id;
    elements.taskInput.value = "";
    render();
    scheduleSave();
  });

  elements.taskList.addEventListener("click", (event) => {
    const item = event.target.closest("[data-id]");
    if (item) selectTask(item.dataset.id);
  });

  elements.taskList.addEventListener("dblclick", (event) => {
    const item = event.target.closest("[data-id]");
    const task = selectedProject()?.tasks.find((candidate) => candidate.id === item?.dataset.id);
    if (!task) return;
    task.completed = !task.completed;
    state.selectedTaskId = task.id;
    render();
    scheduleSave();
  });

  elements.taskTitle.addEventListener("input", () => {
    const task = selectedTask();
    if (!task) return;
    task.title = elements.taskTitle.value;
    renderProjects();
    renderTasks();
    scheduleSave();
  });

  elements.taskCompleted.addEventListener("change", () => {
    const task = selectedTask();
    if (!task) return;
    task.completed = elements.taskCompleted.checked;
    renderTasks();
    scheduleSave();
  });

  elements.taskComment.addEventListener("input", () => {
    const task = selectedTask();
    if (!task) return;
    task.comment = elements.taskComment.value;
    renderTasks();
    scheduleSave();
  });

  elements.deleteTask.addEventListener("click", async () => {
    const project = selectedProject();
    const task = selectedTask();
    if (!project || !task || !await askToDelete("Удалить задачу?", `Задача «${task.title}» будет удалена.`)) return;
    const index = project.tasks.indexOf(task);
    project.tasks.splice(index, 1);
    state.selectedTaskId = project.tasks[Math.min(index, project.tasks.length - 1)]?.id ?? null;
    render();
    scheduleSave();
  });


  async function initialize() {
    const stored = await window.projectTasks.load();
    const workspace = normalizeWorkspace(stored);
    state.projectTypes = workspace.projectTypes;
    state.projects = workspace.projects;
    state.calendarEvents = workspace.calendarEvents;
    state.selectedTypeId = state.projectTypes[0]?.id ?? null;
    state.selectedProjectId = projectsForSelectedType()[0]?.id ?? null;
    state.selectedTaskId = selectedProject()?.tasks[0]?.id ?? null;
    render();
    if (Array.isArray(stored)) await window.projectTasks.save(workspace);

  }
  return {
    initialize,
    getCalendarEvents: () => state.calendarEvents,
    setCalendarEvents(events) { state.calendarEvents = events; scheduleSave(); },
    confirmDeletion: askToDelete
  };
}
