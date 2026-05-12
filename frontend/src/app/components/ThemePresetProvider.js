"use client";

import { useState, useEffect, useCallback } from "react";
import ThemePresetContext, { CSS_VAR_KEYS } from "./themePresetContext";

const API = process.env.NEXT_PUBLIC_API_URL;
const THEME_CACHE_KEY = "galerias360_theme_cache";

function getApiBase() {
    if (typeof API === "string" && API.trim()) return API.replace(/\/$/, "");
    if (typeof window !== "undefined") return window.location.origin;
    return "";
}

/* ── cache helpers ── */
function getThemeFromCache() {
    if (typeof window === "undefined") return null;
    try {
        const cached = localStorage.getItem(THEME_CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch {
        return null;
    }
}

function saveThemeToCache(preset) {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(preset));
    } catch {
        // localStorage quota exceeded or unavailable
    }
}

async function safeFetchJson(pathname) {
    const base = getApiBase();
    if (!base) return null;

    let url;
    try {
        url = new URL(pathname, base).toString();
    } catch {
        return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    try {
        const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function toBool(value) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "true" || normalized === "1" || normalized === "yes";
    }
    return false;
}

/* ── resolve relative logo URLs ── */
function resolveLogoUrl(url) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const base = getApiBase();
    if (!base) return url;
    try {
        return new URL(url, base).toString();
    } catch {
        return url;
    }
}

/* ── helpers ── */
function applyVarsToRoot(vars, selector) {
    if (!vars || typeof window === "undefined") return;
    // We inject a <style> tag per selector so we can remove it later
    const id = `theme-preset-${selector.replace(/[^a-z]/gi, "")}`;
    let style = document.getElementById(id);
    if (!style) {
        style = document.createElement("style");
        style.id = id;
        document.head.appendChild(style);
    }
    const lines = Object.entries(vars)
        .filter(([k]) => CSS_VAR_KEYS.includes(k))
        .map(([k, v]) => `  --${k}: ${v};`);
    style.textContent = `${selector} {\n${lines.join("\n")}\n}`;
}

function removeInjectedStyles() {
    if (typeof window === "undefined") return;
    document.querySelectorAll('style[id^="theme-preset-"]').forEach((el) => el.remove());
}

export default function ThemePresetProvider({ children }) {
    const [presets, setPresets] = useState([]);
    const [activePreset, setActivePreset] = useState(null);
    const [logos, setLogos] = useState({ light: null, dark: null, invertDark: false });
    const [favicon, setFavicon] = useState(null);

    const applyFavicon = useCallback((url) => {
        if (typeof document === "undefined") return;

        const href = url || null;

        const rels = ["icon", "shortcut icon", "apple-touch-icon"];
        rels.forEach((rel) => {
            let link = document.head.querySelector(`link[rel='${rel}']`);
            if (!href) {
                if (link) link.remove();
                return;
            }

            if (!link) {
                link = document.createElement("link");
                link.setAttribute("rel", rel);
                document.head.appendChild(link);
            }

            link.setAttribute("href", href);
        });
    }, []);

    /* Fetch all presets */
    const refreshPresets = useCallback(async () => {
        // Try /theme/list first, then fallback to /theme/presets
        const json = (await safeFetchJson("/theme/list")) || (await safeFetchJson("/theme/presets"));
        if (json?.success) setPresets(Array.isArray(json.data) ? json.data : []);
    }, []);

    /* Fetch active theme */
    const refreshActive = useCallback(async () => {
        const json = await safeFetchJson("/theme/active");
        if (json?.success && json.data) {
            setActivePreset(json.data);
            saveThemeToCache(json.data);
        } else {
            setActivePreset(null);
        }
    }, []);

    const refreshFavicon = useCallback(async () => {
        const json = await safeFetchJson("/theme/favicon");
        if (json?.success) {
            const faviconUrl = json.data?.url || null;
            setFavicon(faviconUrl);
            // Cache favicon
            if (faviconUrl) {
                try {
                    const cached = localStorage.getItem(THEME_CACHE_KEY);
                    const theme = cached ? JSON.parse(cached) : {};
                    theme.favicon = faviconUrl;
                    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(theme));
                } catch {
                    // Fail silently
                }
            }
            return;
        }
        setFavicon(null);
    }, []);

    /* Apply preset CSS vars whenever active preset changes */
    useEffect(() => {
        removeInjectedStyles();
        if (!activePreset) {
            setLogos({ light: null, dark: null, invertDark: false });
            return;
        }
        if (activePreset.lightVars) applyVarsToRoot(activePreset.lightVars, ":root");
        if (activePreset.darkVars) applyVarsToRoot(activePreset.darkVars, ".dark");
        setLogos({
            light: resolveLogoUrl(activePreset.logoLightUrl),
            dark: resolveLogoUrl(activePreset.logoDarkUrl),
            invertDark: toBool(activePreset?.darkVars?.invertLogoDark),
        });
    }, [activePreset]);

    useEffect(() => {
        applyFavicon(favicon);
    }, [applyFavicon, favicon]);

    /* Bootstrap */
    useEffect(() => {
        // Load from cache immediately
        const cachedTheme = getThemeFromCache();
        if (cachedTheme) {
            setActivePreset(cachedTheme);
            if (cachedTheme.favicon) {
                setFavicon(cachedTheme.favicon);
            }
        }

        // Fetch fresh theme from server in background
        const loadFresh = async () => {
            const json = await safeFetchJson("/theme/active");
            if (json?.success && json.data) {
                // Only update if different from cache
                if (JSON.stringify(json.data) !== JSON.stringify(cachedTheme)) {
                    setActivePreset(json.data);
                    saveThemeToCache(json.data);
                }
            }
        };

        loadFresh();
        refreshFavicon();
    }, [refreshFavicon]);

    return (
        <ThemePresetContext.Provider
            value={{ presets, activePreset, logos, favicon, refreshPresets, refreshActive, refreshFavicon }}
        >
            {children}
        </ThemePresetContext.Provider>
    );
}
