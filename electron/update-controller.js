import { app, BrowserWindow, ipcMain } from "electron";
import updaterPackage from "electron-updater";
import { createUpdateService } from "./update-service.js";

const { autoUpdater } = updaterPackage;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function initializeUpdates() {
  const enabled = app.isPackaged && process.platform === "win32" && process.env.PROJECT_TASKS_SMOKE_TEST !== "1";
  const service = createUpdateService({
    updater: autoUpdater, enabled,
    onState(state) {
      for (const window of BrowserWindow.getAllWindows()) window.webContents.send("updates:state", state);
    }
  });
  ipcMain.handle("updates:state", () => service.getState());
  ipcMain.handle("updates:download", () => service.download());
  ipcMain.handle("updates:install", () => service.install());
  if (!enabled) return;
  setTimeout(() => service.check(), 3000).unref();
  setInterval(() => service.check(), CHECK_INTERVAL_MS).unref();
}
