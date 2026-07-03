import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#0A0A0A",
          soft: "#101012",
          card: "#141416",
        },
        brand: {
          purple: "#7C3AED",
          pink: "#E85D9E",
          gold: "#E0A93B",
          cyan: "#22D3EE",
        },
      },
      letterSpacing: {
        tightest: "-0.045em",
      },
      backgroundImage: {
        "liquid-glass":
          "linear-gradient(120deg, #7C3AED 0%, #E0A93B 60%, #FFF7E8 100%)",
      },
      keyframes: {
        "orb-float": {
          "0%, 100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(4%,-6%,0) scale(1.08)" },
          "66%": { transform: "translate3d(-5%,4%,0) scale(0.96)" },
        },
        "gradient-pan": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "orb-float": "orb-float 26s ease-in-out infinite",
        "gradient-pan": "gradient-pan 8s ease infinite",
      },
    },
  },
  plugins: [typography],
};

export default config;
