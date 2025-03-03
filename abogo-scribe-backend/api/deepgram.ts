import { createClient } from '@deepgram/sdk';

const deepgram = createClient(
  process.env.DEEPGRAM_API_KEY || Bun.env.DEEPGRAM_API_KEY || ""
);

export async function transcribeAudioDeepgram(
  audioBuffer: Buffer
): Promise<{ [speaker: string]: string }> {
  try {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: "general",
        tier: "enhanced",
        language: "es-419",
        punctuate: true,
        diarize: true,
      }
    );

    if (error) {
      throw error;
    }

    const words = result?.results?.channels[0]?.alternatives[0]?.words || [];
    if (words.length === 0) {
      console.log("No transcription available.");
      return {};
    }

    // Create an object to store each speaker's text
    const speakerTexts: { [speaker: string]: string } = {};

    // Group words by speaker
    for (const word of words) {
      const speaker = `speaker_${word.speaker}`;
      if (!speakerTexts[speaker]) {
        speakerTexts[speaker] = "";
      }
      speakerTexts[speaker] += word.word + " ";
    }

    console.log(speakerTexts);
    return speakerTexts;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}
