import { POMODORO_PHASES } from "../pomodoro.js";
import { focusCountsForLastDays, summarizePomodoro } from "../statistics.js";
import { textSpan } from "./dom.js";
import { intlLocale, t } from "../i18n.js";

export function renderStatistics(elements, pomodoroHistory, pomodoro) {
  const summary = summarizePomodoro(pomodoroHistory, new Date(), pomodoro);
  elements.statToday.textContent = String(summary.todayFocus);
  elements.statLaunches.textContent = String(summary.launches);
  elements.statMinutes.textContent = String(summary.todayFocusMinutes);
  elements.statCompleted.textContent = String(summary.completedFocus);

  const days = focusCountsForLastDays(pomodoroHistory);
  const maximum = Math.max(1, ...days.map((day) => day.count));
  elements.weeklyChart.replaceChildren(...days.map((day) => {
    const column = document.createElement("div");
    column.className = "chart-day";
    const track = document.createElement("div");
    track.className = "chart-bar-track";
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    bar.style.height = `${Math.max(day.count > 0 ? 8 : 2, day.count / maximum * 100)}%`;
    track.append(bar);
    const count = textSpan(String(day.count), "chart-count");
    const label = textSpan(day.date.toLocaleDateString(intlLocale(), { weekday: "short", day: "2-digit" }), "chart-label");
    column.append(track, count, label);
    return column;
  }));

  const recent = [...pomodoroHistory].reverse().slice(0, 30);
  elements.pomodoroHistory.replaceChildren(...recent.map((run) => {
    const row = document.createElement("div");
    row.className = "history-row";
    const mode = document.createElement("span");
    mode.className = "history-mode";
    mode.append(textSpan(run.phase === "focus" ? "🍅" : "☕", "history-icon"), textSpan(t(POMODORO_PHASES[run.phase].label), "history-label"));
    const started = textSpan(new Date(run.startedAt).toLocaleString(intlLocale(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), "history-start");
    const outcomeLabels = { active: pomodoro.running ? "Идёт" : "Пауза", completed: "Завершён", reset: "Сброшен", skipped: "Пропущен" };
    const outcome = textSpan(t(outcomeLabels[run.outcome]), `history-status ${run.outcome}`);
    row.append(mode, started, outcome);
    return row;
  }));
}
