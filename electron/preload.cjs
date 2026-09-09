const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("projectTasks", {
  load: () => ipcRenderer.invoke("projects:load"),
  save: (projects) => ipcRenderer.invoke("projects:save", projects)
});
