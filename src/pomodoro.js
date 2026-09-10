export const POMODORO_PHASES = Object.freeze({
  focus: { label: "Фокус", seconds: 25 * 60 },
  shortBreak: { label: "Короткий перерыв", seconds: 5 * 60 },
  longBreak: { label: "Длинный перерыв", seconds: 15 * 60 }
});

export function durationFor(phase) {
  return POMODORO_PHASES[phase]?.seconds ?? POMODORO_PHASES.focus.seconds;
}

export function nextPomodoroPhase(phase, completedFocusSessions) {
  if (phase === "focus") {
    const completed = completedFocusSessions + 1;
    return {
      phase: completed % 4 === 0 ? "longBreak" : "shortBreak",
      completedFocusSessions: completed
    };
  }
  return { phase: "focus", completedFocusSessions };
}

export function skippedPomodoroPhase(phase, completedFocusSessions) {
  return phase === "focus"
    ? { phase: "shortBreak", completedFocusSessions }
    : { phase: "focus", completedFocusSessions };
}

export function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
