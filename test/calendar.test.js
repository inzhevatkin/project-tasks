import test from "node:test";
import assert from "node:assert/strict";
import { createCalendarEvent, eventsOnDate, isValidCalendarDate, localDateKey, monthDates, normalizeCalendarEvents } from "../src/calendar.js";

test("создаёт разовое и ежегодное события с необязательным временем", () => {
  const birthday = createCalendarEvent({ title: "  День рождения  ", date: "2020-05-12", annual: true });
  const meeting = createCalendarEvent({ title: "Встреча", date: "2026-05-12", time: "14:30" });
  assert.equal(birthday.title, "День рождения");
  assert.equal(birthday.time, "");
  assert.equal(birthday.annual, true);
  assert.equal(meeting.time, "14:30");
  assert.equal(meeting.annual, false);
  assert.throws(() => createCalendarEvent({ title: "Ошибка", date: "2026-02-30" }), TypeError);
  assert.throws(() => createCalendarEvent({ title: "Ошибка", date: "2026-05-12", time: "25:00" }), TypeError);
});

test("ежегодные события показываются в нужный день, а 29 февраля — только в високосный год", () => {
  const events = normalizeCalendarEvents([
    { id: "birthday", title: "День рождения", date: "2020-05-12", annual: true, time: "" },
    { id: "leap", title: "29 февраля", date: "2024-02-29", annual: true, time: "" },
    { id: "meeting", title: "Встреча", date: "2026-05-12", annual: false, time: "14:30" }
  ]);
  assert.deepEqual(eventsOnDate(events, "2027-05-12").map((event) => event.id), ["birthday"]);
  assert.deepEqual(eventsOnDate(events, "2026-05-12").map((event) => event.id), ["birthday", "meeting"]);
  assert.deepEqual(eventsOnDate(events, "2025-02-28"), []);
  assert.deepEqual(eventsOnDate(events, "2028-02-29").map((event) => event.id), ["leap"]);
  assert.equal(isValidCalendarDate("2025-02-29"), false);
  assert.equal(isValidCalendarDate("2028-02-29"), true);
});

test("план дня ставит события без времени перед встречами по времени", () => {
  const events = normalizeCalendarEvents([
    { title: "Обед", date: "2026-09-14", time: "13:00" },
    { title: "Звонок", date: "2026-09-14", time: "09:30" },
    { title: "Праздник", date: "2026-09-14", time: "" }
  ]);
  assert.deepEqual(eventsOnDate(events, "2026-09-14").map((event) => event.title), ["Праздник", "Звонок", "Обед"]);
});

test("сетка месяца начинается с понедельника и использует местную дату", () => {
  const dates = monthDates(2026, 8);
  assert.equal(dates.length, 35);
  assert.equal(dates[0], "2026-08-31");
  assert.equal(dates.at(-1), "2026-10-04");
  assert.equal(localDateKey(new Date(2026, 8, 14)), "2026-09-14");
});
