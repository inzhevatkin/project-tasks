import { POMODORO_PHASES, durationFor, formatTime, nextPomodoroPhase, shouldAutoStartAfter, skippedPomodoroPhase } from "./pomodoro.js";
import { createPomodoroRun, finishPomodoroRun, normalizePomodoroHistory } from "./statistics.js";
import { prepareAudio, playTimerChime } from "./ui/bell.js";
import { renderStatistics as updateStatistics } from "./ui/statistics-view.js";

export function createPomodoroController(elements, { now = Date.now } = {}) {
  const POMODORO_STORAGE_KEY = "projectTasks.pomodoro";
  const POMODORO_HISTORY_KEY = "projectTasks.pomodoroHistory";
  let pomodoroHistory = restorePomodoroHistory();
  let pomodoro = restorePomodoro();
  let pomodoroInterval = null;

  function restorePomodoro() {
    const fallback = {
      phase: "focus", secondsRemaining: durationFor("focus"),
      completedFocusSessions: 0, running: false, deadline: null, activeRunId: null
    };
    try {
      const saved = JSON.parse(localStorage.getItem(POMODORO_STORAGE_KEY));
      if (!saved || !POMODORO_PHASES[saved.phase]) return fallback;
      const completed = Number.isInteger(saved.completedFocusSessions) && saved.completedFocusSessions >= 0
        ? saved.completedFocusSessions : 0;
      if (saved.running && Number.isFinite(saved.deadline)) {
        const remaining = Math.ceil((saved.deadline - now()) / 1000);
        if (remaining > 0) {
          return {
            phase: saved.phase, secondsRemaining: remaining, completedFocusSessions: completed,
            running: true, deadline: saved.deadline,
            activeRunId: typeof saved.activeRunId === "string" ? saved.activeRunId : null
          };
        }
        return {
          phase: saved.phase, secondsRemaining: 0, completedFocusSessions: completed,
          running: true, deadline: saved.deadline,
          activeRunId: typeof saved.activeRunId === "string" ? saved.activeRunId : null
        };
      }
      const maximum = durationFor(saved.phase);
      const remaining = Number.isFinite(saved.secondsRemaining)
        ? Math.min(maximum, Math.max(1, Math.ceil(saved.secondsRemaining))) : maximum;
      return {
        phase: saved.phase, secondsRemaining: remaining, completedFocusSessions: completed,
        running: false, deadline: null,
        activeRunId: typeof saved.activeRunId === "string" ? saved.activeRunId : null
      };
    } catch {
      return fallback;
    }
  }

  function restorePomodoroHistory() {
    try {
      return normalizePomodoroHistory(JSON.parse(localStorage.getItem(POMODORO_HISTORY_KEY)));
    } catch {
      return [];
    }
  }

  function persistPomodoro() {
    localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(pomodoro));
  }

  function persistPomodoroHistory() {
    pomodoroHistory = pomodoroHistory.slice(-2000);
    localStorage.setItem(POMODORO_HISTORY_KEY, JSON.stringify(pomodoroHistory));
  }

  function ensureActiveRun() {
    if (pomodoro.activeRunId && pomodoroHistory.some((run) => run.id === pomodoro.activeRunId && run.outcome === "active")) return;
    const elapsedSeconds = Math.max(0, durationFor(pomodoro.phase) - pomodoro.secondsRemaining);
    const startedAt = new Date(now() - elapsedSeconds * 1000).toISOString();
    const run = createPomodoroRun(pomodoro.phase, startedAt);
    pomodoroHistory.push(run);
    pomodoro.activeRunId = run.id;
    persistPomodoroHistory();
    persistPomodoro();
  }

  function finishActiveRun(outcome) {
    const index = pomodoroHistory.findIndex((run) => run.id === pomodoro.activeRunId && run.outcome === "active");
    if (index >= 0) {
      pomodoroHistory[index] = finishPomodoroRun(pomodoroHistory[index], outcome, pomodoro.secondsRemaining);
      persistPomodoroHistory();
    }
    pomodoro.activeRunId = null;
  }

  function completedRoundsInCycle() {
    const remainder = pomodoro.completedFocusSessions % 4;
    return pomodoro.phase === "longBreak" && remainder === 0 && pomodoro.completedFocusSessions > 0 ? 4 : remainder;
  }

  function renderPomodoro() {
    const phase = POMODORO_PHASES[pomodoro.phase];
    const formatted = formatTime(pomodoro.secondsRemaining);
    elements.pomodoroPhase.textContent = phase.label;
    elements.pomodoroTime.textContent = formatted;
    elements.pomodoroTime.dateTime = `PT${pomodoro.secondsRemaining}S`;
    elements.pomodoroToggle.textContent = pomodoro.running ? "Пауза" : "Старт";
    elements.pomodoroRounds.replaceChildren(...Array.from({ length: 4 }, (_, index) => {
      const dot = document.createElement("span");
      dot.className = `pomodoro-dot${index < completedRoundsInCycle() ? " completed" : ""}`;
      return dot;
    }));
    document.title = pomodoro.running ? `${formatted} · ${phase.label} — Мои проекты` : "Мои проекты";
  }

  function startPomodoroInterval() {
    clearInterval(pomodoroInterval);
    pomodoroInterval = pomodoro.running ? setInterval(updatePomodoro, 250) : null;
  }

  function updatePomodoro() {
    if (!pomodoro.running) return;
    pomodoro.secondsRemaining = Math.max(0, Math.ceil((pomodoro.deadline - now()) / 1000));
    if (pomodoro.secondsRemaining === 0) {
      finishPomodoro();
      return;
    }
    renderPomodoro();
  }

  function refreshRemaining() {
    if (pomodoro.running) {
      pomodoro.secondsRemaining = Math.max(0, Math.ceil((pomodoro.deadline - now()) / 1000));
    }
  }

  function finishPomodoro() {
    const completedPhase = pomodoro.phase;
    finishActiveRun("completed");
    const next = nextPomodoroPhase(pomodoro.phase, pomodoro.completedFocusSessions);
    const running = shouldAutoStartAfter(completedPhase);
    const secondsRemaining = durationFor(next.phase);
    pomodoro = {
      ...next, secondsRemaining, running,
      deadline: running ? now() + secondsRemaining * 1000 : null,
      activeRunId: null
    };
    if (running) ensureActiveRun();
    startPomodoroInterval();
    persistPomodoro();
    renderPomodoro();
    renderStatistics();
    playTimerChime(completedPhase);
  }

  elements.pomodoroToggle.addEventListener("click", () => {
    if (pomodoro.running) {
      updatePomodoro();
      pomodoro.running = false;
      pomodoro.deadline = null;
    } else {
      prepareAudio();
      ensureActiveRun();
      pomodoro.running = true;
      pomodoro.deadline = now() + pomodoro.secondsRemaining * 1000;
    }
    startPomodoroInterval();
    persistPomodoro();
    renderPomodoro();
    renderStatistics();
  });

  elements.pomodoroReset.addEventListener("click", () => {
    refreshRemaining();
    finishActiveRun("reset");
    pomodoro.secondsRemaining = durationFor(pomodoro.phase);
    pomodoro.running = false;
    pomodoro.deadline = null;
    startPomodoroInterval();
    persistPomodoro();
    renderPomodoro();
    renderStatistics();
  });

  elements.pomodoroSkip.addEventListener("click", () => {
    refreshRemaining();
    finishActiveRun("skipped");
    const next = skippedPomodoroPhase(pomodoro.phase, pomodoro.completedFocusSessions);
    pomodoro = { ...next, secondsRemaining: durationFor(next.phase), running: false, deadline: null, activeRunId: null };
    startPomodoroInterval();
    persistPomodoro();
    renderPomodoro();
    renderStatistics();
  });


  function initialize() {
    renderPomodoro();
    if (pomodoro.running) ensureActiveRun();
    startPomodoroInterval();
    renderStatistics();
  }
  return { initialize, dispose: () => clearInterval(pomodoroInterval) };

  function renderStatistics() { updateStatistics(elements, pomodoroHistory, pomodoro); }
}
