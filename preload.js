/**
 * The preload script runs before `index.html` is loaded
 * in the renderer. It has access to web APIs as well as
 * Electron's renderer process modules and some polyfilled
 * Node.js functions.
 *
 * https://www.electronjs.org/docs/latest/tutorial/sandbox
 */
const { ipcRenderer, contextBridge, ipcMain } = require("electron");

const WINDOW_API = {
    GetDevice: () => ipcRenderer.invoke("get/device"),
    SetDevice: (setting) => ipcRenderer.invoke("set/device", setting),
    ResetDevice: () => ipcRenderer.invoke("reset/device")
}
contextBridge.exposeInMainWorld("api", WINDOW_API);
