import { elements } from "./ui/elements.js";
import { initializeTheme } from "./ui/theme.js";
import { createWorkspaceController } from "./workspace-controller.js";
import { createPomodoroController } from "./pomodoro-controller.js";
import { createCalendarController } from "./calendar-controller.js";
import { localizeDocument, setLocale, t } from "./i18n.js";

const workspace = createWorkspaceController(elements);
const timer = createPomodoroController(elements);
const calendar = createCalendarController(elements, workspace);
elements.showTasks.addEventListener("click", () => showPage("tasks"));
elements.showStatistics.addEventListener("click", () => showPage("statistics"));
elements.showCalendar.addEventListener("click", () => showPage("calendar"));
elements.showAbout.addEventListener("click", () => elements.aboutDialog.showModal());
function renderUpdateState(state) {
  const messages = {
    unavailable: t("Обновления доступны в установленной версии Windows"),
    checking: t("Проверка обновлений…"),
    current: t("Установлена последняя версия"),
    available: t("Доступна версия {version}", { version: state.version }),
    downloading: t("Загрузка: {progress} %", { progress: state.progress }),
    ready: t("Версия {version} готова к установке", { version: state.version }),
    installing: t("Установка обновления…"),
    error: t("Ошибка обновления: {error}", { error: state.error ?? state.message })
  };
  elements.updateStatus.textContent = messages[state.status] ?? state.message;
  elements.updateStatus.title = elements.updateStatus.textContent;
  elements.updateButton.disabled = state.status !== "available" && state.status !== "ready";
  elements.updateButton.textContent = state.status === "ready" ? t("Установить и перезапустить") : t("Обновить");
  elements.updateButton.title = elements.updateStatus.textContent;
}
elements.updateButton.addEventListener("click", async () => {
  elements.updateButton.disabled = true;
  try {
    await workspace.flushSave();
    await window.projectTasks.installUpdate();
  } catch (error) {
    elements.updateStatus.textContent = t("Не удалось подготовить обновление: {error}", { error: error.message });
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
  setLocale(appInfo.locale);
  localizeDocument();
  initializeTheme(elements);
  window.projectTasks.onUpdateState(renderUpdateState);
  renderUpdateState(await window.projectTasks.getUpdateState());
  elements.aboutVersion.textContent = t("Версия {version}", { version: appInfo.version });
  elements.aboutDescription.textContent = t(appInfo.description);
  timer.initialize();
  await workspace.initialize();
  calendar.initialize();
  document.documentElement.dataset.ready = "true";
} catch (error) {
  console.error(error);
  elements.projectTitle.textContent = t("Не удалось загрузить данные");
}
window.addEventListener("beforeunload", () => { timer.dispose(); calendar.dispose(); });
