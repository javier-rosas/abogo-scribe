// preload.js
// Expose Electron APIs to the renderer process

const { contextBridge, ipcRenderer } = require("electron");

// Expose specific Electron APIs to the renderer process
contextBridge.exposeInMainWorld("electron", {
  // Function to save audio file
  saveAudioFile: (options) => {
    return ipcRenderer.invoke("save-audio-file", options);
  },
});
