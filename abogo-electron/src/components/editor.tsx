import { CheckSquare, ChevronLeft, Mic, Save, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { createMeeting, updateMeeting } from '@/api/meetings';
import { useAuth } from '@/auth-context';
import { Button } from '@/components/ui/button';
import { LogoutButton } from '@/components/ui/logout-button';
import { audioRecorder } from '@/helpers/audio';
import { cn } from '@/lib/utils';
import { Meeting } from '@/types';

import Conversation from './conversation';

interface TranscriptionEntry {
  text: string;
  timestamp: number;
}

// Function to get meeting data from localStorage
const getMeetingFromStorage = (meetingId: string): Meeting | null => {
  const data = localStorage.getItem(`meeting-${meetingId}`);
  return data ? JSON.parse(data) : null;
};

// Function to save meeting data to localStorage
const saveMeetingToStorage = (meeting: Meeting) => {
  localStorage.setItem(`meeting-${meeting.id}`, JSON.stringify(meeting));
};

export default function Editor({
  meeting: initialMeeting,
  onBack,
}: {
  meeting?: Meeting;
  onBack: () => void;
}) {
  const { jwt } = useAuth();
  const [currentMeeting, setCurrentMeeting] = useState<Meeting | undefined>(
    () => {
      if (!initialMeeting) return undefined;
      // Try to get meeting from localStorage first
      return getMeetingFromStorage(initialMeeting.id) || initialMeeting;
    }
  );

  const [blocks, setBlocks] = useState([
    { id: "title", type: "title", content: "Untitled" },
    { id: "block-1", type: "paragraph", content: "" },
  ]);
  const [activeBlock, setActiveBlock] = useState("block-1");
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>("");
  const [transcriptionHistory, setTranscriptionHistory] = useState<
    TranscriptionEntry[]
  >([]);

  useEffect(() => {
    if (blockRefs.current[activeBlock]) {
      blockRefs.current[activeBlock].focus();
    }
  }, [activeBlock]);

  // Remove the recording duration effect and modify the audio recorder state change listener
  useEffect(() => {
    audioRecorder.onStateChange((state) => {
      setIsRecording(state.isRecording);
      setHasRecording(!!state.audioBlob);
    });
  }, []);

  // Replace the streaming transcription useEffect with this simplified version
  useEffect(() => {
    audioRecorder.onTranscriptionUpdate = (text: string) => {
      const filteredText = text.trim();

      if (filteredText) {
        setTranscription(filteredText);
        // Add new transcription entry to history
        setTranscriptionHistory((prev) => [
          ...prev,
          {
            text: filteredText,
            timestamp: Date.now(),
          },
        ]);
      }
    };

    return () => {
      // Clean up
      audioRecorder.onTranscriptionUpdate = undefined;
    };
  }, []); // Note: removed dependencies since we're not using blocks or activeBlock anymore

  // Gets the current caret (cursor) position within a given HTML element
  const getCaretPosition = (element: HTMLElement): number => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      if (element.contains(range.startContainer)) {
        return range.startOffset;
      }
    }
    return 0;
  };

  // Sets the caret position at a specific offset within an HTML element
  const setCaretPosition = (element: HTMLElement, position: number) => {
    const range = document.createRange();
    const sel = window.getSelection();

    let node = element.firstChild || element;
    if (node.nodeType === Node.ELEMENT_NODE) {
      range.setStart(node, 0);
    } else {
      range.setStart(node, Math.min(position, node.textContent?.length || 0));
    }

    range.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  // Updates the content of a specific block when it changes
  const handleContentChange = (id: string, content: string) => {
    setBlocks(
      blocks.map((block) => (block.id === id ? { ...block, content } : block))
    );

    // Save to localStorage if we have a current meeting
    if (currentMeeting) {
      const updatedMeeting = {
        ...currentMeeting,
        title:
          id === "title"
            ? content
            : blocks.find((block) => block.id === "title")?.content ||
              "Untitled",
        notes: blocks.map((block) => block.content).join("\n"),
      };
      setCurrentMeeting(updatedMeeting);
      saveMeetingToStorage(updatedMeeting);
    }
  };

  // Handles keyboard events for block manipulation (delete, enter, backspace)
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    _id: string,
    index: number
  ) => {
    const currentContent = e.currentTarget.textContent || "";
    const caretPos = getCaretPosition(e.currentTarget);

    if (e.key === "Backspace" && caretPos === 0 && index > 0) {
      e.preventDefault();

      const previousBlock = blocks[index - 1];
      const previousContent = previousBlock.content;

      const newBlocks = blocks.filter((_, i) => i !== index);
      newBlocks[index - 1] = {
        ...previousBlock,
        content: previousContent + currentContent,
      };

      setBlocks(newBlocks);
      setActiveBlock(previousBlock.id);

      setTimeout(() => {
        const prevBlockElement = blockRefs.current[previousBlock.id];
        if (prevBlockElement) {
          prevBlockElement.focus();
          setCaretPosition(prevBlockElement, previousContent.length);
        }
      }, 0);

      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const caretOffset = range.startOffset;

        const leftText = currentContent.slice(0, caretOffset);
        const rightText = currentContent.slice(caretOffset);

        const newBlocks = [...blocks];
        newBlocks[index] = { ...blocks[index], content: leftText };

        const newBlockId = `block-${Date.now()}`;
        newBlocks.splice(index + 1, 0, {
          id: newBlockId,
          type: "paragraph",
          content: rightText,
        });
        setBlocks(newBlocks);
        setActiveBlock(newBlockId);

        setTimeout(() => {
          const newBlock = blockRefs.current[newBlockId];
          if (newBlock) {
            newBlock.focus();
            const newRange = document.createRange();
            newRange.selectNodeContents(newBlock);
            newRange.collapse(true);
            const sel = window.getSelection();
            if (sel) {
              sel.removeAllRanges();
              sel.addRange(newRange);
            }
          }
        }, 0);
      }
    } else if (
      e.key === "Backspace" &&
      currentContent === "" &&
      blocks.length > 1
    ) {
      e.preventDefault();
      const newBlocks = blocks.filter((_, i) => i !== index);
      setBlocks(newBlocks);
      const prevBlockId = blocks[index - 1]?.id || blocks[index + 1]?.id;
      setActiveBlock(prevBlockId);
    }
  };

  // Toggle recording state
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        audioRecorder.stopRecording();
      } else {
        // Create meeting before starting recording
        const title =
          blocks.find((block) => block.id === "title")?.content || "Untitled";
        const now = new Date();
        const meetingData = {
          title,
          date: now.toISOString().split("T")[0], // YYYY-MM-DD format
          startTime: now.toTimeString().split(" ")[0].slice(0, 5), // HH:mm format
        };

        try {
          if (!jwt) {
            throw new Error("No JWT token found");
          }
          const newMeeting = await createMeeting(jwt, meetingData);
          setCurrentMeeting({
            ...newMeeting,
            id: newMeeting._id,
            participants: [],
            color: "bg-blue-100 text-blue-900",
          });
        } catch (error) {
          console.error("Failed to create meeting:", error);
          toast.error("Failed to create meeting");
          return;
        }

        await audioRecorder.startRecording();
      }
    } catch (error) {
      console.error("Error toggling recording:", error);
      toast.error("Failed to access microphone", {
        description: "Please check your microphone permissions and try again.",
      });
    }
  };

  // Save recording to file
  const saveRecording = async () => {
    try {
      const title =
        blocks.find((block) => block.id === "title")?.content || "Untitled";
      const filename = `${title
        .replace(/[^a-z0-9]/gi, "-")
        .toLowerCase()}-${new Date().toISOString().slice(0, 10)}.webm`;

      const savedPath = await audioRecorder.saveRecording(filename);

      if (savedPath) {
        toast.success("Recording Saved", {
          description: `Your recording has been saved to: ${savedPath}`,
        });
      } else {
        toast.info("Save Cancelled", {
          description: "The recording was not saved.",
        });
      }
    } catch (error) {
      console.error("Error saving recording:", error);
      toast.error("Save Error", {
        description: "Failed to save the recording.",
      });
    }
  };

  // Renders a block based on its type with appropriate styling and functionality
  const renderBlock = (block: any, index: number) => {
    const isActive = block.id === activeBlock;

    const blockProps = {
      className: cn(
        "w-full outline-none py-1 px-2 rounded-md transition-colors",
        isActive && "bg-muted/50"
      ),
      contentEditable: true,
      suppressContentEditableWarning: true,
      onFocus: () => setActiveBlock(block.id),
      onBlur: (e: React.FocusEvent<HTMLHeadingElement>) =>
        handleContentChange(block.id, e.target.innerText),
      onKeyDown: (e: React.KeyboardEvent<HTMLHeadingElement>) =>
        handleKeyDown(e, block.id, index),
      ref: (el: HTMLElement | null) => {
        blockRefs.current[block.id] = el;
      },
    };

    const content = block.content || "";

    console.log("meeting", currentMeeting);

    switch (block.type) {
      case "title":
        return (
          <h1
            {...blockProps}
            className="text-4xl font-bold w-full outline-none py-2 px-2"
            data-placeholder="Untitled"
          >
            {content}
          </h1>
        );
      case "heading-1":
        return (
          <h1
            {...blockProps}
            className="text-3xl font-bold w-full outline-none py-2 px-2"
          >
            {content}
          </h1>
        );
      case "heading-2":
        return (
          <h2
            {...blockProps}
            className="text-2xl font-bold w-full outline-none py-2 px-2"
          >
            {content}
          </h2>
        );
      case "heading-3":
        return (
          <h3
            {...blockProps}
            className="text-xl font-bold w-full outline-none py-2 px-2"
          >
            {content}
          </h3>
        );
      case "bullet-list":
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1.5">•</span>
            <div {...blockProps}>{content}</div>
          </div>
        );
      case "numbered-list":
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1.5">{index}.</span>
            <div {...blockProps}>{content}</div>
          </div>
        );
      case "todo":
        return (
          <div className="flex items-start gap-2">
            <div className="mt-1.5 w-4 h-4 border rounded flex items-center justify-center">
              {block.checked && <CheckSquare className="w-3 h-3" />}
            </div>
            <div {...blockProps}>{content}</div>
          </div>
        );
      default:
        return <div {...blockProps}>{content}</div>;
    }
  };

  // Handle back button click - save to MongoDB before going back
  const handleBack = async () => {
    if (currentMeeting && jwt) {
      try {
        const meetingData = {
          title:
            blocks.find((block) => block.id === "title")?.content || "Untitled",
          notes: blocks.map((block) => block.content).join("\n"),
          transcription: transcriptionHistory
            .map((entry) => entry.text)
            .join("\n"),
        };

        await updateMeeting(jwt, currentMeeting.id, meetingData);
        // Clear the localStorage entry for this meeting
        localStorage.removeItem(`meeting-${currentMeeting.id}`);
        onBack();
      } catch (error) {
        console.error("Failed to save meeting:", error);
        toast.error("Failed to save meeting", {
          description: "Your changes will be preserved locally.",
        });
      }
    } else {
      onBack();
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <Button variant="ghost" size="icon" onClick={handleBack}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Share
          </Button>
          <Button variant="outline" size="sm">
            Comments
          </Button>
          {hasRecording && (
            <Button variant="outline" size="sm" onClick={saveRecording}>
              <Save className="h-4 w-4 mr-2" />
              Save Recording
            </Button>
          )}
          <LogoutButton />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <Conversation
          transcriptionHistory={transcriptionHistory}
          transcription={transcription}
          isRecording={isRecording}
        />{" "}
        <div className="flex-1 overflow-y-auto min-h-0 p-6 bg-background">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-2">
              {blocks.map((block, index) => (
                <div key={block.id} className="group relative">
                  {renderBlock(block, index)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center py-4">
        {!isRecording ? (
          <Button
            variant="outline"
            size="lg"
            className="rounded-full px-6 py-6 flex items-center gap-2 bg-primary text-white hover:bg-primary/90 hover:scale-105 transition-all duration-200 hover:text-white"
            onClick={toggleRecording}
          >
            <Mic className="h-5 w-5" />
            <span>Record</span>
          </Button>
        ) : (
          <div className="flex flex-col items-center">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full px-6 py-6 flex items-center gap-2 bg-red-500 text-white hover:bg-red-600 hover:scale-105 transition-all duration-200 hover:text-white"
              onClick={toggleRecording}
            >
              <div className="flex items-center gap-1 h-5">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-1 bg-white rounded-full animate-pulse"
                    style={{
                      height: `${Math.max(
                        8,
                        Math.floor(Math.random() * 20)
                      )}px`,
                      animationDelay: `${i * 0.15}s`,
                      animationDuration: `${0.7 + Math.random() * 0.6}s`,
                    }}
                  />
                ))}
              </div>
              <Square className="h-4 w-4 ml-1 text-white" />
              <span>Recording...</span>
            </Button>

            {transcription && (
              <div className="mt-4 text-sm text-muted-foreground max-w-md">
                <em>Transcribing: "{transcription}"</em>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
