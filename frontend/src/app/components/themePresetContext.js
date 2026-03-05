"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemePresetContext = createContext({
    presets: [],
    activePreset: null,
    logos: { light: null, dark: null, invertDark: false },
    refreshPresets: () => { },
    refreshActive: () => { },
});

export const useThemePresets = () => useContext(ThemePresetContext);

/* ── CSS variable keys we override ── */
const CSS_VAR_KEYS = [
    "background", "foreground",
    "card", "card-foreground",
    "popover", "popover-foreground",
    "primary", "primary-foreground",
    "secondary", "secondary-foreground",
    "muted", "muted-foreground",
    "accent", "accent-foreground",
    "destructive", "destructive-foreground",
    "border", "input", "ring",
    "chart-1", "chart-2", "chart-3", "chart-4", "chart-5",
];

export { CSS_VAR_KEYS };

export default ThemePresetContext;
