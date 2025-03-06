import axios from 'axios';
import jwt from 'jsonwebtoken';

// Import userDao after the authenticateJWT export
import { userDao } from '../users/users';

import type { RequestHandler } from "express";

// Environment Variables
const JWT_SECRET = process.env.JWT_SECRET as string;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

// Check if environment variables are defined
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not defined");
}

// Google Authentication Handler
export const handleGoogleAuth: RequestHandler = async (req, res) => {
  const { token } = req.body;

  try {
    // Verify Google token
    const googleResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
    );

    const { email, name, picture, sub } = googleResponse.data;

    // Upsert user in database
    const user = await userDao.upsert({
      email,
      name,
      picture,
      googleId: sub,
    });

    // Generate our own JWT
    const userToken = jwt.sign(
      { email, name, picture, googleId: sub },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ jwt: userToken, user });
  } catch (error) {
    console.error("Google auth error:", error);
    res.status(401).json({ error: "Invalid Google token" });
  }
};

// Google Auth Callback Handler
export const handleGoogleAuthCallback: RequestHandler = async (req, res) => {
  const { code, state } = req.query;

  try {
    // Exchange the authorization code for tokens
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: "http://localhost:3000/auth/google/callback",
        grant_type: "authorization_code",
      }
    );

    // Get user info using the access token
    const userInfo = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
      }
    );

    const { email, name, picture, sub } = userInfo.data;

    // Upsert user in database
    const user = await userDao.upsert({
      email,
      name,
      picture,
      googleId: sub,
    });

    // Generate our JWT
    const userToken = jwt.sign(
      { email, name, picture, googleId: sub },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Store auth info in cookies (keep this for compatibility)
    res.cookie(
      "pendingAuth",
      JSON.stringify({
        type: "AUTH_SUCCESS",
        jwt: userToken,
        user,
      }),
      {
        httpOnly: false,
        maxAge: 5 * 60 * 1000, // 5 minutes
      }
    );

    // Check if we should use the custom protocol
    if (state === "use-protocol-abogo") {
      // First redirect to our custom protocol with the token
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Successfully Logged In!</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                background-color: #f8f9fa;
                color: #212529;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                text-align: center;
              }
              .container {
                background-color: white;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                padding: 40px;
                max-width: 500px;
              }
              .success-icon {
                color: #28a745;
                font-size: 48px;
                margin-bottom: 20px;
              }
              h1 {
                color: #212529;
                margin-bottom: 16px;
              }
              p {
                color: #6c757d;
                margin-bottom: 24px;
                line-height: 1.5;
              }
              .app-name {
                font-weight: bold;
                color: #007bff;
              }
              .close-button {
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 10px 20px;
                font-size: 16px;
                cursor: pointer;
                transition: background-color 0.2s;
              }
              .close-button:hover {
                background-color: #0069d9;
              }
              .countdown {
                margin-top: 16px;
                font-size: 14px;
                color: #6c757d;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success-icon">✓</div>
              <h1>Successfully Logged In!</h1>
              <p>You've been successfully authenticated with <span class="app-name">Grabalo</span>.</p>
              <p>You can now close this window and return to the app.</p>
              <button class="close-button" onclick="window.close()">Close This Window</button>
              <div class="countdown" id="countdown">This window will close automatically in 5 seconds...</div>
            </div>
            
            <script>
              // Try to redirect to our custom protocol
              window.location.href = "abogo://auth-callback?token=${encodeURIComponent(
                userToken
              )}";
              
              // Set a timer to close the window automatically
              let secondsLeft = 5;
              const countdownElement = document.getElementById('countdown');
              
              const countdownInterval = setInterval(() => {
                secondsLeft--;
                countdownElement.textContent = "This window will close automatically in " + secondsLeft + " seconds...";
                
                if (secondsLeft <= 0) {
                  clearInterval(countdownInterval);
                  window.close();
                }
              }, 1000);
            </script>
          </body>
        </html>
      `);
      return;
    }

    // If not using the custom protocol, show the original success page
    res.send(`
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
            .success { color: #4CAF50; }
            .container { max-width: 600px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">Authentication Successful!</h1>
            <p>You have successfully authenticated with Google.</p>
            <p>Please return to the application to continue.</p>
            
            <script>
              // Still try the postMessage approach if it was opened from within the app
              try {
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'AUTH_SUCCESS',
                    jwt: '${userToken}',
                    user: ${JSON.stringify(user)}
                  }, '*');
                  window.close();
                }
              } catch (e) {
                console.log('Could not communicate with opener window');
              }
              
              // Store the token in localStorage for retrieval
              localStorage.setItem('pendingAuth', JSON.stringify({
                type: 'AUTH_SUCCESS',
                jwt: '${userToken}',
                user: ${JSON.stringify(user)}
              }));
            </script>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    res.send(`
      <script>
        window.opener.postMessage({ 
          type: 'AUTH_ERROR',
          error: 'Authentication failed'
        }, '*');
        window.close();
      </script>
    `);
  }
};

// Auth Status Handler
export const checkAuthStatus: RequestHandler = (req, res) => {
  // Check for auth token in cookies or session
  const pendingAuth =
    req.cookies?.pendingAuth || (req as any).session?.pendingAuth;

  if (pendingAuth) {
    // Clear the pending auth
    if (req.cookies?.pendingAuth) {
      res.clearCookie("pendingAuth");
    }
    if ((req as any).session?.pendingAuth) {
      (req as any).session.pendingAuth = null;
    }

    res.json({
      authenticated: true,
      jwt: pendingAuth.jwt,
      user: pendingAuth.user,
    });
    return;
  }

  res.json({ authenticated: false });
};

// Local Auth Bridge Handler
export const getLocalAuthBridge: RequestHandler = (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Auth Bridge</title>
      </head>
      <body>
        <script>
          // This page helps bridge localStorage between browser and Electron
        </script>
      </body>
    </html>
  `);
};

// Protected Route Example Handler
export const protectedRouteExample: RequestHandler = (req, res) => {
  res.json({ message: "Protected data accessed!", user: (req as any).user });
};
