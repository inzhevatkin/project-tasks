import test from "node:test";
import assert from "node:assert/strict";
import { initializeSettings } from "../src/ui/settings.js";

test("applying language saves before reload; save failure or active update prevents a language change", async () => {
  for (const scenario of ["success", "save-failure", "updating"]) {
    const handlers = {};
    const calls = [];
    const elements = Object.fromEntries(["showSettings", "settingsCancel", "settingsForm"].map((name) => [name, {
      addEventListener: (event, callback) => { handlers[name] = callback; }
    }]));
    Object.assign(elements, {
      settingsDialog: { open: false, showModal() { this.open = true; }, close() { this.open = false; } },
      appLanguage: {}, settingsError: {}, settingsSave: {}
    });
    const previousWindow = globalThis.window;
    try {
      globalThis.window = { projectTasks: { setLanguage: async (locale) => { calls.push(locale); } } };
      initializeSettings(elements, {
        saveWorkspace: async () => { calls.push("save"); if (scenario === "save-failure") throw new Error("Disk unavailable"); },
        reload: () => calls.push("reload"), canChange: () => scenario !== "updating"
      });
      handlers.showSettings();
      assert.equal(elements.settingsDialog.open, true);
      assert.equal(elements.appLanguage.value, "ru");
      elements.appLanguage.value = "en";
      await handlers.settingsForm({ preventDefault() {} });
      assert.deepEqual(calls, scenario === "success" ? ["save", "en", "reload"] : scenario === "save-failure" ? ["save"] : []);
      assert.equal(elements.settingsError.hidden, scenario === "success");
      assert.equal(elements.settingsSave.disabled, false);
      assert.equal(elements.settingsCancel.disabled, false);
    } finally {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
    }
  }
});
