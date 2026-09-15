import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspaceStore } from "./workspace-store.js";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isSmokeTest = process.env.PROJECT_TASKS_SMOKE_TEST === "1";
if (isSmokeTest) {
  const testData = mkdtempSync(join(tmpdir(), "project-tasks-smoke-"));
  app.setPath("userData", testData);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  writeFileSync(join(testData, "projects.json"), JSON.stringify({
    version: 2,
    projectTypes: [{ id: "work", name: "Работа" }],
    projects: [{
      id: "smoke-project", name: "Проверочный проект", typeId: "work",
      tasks: [{ id: "smoke-task", title: "Проверочная задача", comment: "", completed: false }]
    }],
    calendarEvents: [{ id: "smoke-event", title: "Утреннее событие", date: today, time: "10:00", annual: false }]
  }));
  app.on("quit", () => {
    try { rmSync(testData, { recursive: true, force: true }); }
    catch (error) { console.warn("Temporary test data cleanup:", error.message); }
  });
} else {
  // Keep user data stable when the visible product name changes.
  app.setPath("userData", join(app.getPath("appData"), "project-tasks"));
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1240, height: 760, minWidth: 940, minHeight: 600,
    backgroundColor: "#f3f5f9", title: "Мои проекты",
    icon: join(currentDirectory, "../assets/icon.png"),
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
              if (!document.querySelector("#daily-agenda-dialog").open
                || !document.querySelector("#daily-agenda-list").textContent.includes("Утреннее событие")) {
                return reject(new Error("Daily agenda was not shown on startup"));
              }
              document.querySelector("#daily-agenda-dialog").close();
              if (!document.querySelector("#project-list").textContent.includes("Проверочный проект")) {
                return reject(new Error("Existing project disappeared during calendar migration"));
              }
              document.querySelector("#show-about").click();
              if (!document.querySelector("#about-dialog").open) return reject(new Error("About dialog failed"));
              if (document.querySelector("#about-version").textContent !== "Версия ${app.getVersion()}") {
                return reject(new Error("Application version was not rendered in About dialog"));
              }
              document.querySelector("#about-dialog").close();
              document.querySelector("#show-statistics").click();
              if (document.querySelector("#statistics-page").hidden) return reject(new Error("Statistics navigation failed"));
              document.querySelector("#show-calendar").click();
              if (document.querySelector("#calendar-page").hidden || !document.querySelector("#calendar-grid").children.length) {
                return reject(new Error("Calendar navigation failed"));
              }
              document.querySelector("#calendar-title").value = "Проверочное событие";
              document.querySelector("#calendar-time").value = "09:15";
              document.querySelector("#calendar-event-form").requestSubmit();
              if (!document.querySelector("#calendar-event-list").textContent.includes("Проверочное событие")) {
                return reject(new Error("Calendar event was not added"));
              }
              if (document.querySelector("#daily-agenda-dialog").open) return reject(new Error("Daily agenda was repeated"));
              document.querySelector("#show-tasks").click();
              const rename = (selector, name) => new Promise((renameResolve, renameReject) => {
                document.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
                document.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
                const dialog = document.querySelector("#rename-dialog");
                if (!dialog.open) return renameReject(new Error("Rename dialog failed"));
                document.querySelector("#rename-input").value = name;
                dialog.querySelector("form").requestSubmit(dialog.querySelector('[value="confirm"]'));
                const renameDeadline = Date.now() + 2000;
                const waitForRename = () => {
                  if (document.body.textContent.includes(name)) return renameResolve();
                  if (Date.now() > renameDeadline) return renameReject(new Error("Rename failed: " + name));
                  setTimeout(waitForRename, 20);
                };
                waitForRename();
              });
              rename("#type-list [data-type-id]", "Новый раздел")
                .then(() => rename("#project-list [data-id]", "Новый проект"))
                .then(() => rename("#task-list [data-id]", "Новая задача"))
                .then(() => {
                  if (document.querySelector("#task-completed").checked) throw new Error("Rename changed task completion");
                  resolve(true);
                }, reject);
              return;
            }
            if (Date.now() > deadline) return reject(new Error("Renderer initialization timed out"));
            setTimeout(check, 50);
          };
          check();
        })`);
        console.log("ProjectTasks modules initialized; calendar, daily agenda, and rename passed");
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
  ipcMain.on("pomodoro:progress", (event, state) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (state === null) {
      window.setProgressBar(-1);
    } else if (state && Number.isFinite(state.progress) && state.progress >= 0 && state.progress <= 1
      && (state.mode === "normal" || state.mode === "paused")) {
      window.setProgressBar(state.progress, { mode: state.mode });
    }
  });
  ipcMain.handle("app:info", () => ({
    description: "Кроссплатформенный менеджер проектов и задач",
    version: app.getVersion()
  }));
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
