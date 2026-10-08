import { elements } from "./ui/elements.js";
import { initializeTheme } from "./ui/theme.js";
import { createWorkspaceController } from "./workspace-controller.js";
import { createPomodoroController } from "./pomodoro-controller.js";
import { createCalendarController } from "./calendar-controller.js";
import { createJournalController } from "./journal-controller.js";
import { localizeDocument, setLocale, t } from "./i18n.js";
import { runUpdate } from "./update-flow.js";
import { renderUpdateView } from "./ui/update-view.js";

const workspace = createWorkspaceController(elements);
const timer = createPomodoroController(elements);
const calendar = createCalendarController(elements, workspace);
const journal = createJournalController(elements, workspace, { onOpenTask: () => showPage("tasks") });
elements.showTasks.addEventListener("click", () => showPage("tasks"));
elements.showStatistics.addEventListener("click", () => showPage("statistics"));
elements.showCalendar.addEventListener("click", () => showPage("calendar"));
elements.showJournal.addEventListener("click", () => showPage("journal"));
elements.showAbout.addEventListener("click", () => elements.aboutDialog.showModal());
let updateInProgress = false;
let lastUpdateState = { status: "unavailable" };
function renderUpdateState(state) {
  lastUpdateState = state;
  renderUpdateView(elements, state, updateInProgress);
}
elements.updateButton.addEventListener("click", async () => {
  if (updateInProgress) return;
  updateInProgress = true;
  renderUpdateState(lastUpdateState);
  let failure = null;
  try {
    await runUpdate({
      getUpdateState: window.projectTasks.getUpdateState,
      downloadUpdate: window.projectTasks.downloadUpdate,
      installUpdate: window.projectTasks.installUpdate,
      saveWorkspace: workspace.flushSave
    });
  } catch (error) {
    failure = t("Не удалось подготовить обновление: {error}", { error: error.message });
  } finally {
    updateInProgress = false;
    renderUpdateState(lastUpdateState);
    if (failure) {
      elements.updateStatus.hidden = false;
      elements.updateStatus.textContent = failure;
      elements.updateStatus.title = failure;
    }
  }
});

function showPage(page) {
  elements.tasksPage.hidden = page !== "tasks";
  elements.statisticsPage.hidden = page !== "statistics";
  elements.calendarPage.hidden = page !== "calendar";
  elements.journalPage.hidden = page !== "journal";
  elements.showTasks.classList.toggle("selected", page === "tasks");
  elements.showStatistics.classList.toggle("selected", page === "statistics");
  elements.showCalendar.classList.toggle("selected", page === "calendar");
  elements.showJournal.classList.toggle("selected", page === "journal");
  if (page === "journal") journal.render();
}

try {
  const appInfo = await window.projectTasks.getAppInfo();
  setLocale(appInfo.locale);
  localizeDocument();
  await initializeTheme(elements);
  window.projectTasks.onUpdateState(renderUpdateState);
  renderUpdateState(await window.projectTasks.getUpdateState());
  elements.aboutVersion.textContent = t("Версия {version}", { version: appInfo.version });
  elements.aboutDescription.textContent = t(appInfo.description);
  timer.initialize();
  await workspace.initialize();
  calendar.initialize();
  journal.initialize();
  window.projectTasks.onBeforeClose(async () => {
    try {
      await workspace.flushSave();
      window.projectTasks.finishClose(true);
    } catch (error) {
      console.error(error);
      showPage("journal");
      window.projectTasks.finishClose(false);
    }
  });
  window.projectTasks.rendererReady();
  document.documentElement.dataset.ready = "true";
} catch (error) {
  console.error(error);
  elements.projectTitle.textContent = t("Не удалось загрузить данные");
}
window.addEventListener("beforeunload", () => { timer.dispose(); calendar.dispose(); journal.dispose(); });
