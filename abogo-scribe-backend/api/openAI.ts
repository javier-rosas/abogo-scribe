import axios from 'axios';
import FormData from 'form-data';

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  const formData = new FormData();
  formData.append("model", "whisper-1");
  formData.append("file", audioBuffer, {
    filename: "audio.wav",
    contentType: "audio/wav",
  });
  formData.append("language", "es");
  formData.append(
    "prompt",
    "Esta es una reunión en español entre varias personas."
  );

  const apiKey = process.env.OPENAI_API_KEY || Bun.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("API key is missing. Please set it in your .env file.");
  }

  const response = await axios.post(
    "https://api.openai.com/v1/audio/transcriptions",
    formData,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...formData.getHeaders(),
      },
    }
  );

  return response.data.text;
}
