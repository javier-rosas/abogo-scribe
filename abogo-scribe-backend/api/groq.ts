import Groq from 'groq-sdk';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || Bun.env.GROQ_API_KEY,
});

export async function transcribeAudioGroq(
  audioBuffer: Buffer
): Promise<string> {
  try {
    // Create a File object from the buffer
    const file = new File([audioBuffer], "audio.webm", {
      type: "audio/webm",
    });

    // Use the Groq client to transcribe the audio
    const transcription = await groq.audio.transcriptions.create({
      file: file,
      model: "whisper-large-v3-turbo",
      language: "es",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    console.log("Transcription:", transcription);
    return transcription.text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}
