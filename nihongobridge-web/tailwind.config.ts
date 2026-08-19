import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        washi: "#FAFAF7",
        sumi: "#1C1C1E",
        vermilion: "#C0392B",
        moss: "#4D6B57",
        amberink: "#B7791F",
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui"],
        jp: ["Noto Sans JP Variable", "Noto Sans JP", "sans-serif"],
      },
      boxShadow: {
        paper: "0 1px 0 rgba(28,28,30,.05), 0 12px 40px rgba(28,28,30,.06)",
        stamp: "0 3px 0 #8F2A20",
      },
      screens: {
        phone: "390px",
      },
      keyframes: {
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: ".62" },
        },
        countdown: {
          "0%": { transform: "scale(.86)", opacity: "0" },
          "25%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(1.08)", opacity: "0" },
        },
      },
      animation: {
        "pulse-soft": "pulseSoft 1.4s ease-in-out infinite",
        countdown: "countdown 1s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
