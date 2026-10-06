import { filterTaskJournal, journalProjects } from "./task-journal.js";
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

  function renderProjectFilter(entries) {
    const selected = elements.journalProject.value;
    const choices = journalProjects(entries, workspace.getProjects(), workspace.getProjectTypes());
    const label = (project) => {
      const name = [displayType(project.typeId, project.typeName), displayName(project.name)].filter(Boolean).join(" · ");
      return project.deleted ? t("{name} (удалён)", { name }) : name;
    };
    choices.sort((a, b) => label(a).localeCompare(label(b), intlLocale()));
    const all = document.createElement("option");
    all.value = "";
    all.textContent = t("Все проекты");
    const options = choices.map((project) => {
      const option = document.createElement("option");
      option.value = project.id;
      option.textContent = label(project);
      return option;
    });
    elements.journalProject.replaceChildren(all, ...options);
    elements.journalProject.value = choices.some((project) => project.id === selected) ? selected : "";
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
    const startedAt = workspace.getJournalStartedAt();
    elements.journalSince.textContent = startedAt
      ? t("История изменений ведётся с {date}. Время записей отображается в вашем часовом поясе.", { date: formatDay(new Date(startedAt)) }) : "";
    const allEntries = workspace.getTaskJournal();
    renderProjectFilter(allEntries);
    const filtered = filterTaskJournal(allEntries, {
      from: elements.journalFrom.value, to: elements.journalTo.value,
      query: elements.journalSearch.value, projectId: elements.journalProject.value
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

  elements.journalList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-task-id]");
    if (button) openTask(button.dataset.projectId, button.dataset.taskId);
  });
  elements.journalFilters.addEventListener("submit", (event) => event.preventDefault());
  elements.journalFilters.addEventListener("input", (event) => {
    if (event.target === elements.journalProject) return;
    visibleCount = 100;
    render();
  });
  elements.journalProject.addEventListener("change", () => { visibleCount = 100; render(); });
  elements.journalReset.addEventListener("click", () => {
    elements.journalFilters.reset();
    visibleCount = 100;
    render();
  });
  elements.journalMore.addEventListener("click", () => { visibleCount += 100; render(); });
  const unsubscribe = workspace.subscribeJournal(() => {
    if (!elements.journalPage.hidden) render();
  });
  return { initialize: render, render, dispose: unsubscribe };
}
