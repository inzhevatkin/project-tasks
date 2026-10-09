import { app, BrowserWindow } from "electron";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { acquireSingleInstance, focusWindow } from "../electron/single-instance.js";

// Run with: electron scripts/smoke-single-instance.mjs
// Never acquire the installed application's lock or touch its data.
const secondary = Boolean(process.env.TIM_SINGLE_INSTANCE_SMOKE_DATA);
const dataDirectory = process.env.TIM_SINGLE_INSTANCE_SMOKE_DATA
  || mkdtempSync(join(tmpdir(), "tim-single-instance-"));
app.setPath("userData", dataDirectory);
let window;
let activations = 0;
const primary = acquireSingleInstance({ app, activate: () => {
  focusWindow(window);
  activations++;
} });

if (secondary && primary) {
  console.error("Secondary process acquired the primary lock");
  app.exit(1);
} else if (primary) {
  runSmoke();
}

async function runSmoke() {
  const children = new Set();
  const watchdog = setTimeout(() => {
    console.error("Single-instance smoke timed out");
    app.exit(1);
  }, 30000);
  app.on("quit", () => {
    clearTimeout(watchdog);
    for (const child of children) child.kill();
    try { rmSync(dataDirectory, { recursive: true, force: true }); }
    catch (error) { console.warn("Temporary test data cleanup:", error.message); }
  });
  await app.whenReady();
  try {
    window = new BrowserWindow({ width: 500, height: 300, title: "TiM — single-instance test" });
    await window.loadURL("data:text/html,<title>TiM test</title><p>Single instance</p>");
    await window.webContents.executeJavaScript("window.testState = { task: 'Unchanged task', timerDeadline: 123456789 }; true");
    for (const mode of ["visible", "minimized", "hidden"]) {
      if (mode === "minimized") window.minimize();
      if (mode === "hidden") window.hide();
      if (mode === "minimized") {
        const deadline = Date.now() + 5000;
        while (!window.isMinimized() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 50));
        assert.equal(window.isMinimized(), true);
      }
      const before = activations;
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url)], {
        env: { ...process.env, TIM_SINGLE_INSTANCE_SMOKE_DATA: dataDirectory },
        stdio: ["ignore", "pipe", "pipe"], windowsHide: true
      });
      children.add(child);
      let output = "";
      child.stdout.on("data", (chunk) => { output += chunk; });
      child.stderr.on("data", (chunk) => { output += chunk; });
      const code = await new Promise((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", resolve);
      });
      children.delete(child);
      assert.equal(code, 0, output);
      const deadline = Date.now() + 5000;
      while ((activations === before || !window.isFocused() || window.isMinimized()) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      assert.equal(activations, before + 1, mode);
      assert.equal(BrowserWindow.getAllWindows().length, 1, mode);
      assert.equal(window.isMinimized(), false, mode);
      assert.equal(window.isVisible(), true, mode);
      assert.equal(window.isFocused(), true, mode);
      assert.deepEqual(await window.webContents.executeJavaScript("window.testState"), {
        task: "Unchanged task", timerDeadline: 123456789
      });
    }
    console.log("Single-instance smoke passed: repeat launches focus visible, minimized and hidden windows without resetting state");
    app.quit();
  } catch (error) {
    console.error(error);
    app.exit(1);
  }
}
