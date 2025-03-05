const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webAuthn: true, // Enable WebAuthn for passkey support
    },
  });

  // Add these security-related settings
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Window open requested for URL:", url);
    // Allow Google OAuth popup, callback, and WebAuthn/passkey URLs
    if (
      url.startsWith("https://accounts.google.com") ||
      url.startsWith("http://localhost:3000/auth/google") ||
      url.startsWith("http://localhost:3000/auth/google/callback") ||
      url.startsWith("webauthn://") ||
      url.startsWith("http://localhost:5173")
    ) {
      console.log("Allowing window open for:", url);
      return { action: "allow" };
    }
    console.log("Denying window open for:", url);
    return { action: "deny" };
  });

  // Add event listener for navigation
  win.webContents.on("will-navigate", (event, url) => {
    console.log("Navigation requested to:", url);
    if (url.includes("/auth/google/callback")) {
      console.log("Intercepting OAuth callback URL");
      // Prevent the default navigation
      event.preventDefault();
      // Load the main application URL
      win.loadURL("http://localhost:5173");
    }
  });

  win.loadURL("http://localhost:5173"); // Vite's default port
}

app.whenReady().then(() => {
  createWindow();

  // Handle save audio file request
  ipcMain.handle("save-audio-file", async (event, { buffer, filename }) => {
    try {
      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: "Save Recording",
        defaultPath: path.join(app.getPath("downloads"), filename),
        filters: [
          { name: "Audio Files", extensions: ["webm", "mp3", "wav"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (canceled || !filePath) {
        return null;
      }

      // Convert ArrayBuffer to Buffer
      const fileBuffer = Buffer.from(buffer);

      // Write file to disk
      fs.writeFileSync(filePath, fileBuffer);

      return filePath;
    } catch (error) {
      console.error("Error saving audio file:", error);
      return null;
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
