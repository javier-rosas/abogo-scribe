// WebSocket audio streaming helper

interface TranscriptionResponse {
  transcription?: string;
  error?: string;
}

interface StreamAudioOptions {
  serverUrl: string;
  onTranscription?: (text: string) => void;
  onError?: (error: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export class AudioStreamer {
  private socket: WebSocket | null = null;
  private isConnected: boolean = false;
  public options: StreamAudioOptions;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(options: StreamAudioOptions) {
    this.options = options;
  }

  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    if (this.socket) {
      this.disconnect();
    }

    try {
      this.socket = new WebSocket(this.options.serverUrl);

      this.socket.onopen = () => {
        console.log("WebSocket connection established");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.options.onOpen) {
          this.options.onOpen();
        }
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(
            event.data as string
          ) as TranscriptionResponse;

          if (data.transcription && this.options.onTranscription) {
            this.options.onTranscription(data.transcription);
          }

          if (data.error && this.options.onError) {
            this.options.onError(data.error);
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      this.socket.onclose = () => {
        console.log("WebSocket connection closed");
        this.isConnected = false;

        if (this.options.onClose) {
          this.options.onClose();
        }

        // Attempt to reconnect if not intentionally disconnected
        this.attemptReconnect();
      };

      this.socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        if (this.options.onError) {
          this.options.onError("WebSocket connection error");
        }
      };
    } catch (error) {
      console.error("Error creating WebSocket:", error);
      if (this.options.onError) {
        this.options.onError("Failed to create WebSocket connection");
      }
    }
  }

  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

      console.log(
        `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`
      );

      this.reconnectTimeout = setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Send audio data to the WebSocket server
   */
  public sendAudioChunk(audioChunk: Blob | ArrayBuffer): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this.socket.send(audioChunk);
      return true;
    } catch (error) {
      console.error("Error sending audio chunk:", error);
      return false;
    }
  }

  /**
   * Check if the WebSocket is connected
   */
  public isReady(): boolean {
    return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
  }
}

// Create a singleton instance with default server URL
const DEFAULT_WS_URL = "ws://localhost:8080";
export const audioStreamer = new AudioStreamer({
  serverUrl: DEFAULT_WS_URL,
  onTranscription: (text) => {
    console.log("Received transcription:", text);
    // This will be overridden by the actual implementation
  },
  onError: (error) => {
    console.error("Transcription error:", error);
  },
});
