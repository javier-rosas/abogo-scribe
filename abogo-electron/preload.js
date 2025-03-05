// preload.js
// Expose Electron APIs to the renderer process

const { contextBridge, ipcRenderer } = require("electron");

// Expose specific Electron APIs to the renderer process
contextBridge.exposeInMainWorld("electron", {
  // Function to save audio file
  saveAudioFile: (data) => ipcRenderer.invoke("save-audio-file", data),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // Auth token functions
  getAuthToken: async () => {
    return ipcRenderer.invoke("get-auth-token");
  },

  // Add listener for auth token direct IPC
  onAuthToken: (callback) => {
    ipcRenderer.on("auth-token-received", (_, token) => {
      callback(token);
    });
  },

  // Add this new method to clear the token
  clearAuthToken: () => ipcRenderer.invoke("clear-auth-token"),
});

// Also set up listener before contextBridge
ipcRenderer.on("auth-token-received", (_, token) => {
  // Listener remains but console.log removed
});
