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

// Class to handle audio recording
export class AudioRecorder {
  private stream: MediaStream | null = null;
  private options: RecordingOptions;
  private recordingState: RecordingState = { isRecording: false };
  private onStateChangeCallback: ((state: RecordingState) => void) | null =
    null;
  private _onTranscriptionUpdate: ((text: string) => void) | undefined;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private silenceThreshold = -50;
  private ws: WebSocket | null = null;
  private mediaRecorder: MediaRecorder | null = null;

  constructor(options: RecordingOptions = {}) {
    this.options = { ...defaultOptions, ...options };
  }

  public onStateChange(callback: (state: RecordingState) => void): void {
    this.onStateChangeCallback = callback;
  }

  private updateState(newState: Partial<RecordingState>): void {
    this.recordingState = { ...this.recordingState, ...newState };
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback(this.recordingState);
    }
  }

  private checkAudioLevel(): boolean {
    if (!this.analyser) return false;

    const dataArray = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatTimeDomainData(dataArray);

    const rms = Math.sqrt(
      dataArray.reduce((sum, value) => sum + value * value, 0) /
        dataArray.length
    );

    const db = 20 * Math.log10(rms);
    return db > this.silenceThreshold;
  }

  private setupWebSocket(): void {
    this.ws = new WebSocket("ws://localhost:3001");

    this.ws.onopen = () => {
      console.log("WebSocket connection established");
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);
        if (data.type === "transcript" && this._onTranscriptionUpdate) {
          this._onTranscriptionUpdate(data.data);
        } else if (data.type === "error") {
          console.error("Transcription error:", data.message);
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.ws.onclose = (event) => {
      console.log(
        "WebSocket connection closed with code:",
        event.code,
        "reason:",
        event.reason
      );
    };
  }

  public async startRecording(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("Got audio stream");

      // Setup audio analysis
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      console.log("Audio analysis setup complete");

      // Setup WebSocket connection
      this.setupWebSocket();

      // Setup MediaRecorder for streaming
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      console.log("Using MIME type:", mimeType);

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType,
        audioBitsPerSecond: this.options.audioBitsPerSecond,
      });

      this.mediaRecorder.ondataavailable = async (event) => {
        console.log("Got media chunk of size:", event.data.size);
        if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
          const isAudible = this.checkAudioLevel();
          console.log("Audio level check:", isAudible ? "audible" : "silent");

          if (isAudible) {
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              console.log(
                "Sending audio chunk of size:",
                arrayBuffer.byteLength
              );
              this.ws.send(arrayBuffer);
            } catch (error) {
              console.error("Error sending audio chunk:", error);
            }
          }
        }
      };

      // Start recording with a small timeslice to get frequent updates
      this.mediaRecorder.start(500); // Increased to 500ms to reduce overhead
      console.log("MediaRecorder started");

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

  public stopRecording(): void {
    console.log("Stopping recording...");
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
      console.log("MediaRecorder stopped");
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
        console.log("Audio track stopped");
      });
      this.stream = null;
    }

    if (this.ws) {
      this.ws.close();
      console.log("WebSocket connection closed");
      this.ws = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      console.log("AudioContext closed");
      this.audioContext = null;
    }
    this.analyser = null;

    this.updateState({
      isRecording: false,
    });
  }

  public getState(): RecordingState {
    return this.recordingState;
  }

  public async saveRecording(filename?: string): Promise<string | null> {
    if (!this.recordingState.audioBlob) {
      console.error("No recording to save");
      return null;
    }

    try {
      const arrayBuffer = await this.recordingState.audioBlob.arrayBuffer();

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

  public set onTranscriptionUpdate(
    callback: ((text: string) => void) | undefined
  ) {
    this._onTranscriptionUpdate = callback;
  }
}

export const audioRecorder = new AudioRecorder();

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
