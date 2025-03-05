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
  mainWindow.webContents.on("will-navigate", (event, url) => {
    console.log("Navigation requested to:", url);
    if (url.includes("/auth/google/callback")) {
      console.log("Intercepting OAuth callback URL");
      // Prevent the default navigation
      event.preventDefault();
      // Load the main application URL
      mainWindow.loadURL("http://localhost:5173");
    }
  });

  mainWindow.loadURL("http://localhost:5173"); // Vite's default port

  // If we already have an auth token when the window is created, send it immediately
  if (authToken) {
    console.log("Window created, sending stored auth token");
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
  console.log("Received second-instance event with command line:", commandLine);

  // The last item in the commandLine array should be our URL
  const deepLink = commandLine.pop();
  if (deepLink && deepLink.startsWith("abogo://")) {
    handleDeepLink(deepLink);
  }
});

// Handle deep links in macOS (different from Windows/Linux)
app.on("open-url", (event, deepLink) => {
  event.preventDefault();
  console.log("Received open-url event with URL:", deepLink);
  handleDeepLink(deepLink);
});

// Handle deep links - simplified and more robust
function handleDeepLink(deepLink) {
  console.log("Processing deep link:", deepLink);

  try {
    // Parse the URL to extract the token
    const parsedUrl = new URL(deepLink);
    console.log("Parsed URL pathname:", parsedUrl.pathname);
    console.log("Parsed URL searchParams:", [
      ...parsedUrl.searchParams.entries(),
    ]);

    // Get the token from the search params
    const token = parsedUrl.searchParams.get("token");

    if (token) {
      console.log("Found token in deep link with length:", token.length);

      // Store the token globally so it's available for new windows
      authToken = token;

      // Send to all existing windows
      BrowserWindow.getAllWindows().forEach((win) => {
        console.log("Sending auth token to window:", win.id);
        win.webContents.send("auth-token-received", token);
      });
    } else {
      console.error("No token found in deep link");
    }
  } catch (error) {
    console.error("Error processing deep link:", error);
  }
}

app.whenReady().then(() => {
  // Create the main window
  const mainWindow = createWindow();

  // CRITICAL: Register the get-auth-token handler
  ipcMain.handle("get-auth-token", () => {
    console.log(
      "Renderer requested auth token, returning:",
      authToken ? "token exists" : "no token"
    );
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
      console.error("Error saving audio file:", error);
      return null;
    }
  });

  // Add this handler for opening URLs in external browser
  ipcMain.handle("open-external", async (event, url) => {
    console.log("Opening external URL:", url);
    return shell.openExternal(url);
  });

  // Add the handler for clearing the auth token
  ipcMain.handle("clear-auth-token", () => {
    console.log("Clearing auth token in main process");
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
