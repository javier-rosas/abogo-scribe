const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const url = require("url");

// Store the auth token globally
let authToken = null;

// Add at the top of your file, we'll create a global reference to the main window
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
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
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Allow Google OAuth popup, callback, and WebAuthn/passkey URLs
    if (
      url.startsWith("https://accounts.google.com") ||
      url.startsWith("http://localhost:3000/auth/google") ||
      url.startsWith("http://localhost:3000/auth/google/callback") ||
      url.startsWith("webauthn://") ||
      url.startsWith("http://localhost:5173")
    ) {
      return { action: "allow" };
    }
    return { action: "deny" };
  });

  // Add event listener for navigation
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.includes("/auth/google/callback")) {
      // Prevent the default navigation
      event.preventDefault();
      // Load the main application URL
      mainWindow.loadURL("http://localhost:5173");
    }
  });

  mainWindow.loadURL("http://localhost:5173"); // Vite's default port

  // If we already have an auth token when the window is created, send it immediately
  if (authToken) {
    mainWindow.webContents.on("did-finish-load", () => {
      mainWindow.webContents.send("auth-token-received", authToken);
    });
  }

  return mainWindow;
}

// Register custom protocol handler
app.setAsDefaultProtocolClient("abogo");

// Add this after app.whenReady() but before other ipcMain handlers
// Handle deep linking
app.on("second-instance", (event, commandLine, workingDirectory) => {
  // The last item in the commandLine array should be our URL
  const deepLink = commandLine.pop();
  if (deepLink && deepLink.startsWith("abogo://")) {
    handleDeepLink(deepLink);
  }
});

// Handle deep links in macOS (different from Windows/Linux)
app.on("open-url", (event, deepLink) => {
  event.preventDefault();
  handleDeepLink(deepLink);
});

// Handle deep links - simplified and more robust
function handleDeepLink(deepLink) {
  try {
    // Parse the URL to extract the token
    const parsedUrl = new URL(deepLink);

    // Get the token from the search params
    const token = parsedUrl.searchParams.get("token");

    if (token) {
      // Store the token globally so it's available for new windows
      authToken = token;

      // Send to all existing windows
      BrowserWindow.getAllWindows().forEach((win) => {
        win.webContents.send("auth-token-received", token);
      });
    }
  } catch (error) {
    // Error handling is preserved but without console.error
  }
}

app.whenReady().then(() => {
  // Create the main window
  const mainWindow = createWindow();

  // CRITICAL: Register the get-auth-token handler
  ipcMain.handle("get-auth-token", () => {
    return authToken;
  });

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
      return null;
    }
  });

  // Add this handler for opening URLs in external browser
  ipcMain.handle("open-external", async (event, url) => {
    return shell.openExternal(url);
  });

  // Add the handler for clearing the auth token
  ipcMain.handle("clear-auth-token", () => {
    authToken = null;
    return true;
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
