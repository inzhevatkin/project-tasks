import test from "node:test";
import assert from "node:assert/strict";
import { initializeNativeTheme } from "../electron/theme-controller.js";
import { initializeTheme } from "../src/ui/theme.js";

test("native window theme follows explicit dark/light choices and rejects invalid requests", () => {
  let handler;
  const colors = [];
  const nativeTheme = { themeSource: "system" };
  const sender = {};
  const window = { setBackgroundColor: (color) => colors.push(color) };
  initializeNativeTheme({
    ipcMain: { handle: (channel, callback) => { assert.equal(channel, "app:theme"); handler = callback; } },
    nativeTheme,
    BrowserWindow: { fromWebContents: (contents) => contents === sender ? window : null, getAllWindows: () => [window] }
  });
  assert.equal(handler({ sender }, "dark"), "dark");
  assert.equal(nativeTheme.themeSource, "dark");
  assert.equal(handler({ sender }, "light"), "light");
  assert.equal(nativeTheme.themeSource, "light");
  assert.deepEqual(colors, ["#11131a", "#f3f5f9"]);
  for (const value of ["system", "invalid", null, {}, "__proto__"]) assert.throws(() => handler({ sender }, value));
  assert.throws(() => handler({ sender: {} }, "dark"));
  assert.equal(nativeTheme.themeSource, "light");
  assert.equal(colors.length, 2);
});

test("saved theme and toggles synchronize content and native window, independently of OS theme", async () => {
  for (const [saved, systemDark, expected] of [["dark", false, "dark"], ["light", true, "light"], [null, true, "dark"], ["invalid", false, "light"]]) {
    const storage = new Map(saved ? [["projectTasks.theme", saved]] : []);
    const calls = [];
    let click;
    const label = { textContent: "" };
    const attributes = {};
    const themeToggle = {
      querySelector: () => label,
      setAttribute: (name, value) => { attributes[name] = value; },
      addEventListener: (name, handler) => { assert.equal(name, "click"); click = handler; }
    };
    const previous = { document: globalThis.document, window: globalThis.window, localStorage: globalThis.localStorage };
    try {
      globalThis.document = { documentElement: { dataset: {} } };
      globalThis.localStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
      globalThis.window = { matchMedia: () => ({ matches: systemDark }), projectTasks: { setTheme: async (theme) => { calls.push(theme); } } };
      await initializeTheme({ themeToggle });
      assert.equal(document.documentElement.dataset.theme, expected);
      assert.deepEqual(calls, [expected]);
      const next = expected === "dark" ? "light" : "dark";
      await click();
      assert.equal(document.documentElement.dataset.theme, next);
      assert.equal(storage.get("projectTasks.theme"), next);
      assert.equal(label.textContent, next === "dark" ? "☀️" : "🌙");
      assert.equal(themeToggle.title, attributes["aria-label"]);
      await click();
      assert.deepEqual(calls, [expected, next, expected]);
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
      }
    }
  }
});
