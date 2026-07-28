import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    // `lib/` dołożone 2026-07-26 (audyt Klientów). Mapy „status → klasy"
    // (CLIENT_STATUS_CLASS, LEAD_STATUS_CLASS, statusy projektów/faktur/umów)
    // mieszkają w `lib/*.ts` — czyli POZA tym, co Tailwind skanował. Klasa
    // stamtąd działała wyłącznie wtedy, gdy przypadkiem pojawiała się też
    // gdzieś w `app/`; nowa nie działała wcale i nie dawała żadnego objawu
    // poza pigułką bez tła. Złapane przy zmianie kolorów statusu klienta:
    // `bg-brand-purple/20` było w kodzie, a `getComputedStyle` pokazywał
    // przezroczyste tło.
    "./lib/**/*.{js,ts,jsx,tsx}",
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
          // Odcienie pochodne — WYŁĄCZNIE dla kalendarza, który musi odróżnić
          // dziewięć rodzajów wpisu, a rodzin marki są cztery (decyzja
          // właściciela 2026-07-22: "panel schodzi do palety marki").
          // Zamiast dobierać obce kolory (było: orange-500, red-500,
          // indigo-500, #4ea7fc), każdy rodzaj dostaje odcień swojej rodziny,
          // więc kolor niesie DWIE informacje naraz: rodzina mówi "o co
          // chodzi", odcień — "co dokładnie".
          "cyan-deep": "#0E9DB8", // Klient
          "cyan-soft": "#7DE4F5", // Połączenie
          "gold-deep": "#B87A1F", // Lead
          "purple-soft": "#A78BFA", // Email
          // Środkowy stopień RAMPY PILNOŚCI (Moduł 59): złoto → pomarańcz →
          // czerwień, czyli „termin przed nami" → „minął" → „minął dawno".
          // Ta sama wartość co `Color.markaPomarancz` w apce.
          //
          // Świadomie #F97316, a NIE `orange-400` (#FB923C), którego panel
          // używał dotąd w „Testach / review": zmierzone ΔE do brandowego
          // złota to 38,7 dla #F97316 i tylko 23,6 dla #FB923C. Przy 23,6 dwa
          // sąsiednie stopnie rampy zlewają się w pamięci; przy 38,7 nie.
          // Kontrast na tle karty 6,4:1 — powyżej progu 4,5.
          orange: "#F97316",
          // Ta sama stonowana czerwień, co `Color.ciemnaCzerwien` w apce —
          // systemowa czerwień jest w tym systemie zakazana ("czerwień znika").
          red: "#8B272F", // Nieodebrane — obwódka, kropka, tło
          // Jedyny odcień, który MUSI mieć wariant tekstowy: #8B272F na
          // czarnym tle daje kontrast ~1,75:1, czyli tekst nie do odczytania.
          // Stary kod robił dokładnie ten sam podział (border-red-500 +
          // text-red-400) i to była jego jedyna słuszna decyzja.
          "red-soft": "#CE6A70", // Nieodebrane — sam tekst
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
