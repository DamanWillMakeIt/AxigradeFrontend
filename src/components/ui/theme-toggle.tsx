"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="brutal-navlink w-full border border-theme-border"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? (
        <Moon size={18} strokeWidth={1} />
      ) : (
        <Sun size={18} strokeWidth={1} />
      )}
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
