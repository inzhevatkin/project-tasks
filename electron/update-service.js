// Keep the update lifecycle independent of Electron so downloads, retries and
// installation can be verified without downloading or launching an installer.
export function createUpdateService({ updater, enabled, onState = () => {}, scheduleInstall = setImmediate }) {
  let downloaded = false;
  let downloadPromise = null;
  let state = {
    status: enabled ? "checking" : "unavailable", version: null, progress: 0,
    downloaded: false, canRetry: false
  };
  const publish = (next) => {
    state = { ...state, ...next, downloaded };
    onState(state);
  };
  const fail = (error) => publish({
    status: "error", error: error?.message ?? String(error), canRetry: Boolean(state.version)
  });

  if (enabled) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.on("update-available", (info) => publish({
      status: "available", version: info.version, progress: 0, error: null, canRetry: false
    }));
    updater.on("update-not-available", () => publish({ status: "current", version: null, error: null, canRetry: false }));
    updater.on("download-progress", (progress) => {
      if (state.status === "downloading") publish({ progress: Math.round(progress.percent) });
    });
    updater.on("update-downloaded", (info) => {
      downloaded = true;
      publish({ status: "ready", version: info.version, progress: 100, error: null, canRetry: false });
    });
    updater.on("error", fail);
  }

  return {
    getState: () => ({ ...state }),
    async check() {
      if (!enabled || downloadPromise || downloaded || state.status === "installing") return;
      publish({ status: "checking", error: null, canRetry: false });
      try { await updater.checkForUpdates(); }
      catch (error) { fail(error); }
    },
    async download() {
      if (!enabled) throw new Error("Обновления доступны в установленной версии Windows");
      if (downloaded) return { ...state };
      if (downloadPromise) return downloadPromise;
      if (state.status !== "available" && !(state.status === "error" && state.canRetry)) {
        throw new Error("Обновлений пока нет");
      }
      publish({ status: "downloading", progress: 0, error: null, canRetry: false });
      downloadPromise = (async () => {
        try {
          // The initial yield also makes synchronous download errors safe to retry.
          await Promise.resolve().then(() => updater.downloadUpdate());
          if (!downloaded) throw new Error("Загрузка обновления не завершена");
          return { ...state };
        } catch (error) {
          fail(error);
          throw error;
        } finally {
          downloadPromise = null;
        }
      })();
      return downloadPromise;
    },
    install() {
      if (!enabled || !downloaded) throw new Error("Загрузка обновления не завершена");
      if (state.status === "installing") return;
      publish({ status: "installing", error: null, canRetry: false });
      scheduleInstall(() => {
        try { updater.quitAndInstall(true, true); }
        catch (error) { fail(error); }
      });
    }
  };
}
