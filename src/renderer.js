import { createProject, createTask, normalizeProjects } from "./models.js";

const elements = {
  projectForm: document.querySelector("#project-form"),
  projectInput: document.querySelector("#project-input"),
  projectList: document.querySelector("#project-list"),
  projectTitle: document.querySelector("#project-title"),
  deleteProject: document.querySelector("#delete-project"),
  taskForm: document.querySelector("#task-form"),
  taskInput: document.querySelector("#task-input"),
  addTask: document.querySelector("#add-task"),
  taskList: document.querySelector("#task-list"),
  details: document.querySelector("#details"),
  detailsEmpty: document.querySelector("#details-empty"),
  taskTitle: document.querySelector("#task-title"),
  taskCompleted: document.querySelector("#task-completed"),
  taskComment: document.querySelector("#task-comment"),
  deleteTask: document.querySelector("#delete-task"),
  saveStatus: document.querySelector("#save-status"),
  confirmDialog: document.querySelector("#confirm-dialog"),
  confirmTitle: document.querySelector("#confirm-title"),
  confirmMessage: document.querySelector("#confirm-message"),
  themeToggle: document.querySelector("#theme-toggle")
};

const state = { projects: [], selectedProjectId: null, selectedTaskId: null, saveTimer: null };

const selectedProject = () => state.projects.find((project) => project.id === state.selectedProjectId) ?? null;
const selectedTask = () => selectedProject()?.tasks.find((task) => task.id === state.selectedTaskId) ?? null;

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = theme;
  elements.themeToggle.querySelector("span").textContent = isDark ? "☀️" : "🌙";
  const label = isDark ? "Включить светлую тему" : "Включить тёмную тему";
  elements.themeToggle.setAttribute("aria-label", label);
  elements.themeToggle.title = label;
}

function initialTheme() {
  const saved = localStorage.getItem("projectTasks.theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function textSpan(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function renderProjects() {
  elements.projectList.replaceChildren(...state.projects.map((project) => {
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
  renderProjects();
  renderTasks();
  renderDetails();
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
  elements.saveStatus.classList.remove("error");
  state.saveTimer = setTimeout(async () => {
    try {
      await window.projectTasks.save(state.projects);
      elements.saveStatus.textContent = "Все изменения сохранены";
    } catch (error) {
      elements.saveStatus.textContent = "Не удалось сохранить изменения";
      elements.saveStatus.classList.add("error");
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

elements.projectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.projectInput.value.trim();
  if (!name) return;
  const project = createProject(name);
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
  const index = state.projects.indexOf(project);
  state.projects.splice(index, 1);
  state.selectedProjectId = state.projects[Math.min(index, state.projects.length - 1)]?.id ?? null;
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

elements.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("projectTasks.theme", nextTheme);
  applyTheme(nextTheme);
});

async function initialize() {
  applyTheme(initialTheme());
  state.projects = normalizeProjects(await window.projectTasks.load());
  state.selectedProjectId = state.projects[0]?.id ?? null;
  state.selectedTaskId = state.projects[0]?.tasks[0]?.id ?? null;
  render();
}

initialize().catch((error) => {
  console.error(error);
  elements.projectTitle.textContent = "Не удалось загрузить данные";
});
