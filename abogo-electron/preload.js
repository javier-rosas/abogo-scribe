// preload.js
// Expose Electron APIs to the renderer process

const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script executing...");

// Expose specific Electron APIs to the renderer process
contextBridge.exposeInMainWorld("electron", {
  // Function to save audio file
  saveAudioFile: (data) => ipcRenderer.invoke("save-audio-file", data),
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // Auth token functions
  getAuthToken: async () => {
    console.log("Renderer requesting auth token from main process");
    return ipcRenderer.invoke("get-auth-token");
  },

  // Add listener for auth token direct IPC
  onAuthToken: (callback) => {
    console.log("Registering auth token callback");

    // Listen for direct messages from main
    ipcRenderer.on("auth-token-received", (_, token) => {
      console.log("Preload: Received auth-token-received event");
      callback(token);
    });
  },

  // Add this new method to clear the token
  clearAuthToken: () => ipcRenderer.invoke("clear-auth-token"),
});

console.log("Preload script completed setup");

// Also set up listener before contextBridge
ipcRenderer.on("auth-token-received", (_, token) => {
  console.log("Preload: Direct ipcRenderer listener caught auth token event");
});
