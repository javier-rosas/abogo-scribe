export async function transcribeAudio(audioBlob: Blob): Promise<string> {
  console.log("Transcribing audio...");

  try {
    const response = await fetch("http://localhost:3000/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "audio/webm",
      },
      body: audioBlob,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.transcription;
  } catch (error) {
    console.error("Error sending audio for transcription:", error);
    throw error;
  }
}
