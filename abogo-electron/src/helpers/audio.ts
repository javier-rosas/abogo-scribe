import { transcribeAudio } from '../api/transcribe';

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

const RECORDING_INTERVAL = 2500;

// Class to handle audio recording
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private options: RecordingOptions;
  private recordingState: RecordingState = { isRecording: false };
  private onStateChangeCallback: ((state: RecordingState) => void) | null =
    null;
  private activeRecorders: MediaRecorder[] = [];
  private recordingCycleInterval: any = null;
  private _onTranscriptionUpdate: ((text: string) => void) | undefined;

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

  // Start recording using 5-second cycles with a 100ms overlap
  public async startRecording(): Promise<void> {
    try {
      // Request microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Check for supported MIME types
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      console.log("Using MIME type:", mimeType);

      // Clear any existing cycle if any
      if (this.recordingCycleInterval) {
        clearInterval(this.recordingCycleInterval);
      }

      // Immediately start a recorder so that transcribeAudio is called right away
      if (this.stream) {
        const streamClone = this.stream.clone();
        const immediateRecorder = new MediaRecorder(streamClone, {
          mimeType,
          audioBitsPerSecond: this.options.audioBitsPerSecond,
        });

        immediateRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            try {
              const transcription = await transcribeAudio(event.data);
              if (this._onTranscriptionUpdate) {
                this._onTranscriptionUpdate(transcription);
              }
            } catch (error) {
              console.error("Error processing audio chunk:", error);
            }
          }
        };

        immediateRecorder.start();
        this.activeRecorders.push(immediateRecorder);

        // Stop this recorder after 5 seconds
        setTimeout(() => {
          if (immediateRecorder.state !== "inactive") {
            immediateRecorder.stop();
          }
        }, RECORDING_INTERVAL);
      }

      // Start a cycle: start a new recorder every 4900ms (for 5-second recordings with ~100ms overlap)
      this.recordingCycleInterval = setInterval(() => {
        if (!this.stream) return;

        // Clone stream so each recorder works independently
        const streamClone = this.stream.clone();
        const recorder = new MediaRecorder(streamClone, {
          mimeType,
          audioBitsPerSecond: this.options.audioBitsPerSecond,
        });

        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0) {
            try {
              const transcription = await transcribeAudio(event.data);
              if (this._onTranscriptionUpdate) {
                this._onTranscriptionUpdate(transcription);
              }
            } catch (error) {
              console.error("Error processing audio chunk:", error);
            }
          }
        };

        recorder.start();
        this.activeRecorders.push(recorder);

        // Stop this recorder after 5 seconds
        setTimeout(() => {
          if (recorder.state !== "inactive") {
            recorder.stop();
          }
        }, RECORDING_INTERVAL);
      }, RECORDING_INTERVAL - 100);

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

  // Stop recording and clear the cycle
  public stopRecording(): void {
    if (this.recordingCycleInterval) {
      clearInterval(this.recordingCycleInterval);
      this.recordingCycleInterval = null;
    }

    // Stop all active recorders
    this.activeRecorders.forEach((recorder) => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
    });
    this.activeRecorders = [];

    // Stop all tracks
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    this.updateState({
      isRecording: false,
    });
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

  // Add this method to set the transcription callback
  public set onTranscriptionUpdate(
    callback: ((text: string) => void) | undefined
  ) {
    this._onTranscriptionUpdate = callback;
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
