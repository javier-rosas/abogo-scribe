import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';

const deepgram = createClient(
  process.env.DEEPGRAM_API_KEY || Bun.env.DEEPGRAM_API_KEY || ""
);

// Function to create a live transcription connection
export function createLiveTranscriptionConnection(
  onTranscript: (text: string) => void
) {
  const connection = deepgram.listen.live({
    model: "general",
    tier: "enhanced",
    language: "es-419",
    punctuate: true,
  });

  connection.on(LiveTranscriptionEvents.Open, () => {
    console.log("Live transcription connection opened");
  });

  connection.on(LiveTranscriptionEvents.Close, () => {
    console.log("Live transcription connection closed");
  });

  connection.on(LiveTranscriptionEvents.Transcript, (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (transcript) {
      onTranscript(transcript);
    }
  });

  connection.on(LiveTranscriptionEvents.Error, (error) => {
    console.error("Live transcription error:", error);
  });

  return connection;
}

export async function transcribeAudioDeepgram(
  audioBuffer: Buffer
): Promise<string> {
  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "general", // General model is required for Enhanced tier
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
