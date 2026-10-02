import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createWorkspaceStore } from "./workspace-store.js";
import { initializeUpdates } from "./update-controller.js";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isSmokeTest = process.env.PROJECT_TASKS_SMOKE_TEST === "1";
let quitting = false;
app.on("before-quit", () => { quitting = true; });
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
      tasks: [{ id: "smoke-task", title: "Проверочная задача", comment: "first\n**bold** and *italic* <img src=x>", completed: false }]
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
    backgroundColor: "#f3f5f9", title: "TiM",
    icon: join(currentDirectory, "../assets/icon.png"),
    webPreferences: {
      preload: join(currentDirectory, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  window.loadFile(join(currentDirectory, "../src/index.html"));
  let closeReady = false;
  let closePending = false;
  let closeAllowed = false;
  const rendererReady = (event) => {
    if (event.sender === window.webContents) closeReady = true;
  };
  const finishClose = (event, saved) => {
    if (event.sender !== window.webContents || !closePending) return;
    closePending = false;
    if (saved !== true) return;
    closeAllowed = true;
    if (quitting) app.quit();
    else window.close();
  };
  ipcMain.on("app:renderer-ready", rendererReady);
  ipcMain.on("app:close-result", finishClose);
  window.on("close", (event) => {
    if (!closeReady || closeAllowed || window.webContents.isDestroyed()) return;
    event.preventDefault();
    if (closePending) return;
    closePending = true;
    window.webContents.send("app:before-close");
  });
  window.webContents.on("render-process-gone", () => { closeReady = false; });
  window.webContents.on("did-start-loading", () => { closeReady = false; });
  window.on("closed", () => {
    ipcMain.removeListener("app:renderer-ready", rendererReady);
    ipcMain.removeListener("app:close-result", finishClose);
  });
  if (isSmokeTest) {
    const smokeLocale = ["ru", "en", "zh"].includes(process.env.PROJECT_TASKS_SMOKE_LOCALE)
      ? process.env.PROJECT_TASKS_SMOKE_LOCALE : "ru";
    const versionLabel = { ru: "Версия", en: "Version", zh: "版本" }[smokeLocale];
    const tasksLabel = { ru: "Задачи", en: "Tasks", zh: "任务" }[smokeLocale];
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
              if (document.title !== "TiM"
                || document.querySelector("#about-dialog .eyebrow").textContent !== "TiM"
                || document.documentElement.lang !== "${smokeLocale === "zh" ? "zh-CN" : smokeLocale}"
                || document.querySelector("#show-tasks").textContent !== "${tasksLabel}"
                || document.querySelector("#about-version").textContent !== "${versionLabel} ${app.getVersion()}") {
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
                  try {
                    if (document.querySelector("#task-status").value !== "pending") throw new Error("Rename changed task state");
                    const editor = document.querySelector("#task-comment");
                    if (document.querySelector("#comment-preview") || editor.querySelector("strong")?.textContent !== "bold"
                      || editor.querySelector("em")?.textContent !== "italic"
                      || editor.querySelector("img") || !editor.textContent.includes("<img src=x>")) {
                      throw new Error("Existing comment was not rendered safely in the editor");
                    }
                    editor.textContent = "alpha beta";
                    editor.dispatchEvent(new Event("input", { bubbles: true }));
                    editor.focus();
                    const range = document.createRange();
                    range.setStart(editor.firstChild, 6);
                    range.setEnd(editor.firstChild, 10);
                    const selection = window.getSelection();
                    selection.removeAllRanges();
                    selection.addRange(range);
                    document.querySelector('[data-comment-format="bold"]').click();
                    if (editor.querySelector("b, strong")?.textContent !== "beta") {
                      throw new Error("Bold toolbar action failed");
                    }
                    document.querySelector('[data-comment-format="circle-list"]').click();
                    if (!editor.querySelector('ul[data-marker="circle"]')) throw new Error("Circle list action failed");
                    document.querySelector('[data-comment-format="square-list"]').click();
                    if (!editor.querySelector('ul[data-marker="square"]')) throw new Error("Square list action failed");
                    document.querySelector("#project-list [data-id]").click();
                    if (editor.querySelector('ul[data-marker="square"]')?.textContent !== "alpha beta"
                      || editor.querySelector("strong")?.textContent !== "beta") {
                      throw new Error("Formatted comment was not preserved after rerender");
                    }
                    const setStatus = (value) => {
                      const status = document.querySelector("#task-status");
                      status.value = value;
                      status.dispatchEvent(new Event("change", { bubbles: true }));
                    };
                    setStatus("in_progress");
                    if (document.querySelector("#current-work")
                      || !document.querySelector("#task-list .in-progress")) throw new Error("Task state failed or removed work panel is still present");
                    document.querySelector("#task-input").value = "Вторая задача дневника";
                    document.querySelector("#task-form").requestSubmit();
                    setStatus("in_progress");
                    if (document.querySelectorAll("#task-list .in-progress").length !== 1
                      || !document.querySelector("#task-list .in-progress").textContent.includes("Вторая задача дневника")) {
                      throw new Error("Switching the working task failed");
                    }
                    setStatus("completed");
                    if (document.querySelector("#task-list .in-progress")) throw new Error("Completed task stayed in progress");
                    setStatus("pending");
                    document.querySelector("#show-journal").click();
                    const journal = document.querySelector("#journal-list");
                    const actions = [...journal.querySelectorAll(".journal-entry")].map((row) => row.dataset.action);
                    if (document.querySelector("#journal-page").hidden || actions.length !== 6
                      || !["created", "started", "paused", "completed", "reopened"].every((action) => actions.includes(action))
                      || !journal.querySelector("time[datetime]")) throw new Error("Diary transitions or dated entries failed");
                    const search = document.querySelector("#journal-search");
                    search.value = "Новая задача";
                    search.dispatchEvent(new Event("input", { bubbles: true }));
                    if (journal.querySelectorAll(".journal-entry").length !== 2) throw new Error("Diary search failed");
                    document.querySelector("#journal-to").value = "2000-01-01";
                    document.querySelector("#journal-to").dispatchEvent(new Event("input", { bubbles: true }));
                    if (journal.children.length || document.querySelector("#journal-no-results").hidden) throw new Error("Diary date filter failed");
                    document.querySelector("#journal-reset").click();
                    journal.querySelector("[data-task-id]").click();
                    if (document.querySelector("#tasks-page").hidden
                      || document.querySelector("#task-title").value !== "Вторая задача дневника") throw new Error("Opening a diary task failed");
                    // Quit immediately after a status change, before the debounce
                    // timer can save. The close guard must persist this entry.
                    setStatus("in_progress");
                    resolve(true);
                  } catch (error) { reject(error); }
                }, reject);
              return;
            }
            if (Date.now() > deadline) return reject(new Error("Renderer initialization timed out"));
            setTimeout(check, 50);
          };
          check();
        })`);
        if (process.env.PROJECT_TASKS_SMOKE_SCREENSHOT) {
          window.setSize(940, 760);
          await window.webContents.executeJavaScript('document.querySelector("#show-journal").click(); new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
          writeFileSync(process.env.PROJECT_TASKS_SMOKE_SCREENSHOT, (await window.webContents.capturePage()).toPNG());
        }
        app.once("will-quit", () => {
          try {
            const saved = JSON.parse(readFileSync(join(app.getPath("userData"), "projects.json"), "utf8"));
            const task = saved.projects[0].tasks.find((item) => item.title === "Вторая задача дневника");
            if (saved.version !== 4 || task?.status !== "in_progress"
              || saved.taskJournal.length !== 7 || saved.taskJournal.at(-1).action !== "started"
              || saved.projects[0].tasks[0].comment !== "+ alpha **beta**"
              || saved.calendarEvents.length !== 2) throw new Error("Closing the app lost journal or workspace data");
            console.log("ProjectTasks smoke passed: calendar, comments, task states, diary filters, and save before quit");
          } catch (error) {
            console.error(error);
            app.exit(1);
          }
        });
        app.quit();
      } catch (error) {
        console.error(error);
        app.exit(1);
      }
    });
  }
}

app.whenReady().then(() => {
  let locale = isSmokeTest && ["ru", "en", "zh"].includes(process.env.PROJECT_TASKS_SMOKE_LOCALE)
    ? process.env.PROJECT_TASKS_SMOKE_LOCALE : "ru";
  if (!isSmokeTest) {
    try {
      const saved = readFileSync(join(app.getPath("userData"), "installer-language.txt"), "utf8").trim();
      locale = ["ru", "en", "zh"].includes(saved) ? saved : "ru";
    } catch {
      const systemLocale = app.getLocale().toLowerCase();
      locale = systemLocale.startsWith("zh") ? "zh" : systemLocale.startsWith("en") ? "en" : "ru";
    }
  }
  initializeUpdates();
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
    version: app.getVersion(), locale
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
