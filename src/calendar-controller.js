import { createCalendarEvent, eventsOnDate, localDateKey, monthDates } from "./calendar.js";
import { intlLocale, t } from "./i18n.js";

const AGENDA_DATE_KEY = "projectTasks.lastDailyAgendaDate";
const formatDate = (date) => new Intl.DateTimeFormat(intlLocale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(date);
const formatMonth = (date) => new Intl.DateTimeFormat(intlLocale(), { month: "long", year: "numeric" }).format(date);

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function eventRow(event, editable = false) {
  const row = document.createElement("div");
  row.className = "calendar-event-row";
  const content = document.createElement("div");
  content.className = "calendar-event-content";
  const title = document.createElement("strong");
  title.textContent = event.title;
  const meta = document.createElement("span");
  meta.className = "calendar-event-meta";
  meta.textContent = `${event.time || t("Весь день")}${event.annual ? ` · ${t("Каждый год")}` : ""}`;
  content.append(title, meta);
  row.append(content);
  if (editable) {
    const actions = document.createElement("div");
    actions.className = "calendar-event-actions";
    for (const [action, label] of [["edit", t("Изменить")], ["delete", t("Удалить")]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = action === "delete" ? "calendar-link calendar-link-danger" : "calendar-link";
      button.dataset.action = action;
      button.dataset.id = event.id;
      button.textContent = label;
      actions.append(button);
    }
    row.append(actions);
  }
  return row;
}

export function createCalendarController(elements, workspace, { now = () => new Date() } = {}) {
  let selectedDate = localDateKey(now());
  let visibleMonth = new Date(now().getFullYear(), now().getMonth(), 1);
  let knownToday = localDateKey(now());
  let editingId = null;
  let dayCheckInterval = null;

  function renderMonth() {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const today = localDateKey(now());
    elements.calendarMonth.textContent = formatMonth(visibleMonth);
    elements.calendarGrid.replaceChildren(...monthDates(year, month).map((date) => {
      const day = document.createElement("button");
      day.type = "button";
      day.className = "calendar-day";
      if (date.slice(0, 7) !== localDateKey(visibleMonth).slice(0, 7)) day.classList.add("outside");
      if (date === today) day.classList.add("today");
      if (date === selectedDate) day.classList.add("selected");
      day.dataset.date = date;
      day.setAttribute("role", "gridcell");
      day.setAttribute("aria-selected", String(date === selectedDate));
      day.setAttribute("aria-label", formatDate(dateFromKey(date)));
      const number = document.createElement("span");
      number.className = "calendar-day-number";
      number.textContent = String(Number(date.slice(-2)));
      day.append(number);
      const events = eventsOnDate(workspace.getCalendarEvents(), date);
      if (events.length) {
        const preview = document.createElement("span");
        preview.className = "calendar-day-event";
        preview.textContent = events.length === 1 ? events[0].title : t("{count} события", { count: events.length });
        day.append(preview);
      }
      return day;
    }));
  }

  function renderSelectedDay() {
    elements.calendarSelectedTitle.textContent = formatDate(dateFromKey(selectedDate));
    const events = eventsOnDate(workspace.getCalendarEvents(), selectedDate);
    elements.calendarEventList.replaceChildren(...events.map((event) => eventRow(event, true)));
    elements.calendarEmpty.hidden = events.length > 0;
  }

  function render() {
    renderMonth();
    renderSelectedDay();
  }

  function resetForm() {
    editingId = null;
    elements.calendarEventForm.reset();
    elements.calendarDate.value = selectedDate;
    elements.calendarFormTitle.textContent = t("Новое событие");
    elements.calendarSubmit.textContent = t("Добавить событие");
    elements.calendarCancel.hidden = true;
  }

  function selectDate(date) {
    selectedDate = date;
    visibleMonth = new Date(dateFromKey(date).getFullYear(), dateFromKey(date).getMonth(), 1);
    resetForm();
    render();
  }

  function checkDailyAgenda() {
    const today = localDateKey(now());
    if (today !== knownToday) {
      const followingToday = selectedDate === knownToday && !editingId;
      knownToday = today;
      if (followingToday) selectDate(today);
      else renderMonth();
    }
    if (localStorage.getItem(AGENDA_DATE_KEY) === today || document.querySelector("dialog[open]")) return;
    const events = eventsOnDate(workspace.getCalendarEvents(), today);
    if (!events.length) return;
    elements.dailyAgendaTitle.textContent = formatDate(dateFromKey(today));
    elements.dailyAgendaList.replaceChildren(...events.map((event) => eventRow(event)));
    elements.dailyAgendaDialog.showModal();
    localStorage.setItem(AGENDA_DATE_KEY, today);
  }

  elements.calendarPrev.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderMonth();
  });
  elements.calendarNext.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    renderMonth();
  });
  elements.calendarToday.addEventListener("click", () => selectDate(localDateKey(now())));
  elements.calendarGrid.addEventListener("click", (event) => {
    const day = event.target.closest("[data-date]");
    if (day) selectDate(day.dataset.date);
  });

  elements.calendarEventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      const values = {
        title: elements.calendarTitle.value,
        date: elements.calendarDate.value,
        time: elements.calendarTime.value,
        annual: elements.calendarAnnual.checked
      };
      const item = createCalendarEvent(values);
      const events = workspace.getCalendarEvents();
      const updated = editingId
        ? events.map((candidate) => candidate.id === editingId ? { ...item, id: editingId } : candidate)
        : [...events, item];
      workspace.setCalendarEvents(updated);
      selectDate(item.annual && item.date.slice(5) === selectedDate.slice(5) ? selectedDate : item.date);
      checkDailyAgenda();
    } catch (error) {
      elements.calendarSaveStatus.textContent = t(error.message);
      elements.calendarSaveStatus.classList.add("error");
    }
  });

  elements.calendarEventList.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]");
    if (!action) return;
    const item = workspace.getCalendarEvents().find((candidate) => candidate.id === action.dataset.id);
    if (!item) return;
    if (action.dataset.action === "edit") {
      editingId = item.id;
      elements.calendarTitle.value = item.title;
      elements.calendarDate.value = item.date;
      elements.calendarTime.value = item.time;
      elements.calendarAnnual.checked = item.annual;
      elements.calendarFormTitle.textContent = t("Изменить событие");
      elements.calendarSubmit.textContent = t("Сохранить изменения");
      elements.calendarCancel.hidden = false;
      elements.calendarTitle.focus();
    } else if (action.dataset.action === "delete"
      && await workspace.confirmDeletion(t("Удалить событие?"), t("Событие «{name}» будет удалено.", { name: item.title }))) {
      workspace.setCalendarEvents(workspace.getCalendarEvents().filter((candidate) => candidate.id !== item.id));
      if (editingId === item.id) resetForm();
      render();
    }
  });
  elements.calendarCancel.addEventListener("click", resetForm);
  window.addEventListener("focus", checkDailyAgenda);

  return {
    initialize() {
      resetForm();
      render();
      checkDailyAgenda();
      dayCheckInterval = setInterval(checkDailyAgenda, 60_000);
    },
    dispose() {
      clearInterval(dayCheckInterval);
      window.removeEventListener("focus", checkDailyAgenda);
    }
  };
}
