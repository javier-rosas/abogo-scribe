import { createClient } from "@deepgram/sdk";

const deepgram = createClient(
  process.env.DEEPGRAM_API_KEY || Bun.env.DEEPGRAM_API_KEY || ""
);

export async function transcribeAudioDeepgram(
  audioBuffer: Buffer
): Promise<string> {
  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "nova-3", // General model is required for Enhanced tier
        tier: "enhanced", // Use the Enhanced tier for better accuracy
        language: "es-419", // Latin American Spanish
        punctuate: true,
        // diarize: true, // Enable speaker identification
      }
    );

    if (error) {
      throw error;
    }

    const transcription =
      result?.results?.channels[0]?.alternatives[0]?.transcript || "";
    console.log("Transcription:", transcription);
    return transcription;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}
