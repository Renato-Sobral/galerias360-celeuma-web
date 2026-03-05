"use client";

import * as React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from "@/components/ui/select";

export default function DropdownSingle({
  selectlabel,
  label,
  items,
  onSelect,
  className = "",
  width = "w-[200px]",
  height = "h-auto",
}) {
  return (
    <div className={className}>
      <Select onValueChange={onSelect}>
        <SelectTrigger
          className={`bg-transparent border border-border rounded-lg ${width} ${height} text-foreground hover:bg-muted dark:hover:bg-muted/70`}
        >
          <SelectValue
            placeholder={label}
            className="text-foreground dark:text-white"
          />
        </SelectTrigger>

        <SelectContent className="bg-background text-foreground dark:text-white">
          <SelectGroup>
            {selectlabel && (
              <SelectLabel className="mb-1 text-muted-foreground dark:text-gray-300">
                {selectlabel}
              </SelectLabel>
            )}
            {(items || []).map((item, index) => (
              <SelectItem
                key={index}
                value={item.value}
                className="dark:text-white dark:hover:bg-muted/70"
              >
                <div className="flex items-center gap-2">
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  {item.label}
                </div>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
