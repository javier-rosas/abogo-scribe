import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

// import { transcribeAudioOpenAI } from './api/openAI';
// import { transcribeAudioElevenLabs } from './api/elevenLabs';
// import { transcribeAudioGroq } from './api/groq';
import { transcribeAudioDeepgram } from './api/deepgram';
// Import auth functions
import {
    checkAuthStatus, getLocalAuthBridge, handleGoogleAuth, handleGoogleAuthCallback,
    protectedRouteExample
} from './auth/auth';
import { authenticateJWT } from './auth/middleware';
import { meetingRouter } from './meetings/meetingsApi';
// Import user router
import { userRouter } from './users/users';

// Environment Variables
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const MONGODB_URI = process.env.MONGODB_URI;

// Check if environment variables are defined
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not defined");
}

if (!GOOGLE_CLIENT_ID) {
  throw new Error("GOOGLE_CLIENT_ID is not defined");
}

if (!MONGODB_URI) {
  throw new Error("MONGODB_URI is not defined");
}

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB successfully");
  })
  .catch((error: any) => {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit with failure
  });

// Configure Mongoose
mongoose.set("strictQuery", true);

// Initialize Express App
const app = express();

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.raw({ type: "audio/webm", limit: "50mb" }));

// Auth Routes
app.post("/auth/google", handleGoogleAuth);
app.get("/auth/google/callback", handleGoogleAuthCallback);
app.get("/auth/status", checkAuthStatus);
app.get("/auth/local-bridge", getLocalAuthBridge);

// User Routes
app.use("/users", userRouter);

// Meeting Routes
app.use("/meetings", meetingRouter);

// Protected Route Example
app.get("/protected", authenticateJWT, protectedRouteExample);

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

app.listen(PORT, () => {
  console.log(`HTTP server is running on http://localhost:${PORT}`);
});
