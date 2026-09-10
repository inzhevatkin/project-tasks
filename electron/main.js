import { app, BrowserWindow, ipcMain } from "electron";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const isSmokeTest = process.env.PROJECT_TASKS_SMOKE_TEST === "1";

function dataPath() {
  return join(app.getPath("userData"), "projects.json");
}

async function loadProjects() {
  try {
    return JSON.parse(await readFile(dataPath(), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Не удалось загрузить данные:", error);
    return [];
  }
}

async function saveProjects(_event, workspace) {
  if (!workspace || !Array.isArray(workspace.projectTypes) || !Array.isArray(workspace.projects)) {
    throw new TypeError("Ожидались типы проектов и список проектов");
  }
  const target = dataPath();
  const temporary = `${target}.tmp`;
  await mkdir(dirname(target), { recursive: true });
  await writeFile(temporary, JSON.stringify(workspace, null, 2), "utf8");
  await rename(temporary, target);
  return true;
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
    window.webContents.once("did-finish-load", () => {
      console.log("ProjectTasks UI loaded successfully");
      app.quit();
    });
  }
}

app.whenReady().then(() => {
  ipcMain.handle("projects:load", loadProjects);
  ipcMain.handle("projects:save", saveProjects);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
