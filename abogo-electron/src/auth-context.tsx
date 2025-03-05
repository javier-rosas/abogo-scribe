import { jwtDecode, JwtPayload } from 'jwt-decode';
import { createContext, useContext, useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          GoogleAuth: new (config: { clientId: string; scope: string }) => {
            requestAccessToken: () => Promise<{ access_token: string }>;
          };
        };
      };
    };
    electron?: {
      openExternal: (url: string) => void;
      onAuthToken: (callback: (token: string) => void) => void;
      getAuthToken: () => Promise<string>;
      clearAuthToken: () => Promise<boolean>;
    };
  }
}

interface User extends JwtPayload {
  email?: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  jwt: string | null;
  handleGoogleSignIn: () => Promise<void>;
  logout: () => void;
  authPending: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [jwt, setJwt] = useState(localStorage.getItem("jwt"));
  const [authPending, setAuthPending] = useState(false);
  const authCheckInterval = useRef<number | null>(null);

  useEffect(() => {
    if (jwt) {
      try {
        const decoded = jwtDecode(jwt);
        setUser(decoded);
      } catch (err) {
        console.error("Invalid token", err);
        localStorage.removeItem("jwt");
        setJwt(null);
      }
    }
  }, [jwt]);

  useEffect(() => {
    // Add message listener for OAuth popup
    const handleMessage = (event: MessageEvent) => {
      console.log("Received message event:", event.origin, event.data);

      // Accept messages from both development server and backend
      if (
        event.origin !== "http://localhost:5173" &&
        event.origin !== "http://localhost:3000"
      ) {
        console.log(
          "Origin mismatch - expected http://localhost:5173 or http://localhost:3000, got:",
          event.origin
        );
        return;
      }

      if (event.data.type === "AUTH_SUCCESS") {
        console.log("Auth success - received JWT and user data");
        localStorage.setItem("jwt", event.data.jwt);
        setJwt(event.data.jwt);
        setAuthPending(false);
        if (authCheckInterval.current) {
          window.clearInterval(authCheckInterval.current);
          authCheckInterval.current = null;
        }
      } else if (event.data.type === "AUTH_ERROR") {
        console.error("Authentication failed:", event.data.error);
        setAuthPending(false);
        if (authCheckInterval.current) {
          window.clearInterval(authCheckInterval.current);
          authCheckInterval.current = null;
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Update the useEffect that listens for authentication
  useEffect(() => {
    console.log(
      "Setting up auth token listener - electron API available:",
      !!window.electron?.onAuthToken
    );

    // Try to get token directly when component mounts
    if (window.electron?.getAuthToken) {
      window.electron
        .getAuthToken()
        .then((token) => {
          if (token) {
            console.log("Retrieved stored auth token on mount");
            localStorage.setItem("jwt", token);
            setJwt(token);
          }
        })
        .catch((err) =>
          console.error("Error getting initial auth token:", err)
        );
    }

    // Register for future token events
    if (window.electron?.onAuthToken) {
      window.electron.onAuthToken((token: string) => {
        console.log("Received auth token from main process via IPC");
        localStorage.setItem("jwt", token);
        setJwt(token);
        setAuthPending(false);
        if (authCheckInterval.current) {
          window.clearInterval(authCheckInterval.current);
          authCheckInterval.current = null;
        }
      });
      console.log("Auth token listener registered successfully");
    } else {
      console.error("Electron onAuthToken API not available");
    }
  }, []);

  // Add this effect to clean up interval on unmount
  useEffect(() => {
    return () => {
      if (authCheckInterval.current) {
        window.clearInterval(authCheckInterval.current);
      }
    };
  }, []);

  // Simplify checkAuthStatus to focus on getting the token
  async function checkAuthStatus() {
    console.log("Checking auth status...");

    // Try to get token directly from main process
    if (window.electron?.getAuthToken) {
      try {
        console.log("Requesting auth token from main process");
        const token = await window.electron.getAuthToken();

        if (token) {
          console.log("Retrieved auth token from main process");
          localStorage.setItem("jwt", token);
          setJwt(token);
          setAuthPending(false);
          if (authCheckInterval.current) {
            window.clearInterval(authCheckInterval.current);
            authCheckInterval.current = null;
          }
          return;
        } else {
          console.log("No auth token available in main process");
        }
      } catch (error) {
        console.error("Error getting auth token from main process:", error);
      }
    }

    // Fall back to backend status check
    try {
      const response = await fetch("http://localhost:3000/auth/status", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.jwt) {
          console.log("Found authenticated session from backend");
          localStorage.setItem("jwt", data.jwt);
          setJwt(data.jwt);
          setAuthPending(false);
          if (authCheckInterval.current) {
            window.clearInterval(authCheckInterval.current);
            authCheckInterval.current = null;
          }
        }
      }
    } catch (error) {
      console.error("Error checking backend auth status:", error);
    }
  }

  async function handleGoogleSignIn() {
    console.log("Initiating Google Sign In...");
    const GOOGLE_CLIENT_ID =
      "937215743557-d7j44tgj2hh0ilsfrugveg3bnpvvkchu.apps.googleusercontent.com";
    const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

    // Add a custom redirect to our protocol
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: "http://localhost:3000/auth/google/callback",
      response_type: "code",
      access_type: "offline",
      scope:
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
      prompt: "consent",
      // Add a state parameter with our app's protocol scheme
      state: "use-protocol-abogo",
    });

    // Set authPending to true and start checking for authentication
    setAuthPending(true);
    console.log("Set authPending to true");

    // Start periodically checking for auth status
    if (authCheckInterval.current) {
      console.log("Clearing existing auth check interval");
      window.clearInterval(authCheckInterval.current);
    }

    console.log("Setting up new auth check interval");
    authCheckInterval.current = window.setInterval(() => {
      console.log("Auth check interval triggered");
      checkAuthStatus();
    }, 2000); // Check every 2 seconds

    // Use Electron's shell API to open the default browser
    console.log(
      "Opening external browser with URL:",
      `${GOOGLE_AUTH_URL}?${params.toString()}`
    );
    if (window.electron?.openExternal) {
      const opened = await window.electron.openExternal(
        `${GOOGLE_AUTH_URL}?${params.toString()}`
      );
      console.log("External browser opened:", opened);
    } else {
      console.error("Electron API not available for opening external browser");
    }
  }

  function logout() {
    console.log("Logging out user");

    // Clear token from localStorage
    localStorage.removeItem("jwt");

    // Clear token from Electron main process
    if (window.electron?.clearAuthToken) {
      window.electron
        .clearAuthToken()
        .then(() => console.log("Auth token cleared from main process"))
        .catch((err) =>
          console.error("Error clearing auth token from main process:", err)
        );
    }

    // Clear React state
    setJwt(null);
    setUser(null);

    // Force reload to ensure clean state (optional)
    // window.location.reload();
  }

  return (
    <AuthContext.Provider
      value={{ user, jwt, handleGoogleSignIn, logout, authPending }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
