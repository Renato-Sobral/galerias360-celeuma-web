"use client";

import React from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function DropdownMulti({
  label,
  items,
  onSelect,
  selectedValues = [],
  className = "",
  width = "w-[200px]",
}) {
  const handleSelect = (value) => {
    const updated = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelect?.(updated);
  };

  return (
    <div className={`relative ${width} ${className}`}>
      <Select>
        <SelectTrigger
          className={`py-1.5 px-3.5 bg-background text-foreground border border-border rounded-lg hover:bg-muted dark:hover:bg-muted/70 flex items-center justify-between ${width}`}
        >
          <SelectValue
            placeholder={label}
            className="text-sm text-foreground"
          />
        </SelectTrigger>
        <SelectContent className="bg-background text-foreground border border-border">
          <div className="flex flex-col gap-1 px-0 py-1">
            {items.map((item) => (
              <button
                key={item.value}
                onClick={(e) => {
                  e.preventDefault();
                  handleSelect(item.value);
                }}
                className={`flex items-center justify-between px-2.5 py-1.5 text-sm rounded-md hover:bg-muted dark:hover:bg-muted/70 text-foreground`}
              >
                <span>{item.label}</span>
                {selectedValues.includes(item.value) && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
