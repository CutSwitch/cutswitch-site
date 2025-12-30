import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0E1020",
        brand: {
          DEFAULT: "#655DFF",
          highlight: "#B9C0FF",
          shadow: "#8F9BFF",
          edge: "#4B3CFF",
        },
        surface: {
          1: "rgba(255,255,255,0.04)",
          2: "rgba(255,255,255,0.06)",
          3: "rgba(255,255,255,0.09)",
        },
        line: "rgba(255,255,255,0.10)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(101,93,255,0.35), 0 20px 60px rgba(75,60,255,0.22)",
        soft: "0 20px 60px rgba(0,0,0,0.45)",
      },
      backgroundImage: {
        "hero-radial":
          "radial-gradient(900px circle at 20% 10%, rgba(101,93,255,0.22), transparent 55%), radial-gradient(700px circle at 70% 30%, rgba(185,192,255,0.16), transparent 55%), radial-gradient(600px circle at 50% 80%, rgba(75,60,255,0.12), transparent 55%)",
        "card-sheen":
          "linear-gradient(120deg, rgba(185,192,255,0.12), rgba(101,93,255,0.06), rgba(0,0,0,0))",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "0%": { transform: "translateX(-40%)" },
          "100%": { transform: "translateX(140%)" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        shimmer: "shimmer 2.5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
