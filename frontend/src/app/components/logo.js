"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useThemePresets } from "./themePresetContext";

const DEFAULT_LIGHT_LOGO = "/celeumaBlack.svg";
const DEFAULT_DARK_LOGO = "/celeuma.svg";

const Logo = ({ width = 170, height = 100 }) => {
  const { logos } = useThemePresets();
  const [lightSrc, setLightSrc] = useState(DEFAULT_LIGHT_LOGO);
  const [darkSrc, setDarkSrc] = useState(DEFAULT_DARK_LOGO);

  useEffect(() => {
    const nextLightSrc = logos?.light || DEFAULT_LIGHT_LOGO;

    if (nextLightSrc.startsWith("/")) {
      setLightSrc(nextLightSrc);
      return;
    }

    let cancelled = false;
    setLightSrc(null);

    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setLightSrc(nextLightSrc);
    };
    img.onerror = () => {
      if (!cancelled) setLightSrc(nextLightSrc);
    };
    img.src = nextLightSrc;

    return () => {
      cancelled = true;
    };
  }, [logos?.light]);

  useEffect(() => {
    const nextDarkSrc = logos?.dark || DEFAULT_DARK_LOGO;

    if (nextDarkSrc.startsWith("/")) {
      setDarkSrc(nextDarkSrc);
      return;
    }

    let cancelled = false;
    setDarkSrc(null);

    const img = new window.Image();
    img.onload = () => {
      if (!cancelled) setDarkSrc(nextDarkSrc);
    };
    img.onerror = () => {
      if (!cancelled) setDarkSrc(nextDarkSrc);
    };
    img.src = nextDarkSrc;

    return () => {
      cancelled = true;
    };
  }, [logos?.dark]);

  return (
    <div style={{ width, height }} className="relative">
      {/* Logo para modo claro */}
      {lightSrc ? (
        lightSrc.startsWith("/") ? (
          <Image
            key={lightSrc}
            src={lightSrc}
            alt="Logo modo claro"
            fill
            className="block dark:hidden object-contain"
            priority
          />
        ) : (
          <img
            key={lightSrc}
            src={lightSrc}
            alt="Logo modo claro"
            className="block dark:hidden object-contain w-full h-full"
          />
        )
      ) : null}

      {/* Logo para modo escuro */}
      {darkSrc ? (
        darkSrc.startsWith("/") ? (
          <Image
            key={darkSrc}
            src={darkSrc}
            alt="Logo modo escuro"
            fill
            className={`hidden dark:block object-contain ${logos?.invertDark ? "dark:invert" : ""}`}
            priority
          />
        ) : (
          <img
            key={darkSrc}
            src={darkSrc}
            alt="Logo modo escuro"
            className={`hidden dark:block object-contain w-full h-full ${logos?.invertDark ? "dark:invert" : ""}`}
          />
        )
      ) : null}
    </div>
  );
};

export default Logo;
