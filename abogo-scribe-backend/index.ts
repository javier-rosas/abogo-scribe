import cors from 'cors';
import express from 'express';
import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

import { createLiveTranscriptionConnection, transcribeAudioDeepgram } from './api/deepgram';

// import { transcribeAudioOpenAI } from './api/openAI';
// import { transcribeAudioElevenLabs } from './api/elevenLabs';
// import { transcribeAudioGroq } from './api/groq';

const app = express();
const PORT = process.env.PORT || 3000;

// Add CORS middleware
app.use(cors());

// Add middleware to handle JSON and raw body
app.use(express.json());
app.use(express.raw({ type: "audio/webm", limit: "50mb" }));

// Create POST endpoint for audio transcription (keeping this for backward compatibility)
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

// Create HTTP server
const server = new Server(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebSocket connection");

  // Create a Deepgram live transcription connection for this client
  const deepgramConnection = createLiveTranscriptionConnection((transcript) => {
    // Send transcription back to the client
    console.log("Transcript:", transcript);
    ws.send(JSON.stringify({ type: "transcript", data: transcript }));
  });

  ws.on("message", (message: Buffer) => {
    try {
      console.log("Received audio chunk of size:", message.length);
      // Convert Buffer to ArrayBuffer before sending to Deepgram
      const arrayBuffer = message.buffer.slice(
        message.byteOffset,
        message.byteOffset + message.byteLength
      );
      console.log("Sending chunk to Deepgram of size:", arrayBuffer.byteLength);
      deepgramConnection.send(arrayBuffer);
    } catch (error) {
      console.error("Error processing WebSocket message:", error);
      console.error(
        "Error details:",
        error instanceof Error ? error.message : String(error)
      );
      ws.send(
        JSON.stringify({ type: "error", message: "Failed to process audio" })
      );
    }
  });

  ws.on("close", (code, reason) => {
    console.log(
      "Client disconnected with code:",
      code,
      "reason:",
      reason?.toString()
    );
    // Close the Deepgram connection when the client disconnects
    deepgramConnection.finish();
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
