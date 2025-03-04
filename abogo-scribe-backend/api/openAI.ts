import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || Bun.env.OPENAI_API_KEY,
});

export async function transcribeAudioOpenAI(
  audioBuffer: Buffer
): Promise<string> {
  try {
    // Create a File object from the buffer
    const file = new File([audioBuffer], "audio.webm", {
      type: "audio/webm",
    });

    // Use the official SDK to call the Whisper transcription endpoint
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "es",
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    // Extract text with speaker labels if available
    const text = transcription.text;
    console.log("Transcription:", transcription);
    return text;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

export async function processTranscriptions(
  transcriptions: string[]
): Promise<string> {
  try {
    const prompt = `Actúa como un corrector ortográfico. Toma estos ${
      transcriptions.length
    } fragmentos de texto y devuelve ÚNICAMENTE el texto con la gramática corregida, manteniendo el mismo contenido y significado, sin explicaciones ni comentarios adicionales:\n\n${transcriptions.join(
      "\n"
    )}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
    });

    return completion.choices[0].message.content || "";
  } catch (error) {
    console.error("Error processing transcriptions:", error);
    throw error;
  }
}
