import { elements } from "./ui/elements.js";
import { initializeTheme } from "./ui/theme.js";
import { createWorkspaceController } from "./workspace-controller.js";
import { createPomodoroController } from "./pomodoro-controller.js";

initializeTheme(elements);
const workspace = createWorkspaceController(elements);
const timer = createPomodoroController(elements);
elements.showTasks.addEventListener("click", () => showPage(false));
elements.showStatistics.addEventListener("click", () => showPage(true));
elements.showAbout.addEventListener("click", () => elements.aboutDialog.showModal());

function showPage(statisticsVisible) {
  elements.tasksPage.hidden = statisticsVisible;
  elements.statisticsPage.hidden = !statisticsVisible;
  elements.showTasks.classList.toggle("selected", !statisticsVisible);
  elements.showStatistics.classList.toggle("selected", statisticsVisible);
}

try {
  const appInfo = await window.projectTasks.getAppInfo();
  elements.aboutVersion.textContent = `Версия ${appInfo.version}`;
  elements.aboutDescription.textContent = appInfo.description;
  timer.initialize();
  await workspace.initialize();
  document.documentElement.dataset.ready = "true";
} catch (error) {
  console.error(error);
  elements.projectTitle.textContent = "Не удалось загрузить данные";
}
window.addEventListener("beforeunload", () => timer.dispose());
