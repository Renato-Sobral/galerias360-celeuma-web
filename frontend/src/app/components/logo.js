"use client";

import { useLayoutEffect, useRef } from "react";
import { useThemePresets } from "./themePresetContext";

const DEFAULT_LIGHT_LOGO = "/celeumaBlack.svg";
const DEFAULT_DARK_LOGO = "/celeuma.svg";

/* Resolve logo URL */
function resolveLogoUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window === "undefined") return url;
  const apiBase = window.location.origin;
  if (!apiBase) return url;
  try {
    return new URL(url, apiBase).toString();
  } catch {
    return url;
  }
}

const Logo = ({ width = 170, height = 100 }) => {
  const { logos } = useThemePresets();
  const lightImgRef = useRef(null);
  const darkImgRef = useRef(null);

  // Update logos when context changes (after cache script has already replaced them)
  useLayoutEffect(() => {
    if (!lightImgRef.current) return;
    const nextLightSrc = logos?.light || DEFAULT_LIGHT_LOGO;
    const resolved = resolveLogoUrl(nextLightSrc);
    if (resolved) {
      lightImgRef.current.src = resolved;
    }
  }, [logos?.light]);

  useLayoutEffect(() => {
    if (!darkImgRef.current) return;
    const nextDarkSrc = logos?.dark || DEFAULT_DARK_LOGO;
    const resolved = resolveLogoUrl(nextDarkSrc);
    if (resolved) {
      darkImgRef.current.src = resolved;
    }
  }, [logos?.dark]);

  // Update invert flag
  useLayoutEffect(() => {
    if (!darkImgRef.current) return;
    darkImgRef.current.className = `hidden dark:block object-contain w-full h-full ${logos?.invertDark ? "dark:invert" : ""}`;
  }, [logos?.invertDark]);

  return (
    <div style={{ width, height }} className="relative" suppressHydrationWarning>
      {/* Logo para modo claro */}
      <img
        ref={lightImgRef}
        src={DEFAULT_LIGHT_LOGO}
        alt="Logo modo claro"
        className="block dark:hidden object-contain w-full h-full"
        suppressHydrationWarning
      />

      {/* Logo para modo escuro */}
      <img
        ref={darkImgRef}
        src={DEFAULT_DARK_LOGO}
        alt="Logo modo escuro"
        className={`hidden dark:block object-contain w-full h-full ${logos?.invertDark ? "dark:invert" : ""}`}
        suppressHydrationWarning
      />
    </div>
  );
};

export default Logo;
