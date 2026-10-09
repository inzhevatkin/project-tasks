const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("projectTasks", {
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  setTheme: (theme) => ipcRenderer.invoke("app:theme", theme),
  setLanguage: (locale) => ipcRenderer.invoke("app:language", locale),
  onOpenSettings: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("app:settings", handler);
    return () => ipcRenderer.removeListener("app:settings", handler);
  },
  onOpenAbout: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("app:about", handler);
    return () => ipcRenderer.removeListener("app:about", handler);
  },
  getUpdateState: () => ipcRenderer.invoke("updates:state"),
  downloadUpdate: () => ipcRenderer.invoke("updates:download"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("updates:state", handler);
    return () => ipcRenderer.removeListener("updates:state", handler);
  },
  setTimerProgress: (state) => ipcRenderer.send("pomodoro:progress", state),
  onBeforeClose: (listener) => {
    const handler = () => listener();
    ipcRenderer.on("app:before-close", handler);
    return () => ipcRenderer.removeListener("app:before-close", handler);
  },
  rendererReady: () => ipcRenderer.send("app:renderer-ready"),
  finishClose: (saved) => ipcRenderer.send("app:close-result", saved === true),
  load: () => ipcRenderer.invoke("projects:load"),
  save: (projects) => ipcRenderer.invoke("projects:save", projects)
});
