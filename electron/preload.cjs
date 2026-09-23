const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("projectTasks", {
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  getUpdateState: () => ipcRenderer.invoke("updates:state"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateState: (listener) => {
    const handler = (_event, state) => listener(state);
    ipcRenderer.on("updates:state", handler);
    return () => ipcRenderer.removeListener("updates:state", handler);
  },
  setTimerProgress: (state) => ipcRenderer.send("pomodoro:progress", state),
  load: () => ipcRenderer.invoke("projects:load"),
  save: (projects) => ipcRenderer.invoke("projects:save", projects)
});
