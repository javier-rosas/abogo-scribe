import {
    Bold, CheckSquare, Code, Heading1, Heading2, ImageIcon, Italic, Link, List, ListOrdered,
    MoreHorizontal, Plus, Type
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export default function NotionEditor() {
  const [blocks, setBlocks] = useState([
    { id: "title", type: "title", content: "Untitled" },
    { id: "block-1", type: "paragraph", content: "" },
  ]);
  const [activeBlock, setActiveBlock] = useState("block-1");
  const blockRefs = useRef<Record<string, HTMLElement | null>>({});
  const [selection, setSelection] = useState<{
    text: string;
    blockId: string | null;
    start: number;
    end: number;
  }>({
    text: "",
    blockId: null,
    start: 0,
    end: 0,
  });

  useEffect(() => {
    if (blockRefs.current[activeBlock]) {
      blockRefs.current[activeBlock].focus();
    }
  }, [activeBlock]);

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
      const currentBlock = blocks[index];
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

  // Adds a new block of specified type after the currently active block
  const addBlock = (type: string) => {
    const newBlockId = `block-${Date.now()}`;
    const activeIndex = blocks.findIndex((block) => block.id === activeBlock);
    const newBlocks = [...blocks];
    newBlocks.splice(activeIndex + 1, 0, {
      id: newBlockId,
      type,
      content: "",
    });
    setBlocks(newBlocks);
    setActiveBlock(newBlockId);
  };

  // Changes the type of an existing block (e.g., from paragraph to heading)
  const changeBlockType = (id: string, newType: string) => {
    setBlocks(
      blocks.map((block) =>
        block.id === id ? { ...block, type: newType } : block
      )
    );
  };

  // Handles text selection within a block and updates selection state
  const handleSelection = (blockId: string) => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);
    const selectedText = range.toString();

    if (selectedText) {
      const selectionInfo = {
        text: selectedText,
        blockId,
        start: range.startOffset,
        end: range.endOffset,
      };

      setSelection(selectionInfo);
      console.log("Selection Details:", selectionInfo);
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
      onMouseUp: () => handleSelection(block.id),
      onKeyUp: () => handleSelection(block.id),
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
      case "code":
        return (
          <pre className="bg-muted p-2 rounded-md my-2">
            <code {...blockProps} className="font-mono text-sm" />
          </pre>
        );
      default:
        return <div {...blockProps}>{content}</div>;
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-14">
      <div className="flex items-center justify-between p-4 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Bold className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Italic className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Link className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Code className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            Share
          </Button>
          <Button variant="outline" size="sm">
            Comments
          </Button>
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
                <div className="absolute left-0 -ml-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => addBlock("paragraph")}>
                        <Type className="mr-2 h-4 w-4" />
                        <span>Text</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock("heading-1")}>
                        <Heading1 className="mr-2 h-4 w-4" />
                        <span>Heading 1</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock("heading-2")}>
                        <Heading2 className="mr-2 h-4 w-4" />
                        <span>Heading 2</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock("bullet-list")}>
                        <List className="mr-2 h-4 w-4" />
                        <span>Bullet List</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => addBlock("numbered-list")}
                      >
                        <ListOrdered className="mr-2 h-4 w-4" />
                        <span>Numbered List</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock("todo")}>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        <span>To-do</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock("code")}>
                        <Code className="mr-2 h-4 w-4" />
                        <span>Code</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => addBlock("image")}>
                        <ImageIcon className="mr-2 h-4 w-4" />
                        <span>Image</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {renderBlock(block, index)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
