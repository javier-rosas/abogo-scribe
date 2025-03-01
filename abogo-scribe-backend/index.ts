import express from 'express';
import { WebSocketServer } from 'ws';

import { transcribeAudio } from './api/openAI';

const app = express();
const PORT = process.env.PORT || 3000;

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws) => {
  console.log("Client connected");

  let sessionChunks: Buffer[] = [];
  let currentChunks: Buffer[] = [];
  let isFirstChunk = true;
  const TRANSCRIBE_INTERVAL_MS = 5000;

  const transcribeInterval = setInterval(async () => {
    if (currentChunks.length === 0) return;

    // Add new chunks to the session
    sessionChunks.push(...currentChunks);

    // Create a complete WebM file from the beginning of the session
    const completeAudioBuffer = Buffer.concat(sessionChunks);

    // Clear current chunks for next interval
    currentChunks = [];

    try {
      const transcription = await transcribeAudio(completeAudioBuffer);
      ws.send(JSON.stringify({ transcription }));
    } catch (error) {
      console.error("Error transcribing:", error);
      ws.send(JSON.stringify({ error: "Failed to transcribe audio" }));
    }
  }, TRANSCRIBE_INTERVAL_MS);

  ws.on("message", (message) => {
    const chunk = Buffer.from(message as Buffer);

    // Store the chunk
    currentChunks.push(chunk);

    // If this is the first chunk of the session, log its beginning for debugging
    if (isFirstChunk) {
      console.log(
        "First chunk header (hex):",
        chunk.slice(0, 16).toString("hex")
      );
      isFirstChunk = false;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    clearInterval(transcribeInterval);
    // Clear the buffers
    sessionChunks = [];
    currentChunks = [];
    isFirstChunk = true;
  });
});

app.listen(PORT, () => {
  console.log(`HTTP server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:8080`);
});
