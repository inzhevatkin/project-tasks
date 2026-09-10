import test from "node:test";
import assert from "node:assert/strict";
import { durationFor, formatTime, nextPomodoroPhase, shouldAutoStartAfter, skippedPomodoroPhase } from "../src/pomodoro.js";

test("использует классические интервалы 25, 5 и 15 минут", () => {
  assert.equal(durationFor("focus"), 25 * 60);
  assert.equal(durationFor("shortBreak"), 5 * 60);
  assert.equal(durationFor("longBreak"), 15 * 60);
});

test("после каждой четвёртой рабочей сессии назначает длинный перерыв", () => {
  assert.deepEqual(nextPomodoroPhase("focus", 2), { phase: "shortBreak", completedFocusSessions: 3 });
  assert.deepEqual(nextPomodoroPhase("focus", 3), { phase: "longBreak", completedFocusSessions: 4 });
  assert.deepEqual(nextPomodoroPhase("longBreak", 4), { phase: "focus", completedFocusSessions: 4 });
});

test("пропущенная рабочая сессия не засчитывается", () => {
  assert.deepEqual(skippedPomodoroPhase("focus", 2), { phase: "shortBreak", completedFocusSessions: 2 });
});

test("автоматически запускает перерыв, но не следующую рабочую сессию", () => {
  assert.equal(shouldAutoStartAfter("focus"), true);
  assert.equal(shouldAutoStartAfter("shortBreak"), false);
  assert.equal(shouldAutoStartAfter("longBreak"), false);
});

test("форматирует оставшееся время", () => {
  assert.equal(formatTime(1500), "25:00");
  assert.equal(formatTime(5), "00:05");
});
