import cors from "cors";
import express from "express";

import { createLiveTranscriptionConnection } from "./api/deepgram";

import type { Request, Response } from "express";
import type { Server as ExpressServer } from "http";
import type { ServerWebSocket } from "bun";

const app = express();
const PORT = process.env.PORT || 3000;

// Add CORS middleware
app.use(cors());

// Add middleware to handle JSON and raw body
app.use(express.json());
app.use(express.raw({ type: "audio/webm", limit: "50mb" }));

// Type for WebSocket data
interface WebSocketData {
  deepgramConnection: ReturnType<typeof createLiveTranscriptionConnection>;
}

// Create Express HTTP server for non-WebSocket requests
const expressServer = app.listen(PORT);

// Create Bun server with WebSocket support
Bun.serve<WebSocketData, Record<string, never>>({
  port: Number(PORT) + 1, // Use a different port for WebSocket server
  fetch(req, server) {
    // Handle WebSocket upgrade requests
    if (req.headers.get("upgrade") === "websocket") {
      const success = server.upgrade(req);
      if (success) {
        return undefined;
      }
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // Forward HTTP requests to Express by making a new request
    return fetch(`http://localhost:${PORT}${new URL(req.url).pathname}`, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });
  },
  websocket: {
    open(ws) {
      console.log("New WebSocket connection");

      // Create a Deepgram live transcription connection for this client
      const deepgramConnection = createLiveTranscriptionConnection(
        async (transcript) => {
          console.log("Transcript:", transcript);
          // Send transcript directly to client
          ws.send(
            JSON.stringify({
              type: "transcript",
              data: transcript,
            })
          );
        }
      );

      // Store the deepgram connection in the WebSocket data
      ws.data = { deepgramConnection };
    },
    message(ws: ServerWebSocket<WebSocketData>, message: unknown) {
      try {
        // Type guard for message types
        if (
          !(message instanceof ArrayBuffer) &&
          !(message instanceof Uint8Array) &&
          !(message instanceof Buffer) &&
          typeof message !== "string"
        ) {
          throw new Error("Unsupported message type");
        }

        console.log(
          "Received audio chunk of size:",
          message instanceof ArrayBuffer
            ? message.byteLength
            : typeof message === "string"
            ? message.length
            : (message as Uint8Array | Buffer).byteLength
        );

        const deepgramConnection = ws.data.deepgramConnection;

        // Convert message to ArrayBuffer if it isn't already
        let arrayBuffer: ArrayBuffer;
        if (message instanceof ArrayBuffer) {
          arrayBuffer = message;
        } else if (typeof message === "string") {
          const encoded = new TextEncoder().encode(message);
          arrayBuffer = encoded.buffer.slice(
            encoded.byteOffset,
            encoded.byteOffset + encoded.byteLength
          ) as ArrayBuffer;
        } else {
          // Create a copy of the ArrayBuffer to ensure we have a proper one
          const uint8Array = new Uint8Array(message);
          arrayBuffer = uint8Array.buffer.slice(
            uint8Array.byteOffset,
            uint8Array.byteOffset + uint8Array.byteLength
          );
        }

        console.log(
          "Sending chunk to Deepgram of size:",
          arrayBuffer.byteLength
        );
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
    },
    close(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
      console.log("Client disconnected with code:", code, "reason:", reason);
      // Close the Deepgram connection when the client disconnects
      const deepgramConnection = ws.data.deepgramConnection;
      if (deepgramConnection) {
        deepgramConnection.requestClose();
      }
    },
  },
});

console.log(`HTTP server running on http://localhost:${PORT}`);
console.log(`WebSocket server running on ws://localhost:${Number(PORT) + 1}`);
