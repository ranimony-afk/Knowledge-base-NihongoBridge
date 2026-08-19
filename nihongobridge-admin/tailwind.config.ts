import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./stores/**/*.ts"],
  theme: {
    extend: {
      colors: {
        paper: "#F7F7F3",
        ink: "#202124",
        admin: "#B63A2E",
        navy: "#26364A",
        sage: "#55735E",
      },
      fontFamily: {
        sans: ["Inter Variable", "Inter", "sans-serif"],
        jp: ["Noto Sans JP Variable", "Noto Sans JP", "sans-serif"],
      },
      boxShadow: {
        panel: "0 12px 40px rgba(32,33,36,.07)",
      },
    },
  },
  plugins: [],
};
export default config;
