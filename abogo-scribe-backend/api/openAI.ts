import OpenAI from 'openai';

// Initialize the OpenAI client
// Make sure you have OPENAI_API_KEY in your environment variables
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || Bun.env.OPENAI_API_KEY,
});

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  try {
    // Log the size and first few bytes of the buffer for debugging
    console.log("Audio buffer size:", audioBuffer.length);
    console.log(
      "First 16 bytes (hex):",
      audioBuffer.slice(0, 16).toString("hex")
    );

    // Create a File object from the buffer
    const file = new File([audioBuffer], "audio.webm", {
      type: "audio/webm",
    });

    // Use the official SDK to call the Whisper transcription endpoint
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "es",
    });

    console.log("Transcription:", transcription.text);
    return transcription.text;
  } catch (error) {
    console.error("Transcription error details:", {
      bufferSize: audioBuffer.length,
      firstBytes: audioBuffer.slice(0, 16).toString("hex"),
      error: error,
    });
    throw error;
  }
}

// Remove or comment out the bufferToStream function as it's no longer needed
// function bufferToStream(buffer: Buffer) { ... }
