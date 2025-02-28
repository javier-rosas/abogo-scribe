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

  useEffect(() => {
    if (blockRefs.current[activeBlock]) {
      blockRefs.current[activeBlock].focus();
    }
  }, [activeBlock]);

  const handleContentChange = (id: string, content: string) => {
    setBlocks(
      blocks.map((block) => (block.id === id ? { ...block, content } : block))
    );
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLDivElement>,
    _id: string,
    index: number
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const newBlockId = `block-${Date.now()}`;
      const newBlocks = [...blocks];
      newBlocks.splice(index + 1, 0, {
        id: newBlockId,
        type: "paragraph",
        content: "",
      });
      setBlocks(newBlocks);
      setActiveBlock(newBlockId);
    } else if (
      e.key === "Backspace" &&
      blocks[index].content === "" &&
      blocks.length > 1
    ) {
      e.preventDefault();
      const newBlocks = blocks.filter((_, i) => i !== index);
      setBlocks(newBlocks);
      const prevBlockId = blocks[index - 1]?.id || blocks[index + 1]?.id;
      setActiveBlock(prevBlockId);
    }
  };

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

  const changeBlockType = (id: string, newType: string) => {
    setBlocks(
      blocks.map((block) =>
        block.id === id ? { ...block, type: newType } : block
      )
    );
  };

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
      dangerouslySetInnerHTML: { __html: block.content },
    };

    switch (block.type) {
      case "title":
        return (
          <h1
            {...blockProps}
            className="text-4xl font-bold w-full outline-none py-2 px-2"
            data-placeholder="Untitled"
          />
        );
      case "heading-1":
        return (
          <h1
            {...blockProps}
            className="text-3xl font-bold w-full outline-none py-2 px-2"
          />
        );
      case "heading-2":
        return (
          <h2
            {...blockProps}
            className="text-2xl font-bold w-full outline-none py-2 px-2"
          />
        );
      case "heading-3":
        return (
          <h3
            {...blockProps}
            className="text-xl font-bold w-full outline-none py-2 px-2"
          />
        );
      case "bullet-list":
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1.5">•</span>
            <div {...blockProps} />
          </div>
        );
      case "numbered-list":
        return (
          <div className="flex items-start gap-2">
            <span className="mt-1.5">{index}.</span>
            <div {...blockProps} />
          </div>
        );
      case "todo":
        return (
          <div className="flex items-start gap-2">
            <div className="mt-1.5 w-4 h-4 border rounded flex items-center justify-center">
              {block.checked && <CheckSquare className="w-3 h-3" />}
            </div>
            <div {...blockProps} />
          </div>
        );
      case "code":
        return (
          <pre className="bg-muted p-2 rounded-md my-2">
            <code {...blockProps} className="font-mono text-sm" />
          </pre>
        );
      default:
        return <div {...blockProps} />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
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

      <div className="border rounded-lg p-6 min-h-[70vh] bg-background shadow-sm">
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
                    <DropdownMenuItem onClick={() => addBlock("numbered-list")}>
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
  );
}
