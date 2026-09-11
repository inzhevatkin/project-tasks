import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspaceStore } from "./workspace-store.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isSmokeTest = process.env.PROJECT_TASKS_SMOKE_TEST === "1";
if (isSmokeTest) {
  const testData = mkdtempSync(join(tmpdir(), "project-tasks-smoke-"));
  app.setPath("userData", testData);
  app.on("quit", () => {
    try { rmSync(testData, { recursive: true, force: true }); }
    catch (error) { console.warn("Temporary test data cleanup:", error.message); }
  });
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1240, height: 760, minWidth: 940, minHeight: 600,
    backgroundColor: "#f3f5f9", title: "Мои проекты",
    webPreferences: {
      preload: join(currentDirectory, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  window.loadFile(join(currentDirectory, "../src/index.html"));
  if (isSmokeTest) {
    window.webContents.once("did-finish-load", async () => {
      try {
        await window.webContents.executeJavaScript(`new Promise((resolve, reject) => {
          const deadline = Date.now() + 5000;
          const check = () => {
            if (document.documentElement.dataset.ready === "true") {
              if (document.querySelector("#app-version").textContent !== "Версия ${app.getVersion()}") {
                return reject(new Error("Application version was not rendered"));
              }
              document.querySelector("#show-statistics").click();
              if (document.querySelector("#statistics-page").hidden) return reject(new Error("Statistics navigation failed"));
              document.querySelector("#show-tasks").click();
              return resolve(true);
            }
            if (Date.now() > deadline) return reject(new Error("Renderer initialization timed out"));
            setTimeout(check, 50);
          };
          check();
        })`);
        console.log("ProjectTasks modules initialized; page navigation passed");
        app.quit();
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
  }
}

app.whenReady().then(() => {
  const store = createWorkspaceStore(join(app.getPath("userData"), "projects.json"));
  ipcMain.handle("app:info", () => ({ version: app.getVersion() }));
  ipcMain.handle("projects:load", () => store.load());
  ipcMain.handle("projects:save", (_event, workspace) => store.save(workspace));
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
