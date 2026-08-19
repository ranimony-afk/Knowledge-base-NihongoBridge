import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        washi: "#FAFAF7",
        sumi: "#1C1C1E",
        vermilion: "#C0392B",
        moss: "#4D6B57",
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui"],
        jp: ["Noto Sans JP Variable", "Noto Sans JP", "sans-serif"],
      },
      boxShadow: {
        paper: "0 1px 0 rgba(28,28,30,.05), 0 16px 50px rgba(28,28,30,.10)",
        stamp: "0 3px 0 #8F2A20",
      },
      keyframes: {
        chatIn: {
          "0%": { opacity: "0", transform: "translateY(12px) scale(.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        blink: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "chat-in": "chatIn 180ms ease-out both",
        blink: "blink 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
