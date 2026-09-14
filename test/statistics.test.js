import test from "node:test";
import assert from "node:assert/strict";
import { createPomodoroRun, finishPomodoroRun, focusCountsForLastDays, summarizePomodoro } from "../src/statistics.js";

test("учитывает запуски, завершённые фокусы и минуты работы", () => {
  const focus = finishPomodoroRun(createPomodoroRun("focus", "2026-09-11T08:00:00.000Z"), "completed", 0, "2026-09-11T08:25:00.000Z");
  const reset = finishPomodoroRun(createPomodoroRun("focus", "2026-09-11T09:00:00.000Z"), "reset", 1200, "2026-09-11T09:05:00.000Z");
  const pause = finishPomodoroRun(createPomodoroRun("shortBreak", "2026-09-11T09:25:00.000Z"), "completed", 0, "2026-09-11T09:30:00.000Z");
  const result = summarizePomodoro([focus, reset, pause], new Date("2026-09-11T12:00:00.000Z"));
  assert.equal(result.launches, 3);
  assert.equal(result.completedFocus, 1);
  assert.equal(result.focusMinutes, 30);
  assert.equal(result.todayFocusMinutes, 30);
  assert.equal(result.completedBreaks, 1);
});

test("для рабочего дня считает только сегодняшний фокус и текущий интервал", () => {
  const previous = finishPomodoroRun(createPomodoroRun("focus", "2026-09-10T08:00:00.000Z"), "completed", 0, "2026-09-10T08:25:00.000Z");
  const today = finishPomodoroRun(createPomodoroRun("focus", "2026-09-11T08:00:00.000Z"), "reset", 1200, "2026-09-11T08:05:00.000Z");
  const active = createPomodoroRun("focus", "2026-09-11T09:00:00.000Z");
  const result = summarizePomodoro([previous, today, active], new Date("2026-09-11T12:00:00.000Z"), {
    phase: "focus", activeRunId: active.id, secondsRemaining: 900
  });
  assert.equal(result.focusMinutes, 30);
  assert.equal(result.todayFocusMinutes, 15);
});

test("строит статистику завершённых фокусов по дням", () => {
  const run = finishPomodoroRun(createPomodoroRun("focus", "2026-09-10T08:00:00.000Z"), "completed", 0, "2026-09-10T08:25:00.000Z");
  const days = focusCountsForLastDays([run], 3, new Date("2026-09-11T12:00:00.000Z"));
  assert.equal(days.length, 3);
  assert.equal(days.reduce((sum, day) => sum + day.count, 0), 1);
});
