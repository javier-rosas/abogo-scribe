import type { ServerWebSocket } from "bun";
import express from 'express';

import { transcribeAudio } from './api/openAI';

const app = express();
const PORT = process.env.PORT || 3000;

// Create a map to store session data for each connection
const sessions = new Map<
  ServerWebSocket,
  {
    sessionChunks: Buffer[];
    currentChunks: Buffer[];
    isFirstChunk: boolean;
  }
>();

Bun.serve({
  port: 8080,
  fetch(req, server) {
    if (server.upgrade(req)) {
      return;
    }
    return new Response("Upgrade failed", { status: 500 });
  },
  websocket: {
    open(ws) {
      console.log("Client connected");
      // Initialize session data for new connection
      sessions.set(ws as ServerWebSocket<undefined>, {
        sessionChunks: [],
        currentChunks: [],
        isFirstChunk: true,
      });

      // Set up transcription interval
      const transcribeInterval = setInterval(async () => {
        const session = sessions.get(ws as ServerWebSocket<undefined>);
        if (!session || session.currentChunks.length === 0) return;

        // Add new chunks to the session
        session.sessionChunks.push(...session.currentChunks);

        // Create a complete WebM file from the beginning of the session
        const completeAudioBuffer = Buffer.concat(session.sessionChunks);

        // Clear current chunks for next interval
        session.currentChunks = [];

        try {
          const transcription = await transcribeAudio(completeAudioBuffer);
          ws.send(JSON.stringify({ transcription }));
        } catch (error) {
          console.error("Error transcribing:", error);
          ws.send(JSON.stringify({ error: "Failed to transcribe audio" }));
        }
      }, 5000);

      // Store the interval ID in the WebSocket instance for cleanup
      (ws as any).transcribeInterval = transcribeInterval;
    },

    message(ws, message) {
      const session = sessions.get(ws as ServerWebSocket<undefined>);
      if (!session) return;

      const chunk = Buffer.from(message as Buffer);
      session.currentChunks.push(chunk);

      if (session.isFirstChunk) {
        console.log(
          "First chunk header (hex):",
          chunk.slice(0, 16).toString("hex")
        );
        session.isFirstChunk = false;
      }
    },

    close(ws) {
      console.log("Client disconnected");
      // Clear the interval
      clearInterval((ws as any).transcribeInterval);
      // Remove session data
      sessions.delete(ws as ServerWebSocket<undefined>);
    },
  },
});

app.listen(PORT, () => {
  console.log(`HTTP server is running on http://localhost:${PORT}`);
  console.log(`WebSocket server is running on ws://localhost:8080`);
});
