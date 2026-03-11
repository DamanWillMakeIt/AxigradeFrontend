import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        black: "#000000",
        white: "#FFFFFF",
        "theme-bg": "var(--theme-bg)",
        "theme-fg": "var(--theme-fg)",
        "theme-border": "var(--theme-border)",
        "theme-invert-border": "var(--theme-invert-border)",
        "theme-hover-bg": "var(--theme-hover-bg)",
        "theme-hover-fg": "var(--theme-hover-fg)",
      },
      fontFamily: {
        display: ["var(--font-italiana)", "serif"],
        body: ["var(--font-cormorant)", "serif"],
        mono: ["var(--font-space-mono)", "monospace"],
      },
      borderRadius: {
        DEFAULT: "0",
      },
      boxShadow: {
        brutal: "4px 4px 0px 0px var(--theme-border)",
        "brutal-invert": "-4px -4px 0px 0px var(--theme-border)",
      },
    },
  },
  plugins: [],
};
export default config;
