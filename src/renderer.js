import { createProject, createProjectType, createTask, normalizeWorkspace } from "./models.js";
import { POMODORO_PHASES, durationFor, formatTime, nextPomodoroPhase, shouldAutoStartAfter, skippedPomodoroPhase } from "./pomodoro.js";
import { createPomodoroRun, finishPomodoroRun, focusCountsForLastDays, normalizePomodoroHistory, summarizePomodoro } from "./statistics.js";

const elements = {
  typeForm: document.querySelector("#type-form"),
  typeInput: document.querySelector("#type-input"),
  typeList: document.querySelector("#type-list"),
  typeTitle: document.querySelector("#type-title"),
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
  themeToggle: document.querySelector("#theme-toggle"),
  pomodoroPhase: document.querySelector("#pomodoro-phase"),
  pomodoroTime: document.querySelector("#pomodoro-time"),
  pomodoroRounds: document.querySelector("#pomodoro-rounds"),
  pomodoroToggle: document.querySelector("#pomodoro-toggle"),
  pomodoroReset: document.querySelector("#pomodoro-reset"),
  pomodoroSkip: document.querySelector("#pomodoro-skip"),
  showTasks: document.querySelector("#show-tasks"),
  showStatistics: document.querySelector("#show-statistics"),
  tasksPage: document.querySelector("#tasks-page"),
  statisticsPage: document.querySelector("#statistics-page"),
  statToday: document.querySelector("#stat-today"),
  statLaunches: document.querySelector("#stat-launches"),
  statMinutes: document.querySelector("#stat-minutes"),
  statCompleted: document.querySelector("#stat-completed"),
  weeklyChart: document.querySelector("#weekly-chart"),
  pomodoroHistory: document.querySelector("#pomodoro-history")
};

const state = {
  projectTypes: [], projects: [], selectedTypeId: null,
  selectedProjectId: null, selectedTaskId: null, saveTimer: null
};
const POMODORO_STORAGE_KEY = "projectTasks.pomodoro";
const POMODORO_HISTORY_KEY = "projectTasks.pomodoroHistory";
let pomodoroHistory = restorePomodoroHistory();
let pomodoro = restorePomodoro();
let pomodoroInterval = null;
let audioContext = null;

const selectedType = () => state.projectTypes.find((type) => type.id === state.selectedTypeId) ?? null;
const projectsForSelectedType = () => state.projects.filter((project) => project.typeId === state.selectedTypeId);
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

function restorePomodoro() {
  const fallback = {
    phase: "focus", secondsRemaining: durationFor("focus"),
    completedFocusSessions: 0, running: false, deadline: null, activeRunId: null
  };
  try {
    const saved = JSON.parse(localStorage.getItem(POMODORO_STORAGE_KEY));
    if (!saved || !POMODORO_PHASES[saved.phase]) return fallback;
    const completed = Number.isInteger(saved.completedFocusSessions) && saved.completedFocusSessions >= 0
      ? saved.completedFocusSessions : 0;
    if (saved.running && Number.isFinite(saved.deadline)) {
      const remaining = Math.ceil((saved.deadline - Date.now()) / 1000);
      if (remaining > 0) {
        return {
          phase: saved.phase, secondsRemaining: remaining, completedFocusSessions: completed,
          running: true, deadline: saved.deadline,
          activeRunId: typeof saved.activeRunId === "string" ? saved.activeRunId : null
        };
      }
      return {
        phase: saved.phase, secondsRemaining: 0, completedFocusSessions: completed,
        running: true, deadline: saved.deadline,
        activeRunId: typeof saved.activeRunId === "string" ? saved.activeRunId : null
      };
    }
    const maximum = durationFor(saved.phase);
    const remaining = Number.isFinite(saved.secondsRemaining)
      ? Math.min(maximum, Math.max(1, Math.ceil(saved.secondsRemaining))) : maximum;
    return {
      phase: saved.phase, secondsRemaining: remaining, completedFocusSessions: completed,
      running: false, deadline: null,
      activeRunId: typeof saved.activeRunId === "string" ? saved.activeRunId : null
    };
  } catch {
    return fallback;
  }
}

function restorePomodoroHistory() {
  try {
    return normalizePomodoroHistory(JSON.parse(localStorage.getItem(POMODORO_HISTORY_KEY)));
  } catch {
    return [];
  }
}

function persistPomodoro() {
  localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(pomodoro));
}

function persistPomodoroHistory() {
  pomodoroHistory = pomodoroHistory.slice(-2000);
  localStorage.setItem(POMODORO_HISTORY_KEY, JSON.stringify(pomodoroHistory));
}

function ensureActiveRun() {
  if (pomodoro.activeRunId && pomodoroHistory.some((run) => run.id === pomodoro.activeRunId && run.outcome === "active")) return;
  const elapsedSeconds = Math.max(0, durationFor(pomodoro.phase) - pomodoro.secondsRemaining);
  const startedAt = new Date(Date.now() - elapsedSeconds * 1000).toISOString();
  const run = createPomodoroRun(pomodoro.phase, startedAt);
  pomodoroHistory.push(run);
  pomodoro.activeRunId = run.id;
  persistPomodoroHistory();
  persistPomodoro();
}

function finishActiveRun(outcome) {
  const index = pomodoroHistory.findIndex((run) => run.id === pomodoro.activeRunId && run.outcome === "active");
  if (index >= 0) {
    pomodoroHistory[index] = finishPomodoroRun(pomodoroHistory[index], outcome, pomodoro.secondsRemaining);
    persistPomodoroHistory();
  }
  pomodoro.activeRunId = null;
}

function completedRoundsInCycle() {
  const remainder = pomodoro.completedFocusSessions % 4;
  return pomodoro.phase === "longBreak" && remainder === 0 && pomodoro.completedFocusSessions > 0 ? 4 : remainder;
}

function renderPomodoro() {
  const phase = POMODORO_PHASES[pomodoro.phase];
  const formatted = formatTime(pomodoro.secondsRemaining);
  elements.pomodoroPhase.textContent = phase.label;
  elements.pomodoroTime.textContent = formatted;
  elements.pomodoroTime.dateTime = `PT${pomodoro.secondsRemaining}S`;
  elements.pomodoroToggle.textContent = pomodoro.running ? "Пауза" : "Старт";
  elements.pomodoroRounds.replaceChildren(...Array.from({ length: 4 }, (_, index) => {
    const dot = document.createElement("span");
    dot.className = `pomodoro-dot${index < completedRoundsInCycle() ? " completed" : ""}`;
    return dot;
  }));
  document.title = pomodoro.running ? `${formatted} · ${phase.label} — Мои проекты` : "Мои проекты";
}

function renderStatistics() {
  const summary = summarizePomodoro(pomodoroHistory);
  elements.statToday.textContent = String(summary.todayFocus);
  elements.statLaunches.textContent = String(summary.launches);
  elements.statMinutes.textContent = String(summary.focusMinutes);
  elements.statCompleted.textContent = String(summary.completedFocus);

  const days = focusCountsForLastDays(pomodoroHistory);
  const maximum = Math.max(1, ...days.map((day) => day.count));
  elements.weeklyChart.replaceChildren(...days.map((day) => {
    const column = document.createElement("div");
    column.className = "chart-day";
    const track = document.createElement("div");
    track.className = "chart-bar-track";
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.height = `${Math.max(day.count > 0 ? 8 : 2, day.count / maximum * 100)}%`;
    track.append(bar);
    const count = textSpan(String(day.count), "chart-count");
    const label = textSpan(day.date.toLocaleDateString("ru-RU", { weekday: "short", day: "2-digit" }), "chart-label");
    column.append(track, count, label);
    return column;
  }));

  const recent = [...pomodoroHistory].reverse().slice(0, 30);
  elements.pomodoroHistory.replaceChildren(...recent.map((run) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const mode = document.createElement("span");
    mode.className = "history-mode";
    mode.append(textSpan(run.phase === "focus" ? "🍅" : "☕", "history-icon"), textSpan(POMODORO_PHASES[run.phase].label, "history-label"));
    const started = textSpan(new Date(run.startedAt).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), "history-start");
    const outcomeLabels = { active: pomodoro.running ? "Идёт" : "Пауза", completed: "Завершён", reset: "Сброшен", skipped: "Пропущен" };
    const outcome = textSpan(outcomeLabels[run.outcome], `history-status ${run.outcome}`);
    row.append(mode, started, outcome);
    return row;
  }));
}

function showPage(page) {
  const statisticsVisible = page === "statistics";
  elements.tasksPage.hidden = statisticsVisible;
  elements.statisticsPage.hidden = !statisticsVisible;
  elements.showTasks.classList.toggle("selected", !statisticsVisible);
  elements.showStatistics.classList.toggle("selected", statisticsVisible);
  if (statisticsVisible) renderStatistics();
}

function startPomodoroInterval() {
  clearInterval(pomodoroInterval);
  pomodoroInterval = pomodoro.running ? setInterval(updatePomodoro, 250) : null;
}

function updatePomodoro() {
  if (!pomodoro.running) return;
  pomodoro.secondsRemaining = Math.max(0, Math.ceil((pomodoro.deadline - Date.now()) / 1000));
  if (pomodoro.secondsRemaining === 0) {
    finishPomodoro();
    return;
  }
  renderPomodoro();
}

function finishPomodoro() {
  const completedPhase = pomodoro.phase;
  finishActiveRun("completed");
  const next = nextPomodoroPhase(pomodoro.phase, pomodoro.completedFocusSessions);
  const running = shouldAutoStartAfter(completedPhase);
  const secondsRemaining = durationFor(next.phase);
  pomodoro = {
    ...next, secondsRemaining, running,
    deadline: running ? Date.now() + secondsRemaining * 1000 : null,
    activeRunId: null
  };
  if (running) ensureActiveRun();
  startPomodoroInterval();
  persistPomodoro();
  renderPomodoro();
  renderStatistics();
  playTimerChime(completedPhase);
}

function prepareAudio() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();
  } catch (error) {
    console.warn("Не удалось подготовить звуковой сигнал таймера", error);
  }
}

function playTimerChime(completedPhase) {
  prepareAudio();
  if (!audioContext) return;
  const strikes = completedPhase === "focus"
    ? [{ frequency: 880, delay: 0 }, { frequency: 1175, delay: 0.34 }]
    : [{ frequency: 660, delay: 0 }, { frequency: 523, delay: 0.42 }];
  strikes.forEach(({ frequency, delay }) => strikeBell(frequency, audioContext.currentTime + delay));
}

function strikeBell(baseFrequency, start) {
  const partials = [
    { ratio: 1, level: 0.11, decay: 1.8 },
    { ratio: 2.01, level: 0.05, decay: 1.35 },
    { ratio: 3.9, level: 0.025, decay: 0.9 },
    { ratio: 5.4, level: 0.012, decay: 0.65 }
  ];
  partials.forEach(({ ratio, level, decay }) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = baseFrequency * ratio;
    gain.gain.setValueAtTime(level, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + decay);
  });
}

function textSpan(text, className) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

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
  elements.saveStatus.classList.remove("error");
  state.saveTimer = setTimeout(async () => {
    try {
      await window.projectTasks.save({ version: 2, projectTypes: state.projectTypes, projects: state.projects });
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

elements.themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("projectTasks.theme", nextTheme);
  applyTheme(nextTheme);
});

elements.showTasks.addEventListener("click", () => showPage("tasks"));
elements.showStatistics.addEventListener("click", () => showPage("statistics"));

elements.pomodoroToggle.addEventListener("click", () => {
  if (pomodoro.running) {
    updatePomodoro();
    pomodoro.running = false;
    pomodoro.deadline = null;
  } else {
    prepareAudio();
    ensureActiveRun();
    pomodoro.running = true;
    pomodoro.deadline = Date.now() + pomodoro.secondsRemaining * 1000;
  }
  startPomodoroInterval();
  persistPomodoro();
  renderPomodoro();
  renderStatistics();
});

elements.pomodoroReset.addEventListener("click", () => {
  finishActiveRun("reset");
  pomodoro.secondsRemaining = durationFor(pomodoro.phase);
  pomodoro.running = false;
  pomodoro.deadline = null;
  startPomodoroInterval();
  persistPomodoro();
  renderPomodoro();
  renderStatistics();
});

elements.pomodoroSkip.addEventListener("click", () => {
  finishActiveRun("skipped");
  const next = skippedPomodoroPhase(pomodoro.phase, pomodoro.completedFocusSessions);
  pomodoro = { ...next, secondsRemaining: durationFor(next.phase), running: false, deadline: null, activeRunId: null };
  startPomodoroInterval();
  persistPomodoro();
  renderPomodoro();
  renderStatistics();
});

async function initialize() {
  applyTheme(initialTheme());
  renderPomodoro();
  if (pomodoro.running) ensureActiveRun();
  startPomodoroInterval();
  renderStatistics();
  const stored = await window.projectTasks.load();
  const workspace = normalizeWorkspace(stored);
  state.projectTypes = workspace.projectTypes;
  state.projects = workspace.projects;
  state.selectedTypeId = state.projectTypes[0]?.id ?? null;
  state.selectedProjectId = projectsForSelectedType()[0]?.id ?? null;
  state.selectedTaskId = selectedProject()?.tasks[0]?.id ?? null;
  render();
  if (Array.isArray(stored)) await window.projectTasks.save(workspace);
}

initialize().catch((error) => {
  console.error(error);
  elements.projectTitle.textContent = "Не удалось загрузить данные";
});
