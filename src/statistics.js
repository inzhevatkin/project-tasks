import { POMODORO_PHASES, durationFor } from "./pomodoro.js";

const OUTCOMES = new Set(["active", "completed", "reset", "skipped"]);

export function createPomodoroRun(phase, startedAt = new Date().toISOString()) {
  return {
    id: crypto.randomUUID(), phase, startedAt, endedAt: null,
    outcome: "active", plannedSeconds: durationFor(phase), elapsedSeconds: 0
  };
}

export function finishPomodoroRun(run, outcome, secondsRemaining, endedAt = new Date().toISOString()) {
  const elapsedSeconds = outcome === "completed"
    ? run.plannedSeconds
    : Math.max(0, run.plannedSeconds - Math.max(0, secondsRemaining));
  return { ...run, endedAt, outcome, elapsedSeconds };
}

export function normalizePomodoroHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((run) => run && typeof run === "object" && POMODORO_PHASES[run.phase]).map((run) => ({
    id: typeof run.id === "string" ? run.id : crypto.randomUUID(),
    phase: run.phase,
    startedAt: validDate(run.startedAt) ? run.startedAt : new Date().toISOString(),
    endedAt: validDate(run.endedAt) ? run.endedAt : null,
    outcome: OUTCOMES.has(run.outcome) ? run.outcome : "completed",
    plannedSeconds: positiveNumber(run.plannedSeconds, durationFor(run.phase)),
    elapsedSeconds: Math.max(0, Number(run.elapsedSeconds) || 0)
  })).slice(-2000);
}

export function summarizePomodoro(history, now = new Date(), currentPomodoro = null) {
  const todayKey = localDateKey(now);
  const finished = history.filter((run) => run.outcome !== "active");
  const completedFocus = finished.filter((run) => run.phase === "focus" && run.outcome === "completed");
  const focusToday = finished.filter((run) => run.phase === "focus" && run.endedAt
    && localDateKey(new Date(run.endedAt)) === todayKey);
  const activeFocus = currentPomodoro?.phase === "focus" && currentPomodoro.activeRunId
    ? history.find((run) => run.id === currentPomodoro.activeRunId && run.phase === "focus" && run.outcome === "active"
      && localDateKey(new Date(run.startedAt)) === todayKey)
    : null;
  const activeSeconds = activeFocus && Number.isFinite(currentPomodoro.secondsRemaining)
    ? Math.min(durationFor("focus"), Math.max(0, durationFor("focus") - currentPomodoro.secondsRemaining)) : 0;
  return {
    launches: history.length,
    completedFocus: completedFocus.length,
    todayFocus: completedFocus.filter((run) => localDateKey(new Date(run.endedAt)) === todayKey).length,
    focusMinutes: Math.round(finished.filter((run) => run.phase === "focus").reduce((sum, run) => sum + run.elapsedSeconds, 0) / 60),
    todayFocusMinutes: Math.round((focusToday.reduce((sum, run) => sum + run.elapsedSeconds, 0) + activeSeconds) / 60),
    completedBreaks: finished.filter((run) => run.phase !== "focus" && run.outcome === "completed").length
  };
}

export function focusCountsForLastDays(history, numberOfDays = 7, now = new Date()) {
  const days = [];
  for (let offset = numberOfDays - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    days.push({ key: localDateKey(date), date, count: 0 });
  }
  const byKey = new Map(days.map((day) => [day.key, day]));
  history.filter((run) => run.phase === "focus" && run.outcome === "completed" && run.endedAt).forEach((run) => {
    const day = byKey.get(localDateKey(new Date(run.endedAt)));
    if (day) day.count += 1;
  });
  return days;
}

function localDateKey(date) {
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDate(value) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
