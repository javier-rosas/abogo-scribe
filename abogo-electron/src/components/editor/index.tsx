import { CheckSquare, Mic, MoreHorizontal, Save, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { audioRecorder } from '@/helpers/audio';
import { cn } from '@/lib/utils';

export default function NotionEditor() {
  const [blocks, setBlocks] = useState([
    { id: "title", type: "title", content: "Untitled" },
    { id: "block-1", type: "paragraph", content: "" },
  ]);
  const [activeBlock, setActiveBlock] = useState("block-1");
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (blockRefs.current[activeBlock]) {
      blockRefs.current[activeBlock].focus();
    }
  }, [activeBlock]);

  // Set up audio recorder state change listener
  useEffect(() => {
    audioRecorder.onStateChange((state) => {
      setIsRecording(state.isRecording);
      if (state.duration) {
        setRecordingDuration(state.duration);
      }
      setHasRecording(!!state.audioBlob);
    });

    return () => {
      // Clean up timer on unmount
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  // Update timer during recording
  useEffect(() => {
    if (isRecording) {
      let startTime = Date.now();
      timerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordingDuration(elapsed);
      }, 100);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [isRecording]);

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

  // Format recording time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Toggle recording state
  const toggleRecording = async () => {
    try {
      if (isRecording) {
        audioRecorder.stopRecording();
      } else {
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

  return (
    <div className="h-full w-full flex flex-col p-14">
      <div className="flex items-center justify-end p-4 border-b shrink-0">
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
          <Button variant="outline" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>

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
                    height: `${Math.max(8, Math.floor(Math.random() * 20))}px`,
                    animationDelay: `${i * 0.15}s`,
                    animationDuration: `${0.7 + Math.random() * 0.6}s`,
                  }}
                />
              ))}
            </div>
            <Square className="h-4 w-4 ml-1 text-white" />
            <span>Recording... {formatTime(recordingDuration)}</span>
          </Button>
        )}
      </div>
    </div>
  );
}
