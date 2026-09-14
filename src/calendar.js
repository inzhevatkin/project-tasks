const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidCalendarDate(value) {
  const match = typeof value === "string" ? DATE_PATTERN.exec(value) : null;
  if (!match) return false;
  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= new Date(year, month, 0).getDate();
}

export function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function createCalendarEvent({ title, date, time = "", annual = false }) {
  const name = typeof title === "string" ? title.trim() : "";
  if (!name || !isValidCalendarDate(date) || typeof time !== "string" || (time && !TIME_PATTERN.test(time))) {
    throw new TypeError("Укажите название, корректную дату и время события");
  }
  return { id: crypto.randomUUID(), title: name, date, time, annual: annual === true };
}

export function normalizeCalendarEvents(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((event) => event && typeof event === "object" && !Array.isArray(event)
    && typeof event.title === "string" && event.title.trim() && isValidCalendarDate(event.date))
    .map((event) => ({
      id: typeof event.id === "string" && event.id ? event.id : crypto.randomUUID(),
      title: event.title.trim(),
      date: event.date,
      time: typeof event.time === "string" && TIME_PATTERN.test(event.time) ? event.time : "",
      annual: event.annual === true
    }));
}

export function eventsOnDate(events, date) {
  if (!isValidCalendarDate(date)) return [];
  return events.filter((event) => event.date === date || (event.annual && event.date.slice(5) === date.slice(5)))
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title, "ru"));
}

export function monthDates(year, month) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const last = new Date(year, month + 1, 0);
  const count = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: count }, (_, index) => localDateKey(new Date(year, month, 1 - offset + index)));
}
