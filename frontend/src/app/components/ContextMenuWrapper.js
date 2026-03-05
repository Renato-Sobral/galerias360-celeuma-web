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
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
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
