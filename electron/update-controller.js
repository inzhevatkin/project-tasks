import { app, BrowserWindow, ipcMain } from "electron";
import updaterPackage from "electron-updater";

const { autoUpdater } = updaterPackage;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function initializeUpdates() {
  let state = { status: "unavailable", version: null, progress: 0, message: "Обновления доступны в установленной версии Windows" };
  const publish = (next) => {
    state = { ...state, ...next };
    for (const window of BrowserWindow.getAllWindows()) window.webContents.send("updates:state", state);
  };
  ipcMain.handle("updates:state", () => state);
  ipcMain.handle("updates:install", async () => {
    if (state.status === "ready") {
      publish({ status: "installing", message: "Установка обновления…" });
      setImmediate(() => autoUpdater.quitAndInstall(false, true));
      return;
    }
    if (state.status !== "available") return;
    publish({ status: "downloading", progress: 0, message: "Загрузка обновления…" });
    try { await autoUpdater.downloadUpdate(); }
    catch (error) { publish({ status: "error", error: error.message, message: `Не удалось загрузить обновление: ${error.message}` }); }
  });
  if (!app.isPackaged || process.platform !== "win32" || process.env.PROJECT_TASKS_SMOKE_TEST === "1") return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.on("update-available", (info) => publish({ status: "available", version: info.version, message: `Доступна версия ${info.version}` }));
  autoUpdater.on("update-not-available", () => publish({ status: "current", version: null, message: "Установлена последняя версия" }));
  autoUpdater.on("download-progress", (progress) => publish({ status: "downloading", progress: Math.round(progress.percent), message: `Загрузка: ${Math.round(progress.percent)} %` }));
  autoUpdater.on("update-downloaded", (info) => publish({ status: "ready", version: info.version, progress: 100, message: `Версия ${info.version} готова к установке` }));
  autoUpdater.on("error", (error) => publish({ status: "error", error: error.message, message: `Ошибка обновления: ${error.message}` }));

  async function check() {
    if (state.status === "downloading" || state.status === "ready" || state.status === "installing") return;
    publish({ status: "checking", message: "Проверка обновлений…" });
    try { await autoUpdater.checkForUpdates(); }
    catch (error) { publish({ status: "error", error: error.message, message: `Не удалось проверить обновления: ${error.message}` }); }
  }
  setTimeout(check, 3000).unref();
  setInterval(check, CHECK_INTERVAL_MS).unref();
}
