"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";

export default function DatePicker({ date, setDate }) {
  const getLabel = () => {
    if (!date?.from) return "Escolha uma data";
    if (date.from && date.to) {
      const fromFormatted = format(date.from, "PPP");
      const toFormatted = format(date.to, "PPP");
      return `${fromFormatted} – ${toFormatted}`;
    }
    return format(date.from, "PPP");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`w-auto justify-start text-left font-normal border px-3 py-1 rounded-md ${!date?.from ? "text-muted-foreground" : ""}`}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span>{getLabel()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <Calendar
          mode="range"
          selected={date}
          onSelect={setDate}
          numberOfMonths={1}
        />
      </PopoverContent>
    </Popover>
  );
}
