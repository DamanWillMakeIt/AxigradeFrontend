export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "axigrade-theme";

export const themes = {
  light: {
    background: "#FFFFFF",
    foreground: "#000000",
    border: "#000000",
    "hover-bg": "#000000",
    "hover-fg": "#FFFFFF",
  },
  dark: {
    background: "#000000",
    foreground: "#FFFFFF",
    border: "#FFFFFF",
    "hover-bg": "#FFFFFF",
    "hover-fg": "#000000",
  },
} as const;

