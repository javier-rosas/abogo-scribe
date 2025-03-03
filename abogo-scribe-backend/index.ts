import cors from 'cors';
import express from 'express';

// import { transcribeAudioOpenAI } from './api/openAI';
// import { transcribeAudioElevenLabs } from './api/elevenLabs';
// import { transcribeAudioGroq } from './api/groq';
import { transcribeAudioDeepgram } from './api/deepgram';

const app = express();
const PORT = process.env.PORT || 3000;

// Add CORS middleware
app.use(cors());

// Add middleware to handle JSON and raw body
app.use(express.json());
app.use(express.raw({ type: "audio/webm", limit: "50mb" }));

// Create POST endpoint for audio transcription
app.post("/transcribe", async (req, res) => {
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
