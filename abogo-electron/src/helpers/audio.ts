// Audio recording helper functions

// Interface for recording options
export interface RecordingOptions {
  mimeType?: string;
  audioBitsPerSecond?: number;
}

// Interface for recording state
export interface RecordingState {
  isRecording: boolean;
  audioBlob?: Blob;
  audioUrl?: string;
  startTime?: Date;
  duration?: number;
}

// Default recording options
const defaultOptions: RecordingOptions = {
  mimeType: "audio/webm;codecs=opus",
  audioBitsPerSecond: 128000,
};

// After the import statements, add:
import { audioStreamer } from './streamAudio';

// Class to handle audio recording
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private options: RecordingOptions;
  private recordingState: RecordingState = { isRecording: false };
  private onStateChangeCallback: ((state: RecordingState) => void) | null =
    null;

  constructor(options: RecordingOptions = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  // Set callback for state changes
  public onStateChange(callback: (state: RecordingState) => void): void {
    this.onStateChangeCallback = callback;
  }

  // Update and notify about state changes
  private updateState(newState: Partial<RecordingState>): void {
    this.recordingState = { ...this.recordingState, ...newState };
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.recordingState);
    }
  }

  // Start recording
  public async startRecording(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Check for supported MIME types
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm"; // Fallback to basic webm if opus not supported

      console.log("Using MIME type:", mimeType);
      const supported = MediaRecorder.isTypeSupported(mimeType);
      console.log(`MIME type ${mimeType} supported:`, supported);

      // Create media recorder with supported MIME type
      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: this.options.audioBitsPerSecond,
      });

      // Clear previous recording data
      this.audioChunks = [];

      // Connect to the WebSocket server for streaming
      audioStreamer.connect();

      // Handle data available event
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Convert Blob to ArrayBuffer and send as-is
          const reader = new FileReader();
          reader.onload = () => {
            if (audioStreamer.isReady() && reader.result) {
              audioStreamer.sendAudioChunk(reader.result as ArrayBuffer);
            }
          };
          reader.readAsArrayBuffer(event.data);
        }
      };

      // Handle recording stop
      this.mediaRecorder.onstop = () => {
        // Create blob from chunks
        const audioBlob = new Blob(this.audioChunks, {
          type: this.options.mimeType,
        });
        const audioUrl = URL.createObjectURL(audioBlob);

        // Calculate duration
        const endTime = new Date();
        const duration = this.recordingState.startTime
          ? (endTime.getTime() - this.recordingState.startTime.getTime()) / 1000
          : 0;

        // Update state with recording data
        this.updateState({
          isRecording: false,
          audioBlob,
          audioUrl,
          duration,
        });

        // Stop all tracks
        if (this.stream) {
          this.stream.getTracks().forEach((track) => track.stop());
          this.stream = null;
        }
      };

      // Start recording
      this.mediaRecorder.start(100); // Collect data every 100ms

      // Update state
      this.updateState({
        isRecording: true,
        startTime: new Date(),
        audioBlob: undefined,
        audioUrl: undefined,
        duration: undefined,
      });
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  }

  // Stop recording
  public stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }

    // Disconnect from the WebSocket server
    audioStreamer.disconnect();
  }

  // Get current recording state
  public getState(): RecordingState {
    return this.recordingState;
  }

  // Save recording to file using Electron's IPC
  public async saveRecording(filename?: string): Promise<string | null> {
    if (!this.recordingState.audioBlob) {
      console.error("No recording to save");
      return null;
    }

    try {
      // Convert blob to array buffer
      const arrayBuffer = await this.recordingState.audioBlob.arrayBuffer();

      // Use window.electron if it exists (should be provided by preload.js)
      if (window.electron) {
        const defaultFilename = `recording-${new Date()
          .toISOString()
          .replace(/:/g, "-")}.webm`;
        const savedPath = await window.electron.saveAudioFile({
          buffer: arrayBuffer,
          filename: filename || defaultFilename,
        });
        return savedPath;
      } else {
        console.error("Electron API not available");
        return null;
      }
    } catch (error) {
      console.error("Error saving recording:", error);
      return null;
    }
  }
}

// Create and export a singleton instance
export const audioRecorder = new AudioRecorder();

// Type declaration for Electron API
declare global {
  interface Window {
    electron?: {
      saveAudioFile: (options: {
        buffer: ArrayBuffer;
        filename: string;
      }) => Promise<string>;
    };
  }
}
