import axios from "axios";
import cors from "cors";
import express from "express";
import jwt from "jsonwebtoken";

// import { transcribeAudioOpenAI } from './api/openAI';
// import { transcribeAudioElevenLabs } from './api/elevenLabs';
// import { transcribeAudioGroq } from './api/groq';
import { transcribeAudioDeepgram } from "./api/deepgram";

// Environment Variables
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

// Check if environment variables are defined
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not defined");
}

// Initialize Express App
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.raw({ type: "audio/webm", limit: "50mb" }));

// Verify Google Token and Issue JWT
app.post("/auth/google", async (req: any, res: any) => {
  const { token } = req.body;

  try {
    // Verify Google token
    const googleResponse = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${token}`
    );

    const { email, name, picture, sub } = googleResponse.data;

    // Generate our own JWT
    const userToken = jwt.sign(
      { email, name, picture, googleId: sub },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ jwt: userToken, user: { email, name, picture } });
  } catch (error) {
    return res.status(401).json({ error: "Invalid Google token" });
  }
});

// Middleware to Protect Routes
function authenticateJWT(req: any, res: any, next: any) {
  const token = req.header("Authorization")?.split(" ")[1];

  if (!token) return res.status(403).json({ error: "No token provided" });

  jwt.verify(token, JWT_SECRET as string, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
}

// Protected Route Example
app.get("/protected", authenticateJWT, (req: any, res: any) => {
  res.json({ message: "Protected data accessed!", user: req.user });
});

// Create POST endpoint for audio transcription
app.post("/transcribe", authenticateJWT, async (req: any, res: any) => {
  try {
    const audioBuffer = req.body;
    const transcription = await transcribeAudioDeepgram(audioBuffer);
    res.json({ transcription });
  } catch (error) {
    console.error("Error transcribing:", error);
    res.status(500).json({ error: "Failed to transcribe audio" });
  }
});

// Add this new endpoint before app.listen()
app.get("/auth/google/callback", async (req, res) => {
  const { code } = req.query;
  console.log("Received OAuth callback with code:", code);

  try {
    // Exchange the authorization code for tokens
    console.log("Attempting to exchange code for tokens...");
    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      {
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: "http://localhost:3000/auth/google/callback",
        grant_type: "authorization_code",
      }
    );
    console.log("Successfully received token response");

    // Get user info using the access token
    console.log("Fetching user info...");
    const userInfo = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      {
        headers: { Authorization: `Bearer ${tokenResponse.data.access_token}` },
      }
    );
    console.log("Successfully received user info:", userInfo.data.email);

    const { email, name, picture, sub } = userInfo.data;

    // Generate our JWT
    const userToken = jwt.sign(
      { email, name, picture, googleId: sub },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
    console.log("Generated JWT for user:", email);

    // Close the popup and send data to the main window
    res.send(`
      <script>
        window.opener.postMessage({ 
          type: 'AUTH_SUCCESS',
          jwt: '${userToken}',
          user: ${JSON.stringify({ email, name, picture })}
        }, '*');  // Use * to allow any origin temporarily for debugging
        window.close();
      </script>
    `);
  } catch (error) {
    console.error("OAuth error:", error);
    res.send(`
      <script>
        window.opener.postMessage({ 
          type: 'AUTH_ERROR',
          error: 'Authentication failed'
        }, '*');  // Use * to allow any origin temporarily for debugging
        window.close();
      </script>
    `);
  }
});

app.listen(PORT, () => {
  console.log(`HTTP server is running on http://localhost:${PORT}`);
});
