const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("workbuddyDesktop", {
  platform: "electron",
  hide: () => ipcRenderer.invoke("workbuddy:hide"),
  show: () => ipcRenderer.invoke("workbuddy:show"),
  center: () => ipcRenderer.invoke("workbuddy:center"),
  registerShortcut: (name, accelerator) =>
    ipcRenderer.invoke("workbuddy:register-shortcut", name, accelerator),
  unregisterShortcut: (accelerator) =>
    ipcRenderer.invoke("workbuddy:unregister-shortcut", accelerator),
  getApiKey: (provider) => ipcRenderer.invoke("workbuddy:get-api-key", provider),
  setApiKey: (provider, apiKey) => ipcRenderer.invoke("workbuddy:set-api-key", provider, apiKey),
  deleteApiKey: (provider) => ipcRenderer.invoke("workbuddy:delete-api-key", provider),
  onShortcut: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("workbuddy:shortcut", listener);
    return () => ipcRenderer.removeListener("workbuddy:shortcut", listener);
  },
  onTray: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("workbuddy:tray", listener);
    return () => ipcRenderer.removeListener("workbuddy:tray", listener);
  },
});
