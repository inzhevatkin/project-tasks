import { filterTaskJournal } from "./task-journal.js";
import { localDateKey } from "./calendar.js";
import { intlLocale, t } from "./i18n.js";
import { textSpan } from "./ui/dom.js";

const actionLabels = {
  created: "Создана задача", started: "Начата работа", paused: "Работа остановлена",
  completed: "Задача выполнена", reopened: "Задача возвращена к выполнению", deleted: "Задача удалена"
};

export function createJournalController(elements, workspace, { onOpenTask = () => {} } = {}) {
  let visibleCount = 100;
  const formatDay = (date) => new Intl.DateTimeFormat(intlLocale(), {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  }).format(date);
  const formatTime = (date) => new Intl.DateTimeFormat(intlLocale(), {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(date);
  const displayType = (id, name) => id === "work" && name === "Работа" ? t(name) : name;
  const displayName = (name) => name === "Без названия" ? t(name) : name;

  function openTask(projectId, taskId) {
    if (workspace.openTask(projectId, taskId)) onOpenTask();
  }

  function renderCurrentWork() {
    const current = workspace.getWorkingTask();
    elements.currentWork.hidden = !current;
    if (!current) return;
    elements.currentWorkTask.textContent = `${displayName(current.task.title)} · ${displayName(current.project.name)}`;
    elements.currentWorkTask.title = current.task.workStartedAt
      ? t("В работе с {date}", { date: new Intl.DateTimeFormat(intlLocale(), { dateStyle: "medium", timeStyle: "short" }).format(new Date(current.task.workStartedAt)) })
      : t("В работе");
  }

  function entryRow(entry) {
    const row = document.createElement("article");
    row.className = `journal-entry ${entry.action}`;
    row.dataset.action = entry.action;
    row.dataset.entryId = entry.id;
    const time = document.createElement("time");
    time.className = "journal-time";
    time.dateTime = entry.at;
    time.textContent = formatTime(new Date(entry.at));
    const body = document.createElement("div");
    body.className = "journal-entry-body";
    body.append(textSpan(t(actionLabels[entry.action]), "journal-action"));
    const exists = workspace.hasTask(entry.projectId, entry.taskId);
    const title = document.createElement(exists ? "button" : "strong");
    title.className = "journal-task-title";
    title.textContent = displayName(entry.taskTitle);
    if (exists) {
      title.type = "button";
      title.dataset.projectId = entry.projectId;
      title.dataset.taskId = entry.taskId;
      title.title = t("Открыть задачу");
    }
    body.append(title);
    body.append(textSpan([displayType(entry.typeId, entry.typeName), displayName(entry.projectName)].filter(Boolean).join(" · "), "journal-project"));
    if (entry.imported) body.append(textSpan(t("Из старых данных"), "journal-imported"));
    row.append(time, body);
    return row;
  }

  function render() {
    renderCurrentWork();
    const startedAt = workspace.getJournalStartedAt();
    elements.journalSince.textContent = startedAt
      ? t("История изменений ведётся с {date}. Время записей отображается в вашем часовом поясе.", { date: formatDay(new Date(startedAt)) }) : "";
    const allEntries = workspace.getTaskJournal();
    const filtered = filterTaskJournal(allEntries, {
      from: elements.journalFrom.value, to: elements.journalTo.value, query: elements.journalSearch.value
    });
    elements.journalEmpty.hidden = allEntries.length > 0;
    elements.journalNoResults.hidden = !allEntries.length || filtered.length > 0;
    elements.journalMore.hidden = filtered.length <= visibleCount;
    const sections = [];
    let day = null;
    let section = null;
    for (const entry of filtered.slice(0, visibleCount)) {
      const date = new Date(entry.at);
      const key = localDateKey(date);
      if (key !== day) {
        day = key;
        section = document.createElement("section");
        section.className = "journal-day";
        const heading = document.createElement("h3");
        heading.textContent = formatDay(date);
        section.append(heading);
        sections.push(section);
      }
      section.append(entryRow(entry));
    }
    elements.journalList.replaceChildren(...sections);
  }

  elements.currentWorkTask.addEventListener("click", () => {
    const current = workspace.getWorkingTask();
    if (current) openTask(current.project.id, current.task.id);
  });
  elements.stopWorking.addEventListener("click", () => workspace.stopWorking());
  elements.journalList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-task-id]");
    if (button) openTask(button.dataset.projectId, button.dataset.taskId);
  });
  elements.journalFilters.addEventListener("submit", (event) => event.preventDefault());
  elements.journalFilters.addEventListener("input", () => { visibleCount = 100; render(); });
  elements.journalReset.addEventListener("click", () => {
    elements.journalFilters.reset();
    visibleCount = 100;
    render();
  });
  elements.journalMore.addEventListener("click", () => { visibleCount += 100; render(); });
  const unsubscribe = workspace.subscribeJournal(() => {
    renderCurrentWork();
    if (!elements.journalPage.hidden) render();
  });
  return { initialize: render, render, dispose: unsubscribe };
}
