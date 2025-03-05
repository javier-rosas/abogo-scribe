import { jwtDecode, JwtPayload } from "jwt-decode";
import { createContext, useContext, useEffect, useState } from "react";

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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: any) {
  const [user, setUser] = useState<User | null>(null);
  const [jwt, setJwt] = useState(localStorage.getItem("jwt"));

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
      } else if (event.data.type === "AUTH_ERROR") {
        console.error("Authentication failed:", event.data.error);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  async function handleGoogleSignIn() {
    console.log("Initiating Google Sign In...");
    const GOOGLE_CLIENT_ID =
      "937215743557-d7j44tgj2hh0ilsfrugveg3bnpvvkchu.apps.googleusercontent.com";
    const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: "http://localhost:3000/auth/google/callback",
      response_type: "code",
      access_type: "offline",
      scope:
        "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
      prompt: "consent",
    });

    window.open(
      `${GOOGLE_AUTH_URL}?${params.toString()}`,
      "_blank",
      "width=500,height=600"
    );
  }

  function logout() {
    localStorage.removeItem("jwt");
    setJwt(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, jwt, handleGoogleSignIn, logout }}>
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
