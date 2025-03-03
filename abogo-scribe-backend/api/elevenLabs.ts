import { ElevenLabsClient } from 'elevenlabs';

const ELEVENLABS_API_KEY =
  process.env.ELEVENLABS_API_KEY || Bun.env.ELEVENLABS_API_KEY;

const client = new ElevenLabsClient({ apiKey: ELEVENLABS_API_KEY });

export async function transcribeAudioElevenLabs(
  audioBuffer: Buffer
): Promise<string> {
  try {
    // Create a File object from the buffer
    const file = new File([audioBuffer], "audio.webm", {
      type: "audio/webm",
    });

    // Use the ElevenLabs client to transcribe the audio
    const transcription = await client.speechToText.convert({
      file: file,
      model_id: "scribe_v1",
      // tag_audio_events: true,
      language_code: "es",
      diarize: true,
    });

    console.log("Transcription:", transcription);
    return transcription.text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}
