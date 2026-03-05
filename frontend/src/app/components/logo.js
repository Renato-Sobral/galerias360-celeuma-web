"use client";

import Image from "next/image";
import { useThemePresets } from "./themePresetContext";

const Logo = ({ width = 170, height = 100 }) => {
  const { logos } = useThemePresets();

  const lightSrc = logos?.light || "/celeumaBlack.svg";
  const darkSrc = logos?.dark || "/celeuma.svg";

  return (
    <div style={{ width, height }} className="relative">
      {/* Logo para modo claro */}
      {lightSrc.startsWith("/") ? (
        <Image
          src={lightSrc}
          alt="Logo modo claro"
          fill
          className="block dark:hidden object-contain"
          priority
        />
      ) : (
        <img
          src={lightSrc}
          alt="Logo modo claro"
          className="block dark:hidden object-contain w-full h-full"
        />
      )}

      {/* Logo para modo escuro */}
      {darkSrc.startsWith("/") ? (
        <Image
          src={darkSrc}
          alt="Logo modo escuro"
          fill
          className={`hidden dark:block object-contain ${logos?.invertDark ? "dark:invert" : ""}`}
          priority
        />
      ) : (
        <img
          src={darkSrc}
          alt="Logo modo escuro"
          className={`hidden dark:block object-contain w-full h-full ${logos?.invertDark ? "dark:invert" : ""}`}
        />
      )}
    </div>
  );
};

export default Logo;
