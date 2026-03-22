"use client";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export default function ContextMenuWrapper({
  children,
  options = [],
  onSelect = () => {},
  onContextMenuCapture,
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full w-full" onContextMenuCapture={onContextMenuCapture}>
          {children}
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        {options.map((option, idx) => (
          <ContextMenuItem key={idx} onClick={() => onSelect(option.value)}>
            {option.label}
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  ); 
}
