import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { acquireSingleInstance, focusWindow } from "../electron/single-instance.js";

function fakeApp(ownsLock) {
  const app = new EventEmitter();
  app.requestSingleInstanceLock = () => ownsLock;
  app.quitCalls = 0;
  app.quit = () => { app.quitCalls++; };
  app.whenReady = () => Promise.resolve();
  return app;
}

test("a second process quits without registering activation or starting the app", () => {
  const app = fakeApp(false);
  let started = false;
  if (acquireSingleInstance({ app, activate: () => assert.fail("Secondary process activated") })) started = true;
  assert.equal(started, false);
  assert.equal(app.quitCalls, 1);
  assert.equal(app.listenerCount("second-instance"), 0);
});

test("repeat launches activate the primary only after startup is ready", async () => {
  const app = fakeApp(true);
  let ready;
  const pending = new Promise((resolve) => { ready = resolve; });
  app.whenReady = () => pending;
  let activations = 0;
  assert.equal(acquireSingleInstance({ app, activate: () => { activations++; } }), true);
  app.emit("second-instance");
  assert.equal(activations, 0);
  ready();
  await pending;
  assert.equal(activations, 1);
  app.emit("second-instance");
  await Promise.resolve();
  assert.equal(activations, 2);
  assert.equal(app.quitCalls, 0);
});

test("existing windows are shown and focused, and minimized windows are restored first", () => {
  for (const minimized of [false, true]) {
    const calls = [];
    const window = {
      isDestroyed: () => false,
      isMinimized: () => minimized,
      restore: () => calls.push("restore"),
      show: () => calls.push("show"),
      focus: () => calls.push("focus")
    };
    focusWindow(window);
    assert.deepEqual(calls, minimized ? ["restore", "show", "focus"] : ["show", "focus"]);
  }
  focusWindow(null);
  focusWindow({ isDestroyed: () => true });
});
