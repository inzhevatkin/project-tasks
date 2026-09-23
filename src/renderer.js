import { elements } from "./ui/elements.js";
import { initializeTheme } from "./ui/theme.js";
import { createWorkspaceController } from "./workspace-controller.js";
import { createPomodoroController } from "./pomodoro-controller.js";
import { createCalendarController } from "./calendar-controller.js";

initializeTheme(elements);
const workspace = createWorkspaceController(elements);
const timer = createPomodoroController(elements);
const calendar = createCalendarController(elements, workspace);
elements.showTasks.addEventListener("click", () => showPage("tasks"));
elements.showStatistics.addEventListener("click", () => showPage("statistics"));
elements.showCalendar.addEventListener("click", () => showPage("calendar"));
elements.showAbout.addEventListener("click", () => elements.aboutDialog.showModal());
function renderUpdateState(state) {
  elements.updateStatus.textContent = state.message;
  elements.updateStatus.title = state.message;
  elements.updateButton.disabled = state.status !== "available" && state.status !== "ready";
  elements.updateButton.textContent = state.status === "ready" ? "Установить и перезапустить" : "Обновить";
  elements.updateButton.title = state.message;
}
window.projectTasks.onUpdateState(renderUpdateState);
renderUpdateState(await window.projectTasks.getUpdateState());
elements.updateButton.addEventListener("click", async () => {
  elements.updateButton.disabled = true;
  try {
    await workspace.flushSave();
    await window.projectTasks.installUpdate();
  } catch (error) {
    elements.updateStatus.textContent = `Не удалось подготовить обновление: ${error.message}`;
    elements.updateButton.disabled = false;
  }
});

function showPage(page) {
  elements.tasksPage.hidden = page !== "tasks";
  elements.statisticsPage.hidden = page !== "statistics";
  elements.calendarPage.hidden = page !== "calendar";
  elements.showTasks.classList.toggle("selected", page === "tasks");
  elements.showStatistics.classList.toggle("selected", page === "statistics");
  elements.showCalendar.classList.toggle("selected", page === "calendar");
}

try {
  const appInfo = await window.projectTasks.getAppInfo();
  elements.aboutVersion.textContent = `Версия ${appInfo.version}`;
  elements.aboutDescription.textContent = appInfo.description;
  timer.initialize();
  await workspace.initialize();
  calendar.initialize();
  document.documentElement.dataset.ready = "true";
} catch (error) {
  console.error(error);
  elements.projectTitle.textContent = "Не удалось загрузить данные";
}
window.addEventListener("beforeunload", () => { timer.dispose(); calendar.dispose(); });
