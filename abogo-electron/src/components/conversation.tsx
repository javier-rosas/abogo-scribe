import { useEffect, useRef } from 'react';

export default function Conversation({
  transcriptionHistory,
  transcription,
  isRecording,
}: {
  transcriptionHistory: any[];
  transcription: string;
  isRecording: boolean;
}) {
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptionHistory, transcription]);

  const lastHistoryEntry =
    transcriptionHistory[transcriptionHistory.length - 1];
  const shouldShowLiveTranscription =
    isRecording &&
    transcription &&
    (!lastHistoryEntry || lastHistoryEntry.text !== transcription);

  return (
    <div className="w-80 border-r bg-muted/10 overflow-y-auto flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold">Transcription</h2>
      </div>
      <div className="flex-1 p-4 space-y-4">
        {transcriptionHistory.map((entry) => (
          <div
            key={entry.timestamp}
            className="flex flex-col space-y-1 animate-fade-in"
          >
            <div className="text-xs text-muted-foreground">
              {new Date(entry.timestamp).toLocaleTimeString()}
            </div>
            <div className="bg-background rounded-lg p-3 shadow-sm">
              {entry.text}
            </div>
          </div>
        ))}
        {shouldShowLiveTranscription && (
          <div className="flex flex-col space-y-1">
            <div className="text-xs text-muted-foreground">Live</div>
            <div className="bg-background rounded-lg p-3 shadow-sm border-primary/20 border">
              {transcription}
              <span className="inline-flex ml-1">
                <span className="animate-pulse">.</span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.3s" }}
                >
                  .
                </span>
                <span
                  className="animate-pulse"
                  style={{ animationDelay: "0.6s" }}
                >
                  .
                </span>
              </span>
            </div>
          </div>
        )}
        <div ref={conversationEndRef} />
      </div>
    </div>
  );
}
