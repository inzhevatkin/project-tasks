const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("projectTasks", {
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  setTimerProgress: (state) => ipcRenderer.send("pomodoro:progress", state),
  load: () => ipcRenderer.invoke("projects:load"),
  save: (projects) => ipcRenderer.invoke("projects:save", projects)
});
