import test from "node:test";
import assert from "node:assert/strict";
import { createPomodoroController } from "../src/pomodoro-controller.js";

function node() {
  return {
    style: {}, listeners: {}, textContent: "",
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append() {}, replaceChildren() {}
  };
}

test("pause/resume keeps one run and reset uses the current clock", (t) => {
  const data = new Map();
  t.mock.method(globalThis, "setInterval", () => 1);
  t.mock.method(globalThis, "clearInterval", () => {});
  for (const key of ["document", "localStorage", "window"]) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    t.after(() => descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]);
  }
  globalThis.document = { createElement: node };
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  globalThis.window = { AudioContext: class { state = "running"; } };
  const elements = new Proxy({}, { get(target, key) { return target[key] ??= node(); } });
  let clock = 1000000;
  const controller = createPomodoroController(elements, { now: () => clock });
  controller.initialize();
  t.after(controller.dispose);
  elements.pomodoroToggle.listeners.click();
  clock += 60000;
  elements.pomodoroToggle.listeners.click();
  clock += 120000;
  elements.pomodoroToggle.listeners.click();
  clock += 30000;
  elements.pomodoroReset.listeners.click();
  const history = JSON.parse(data.get("projectTasks.pomodoroHistory"));
  assert.equal(history.length, 1);
  assert.equal(history[0].outcome, "reset");
  assert.equal(history[0].elapsedSeconds, 90);
  assert.equal(elements.pomodoroTime.textContent, "25:00");
});
