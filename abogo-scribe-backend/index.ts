import axios from 'axios';
import express from 'express';
import FormData from 'form-data';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 3000;

// Create WebSocket Server on port 8080
const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  // A buffer for incoming audio data (per WebSocket connection)
  let audioChunks: Buffer[] = [];

  // A simple timer to transcribe periodically (e.g., every 5 seconds)
  const TRANSCRIBE_INTERVAL_MS = 5000;

  // Set up an interval that fires every 5 seconds
  // Each client gets its own interval
  const transcribeInterval = setInterval(async () => {
    if (audioChunks.length === 0) {
      return; // No data to transcribe
    }

    // Combine all chunks into one buffer
    const audioBuffer = Buffer.concat(audioChunks);
    // Reset the chunks for the next interval
    audioChunks = [];

    try {
      // Prepare FormData for sending to OpenAI
      const formData = new FormData();
      formData.append("model", "whisper-1");
      formData.append("file", audioBuffer, {
        filename: "audio.wav",
        contentType: "audio/wav",
      });

      // Send request to OpenAI Whisper API
      const apiKey = "your_openai_api_key"; // Replace with your actual API key
      const response = await axios.post(
        "https://api.openai.com/v1/audio/transcriptions",
        formData,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...formData.getHeaders(),
          },
        }
      );

      // Send transcription back to the client
      ws.send(JSON.stringify({ transcription: response.data.text }));
    } catch (error) {
      console.error("Error transcribing:", error);
      ws.send(JSON.stringify({ error: "Failed to transcribe audio" }));
    }
  }, TRANSCRIBE_INTERVAL_MS);

  // Listen for audio data from the client
  ws.on("message", (message) => {
    audioChunks.push(Buffer.from(message as Buffer));
  });

  // Cleanup when the client disconnects
  ws.on("close", () => {
    console.log("Client disconnected");
    clearInterval(transcribeInterval);
  });
});

app.listen(PORT, () => {
  console.log(`HTTP server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:8080`);
});
