import type { Config } from "tailwindcss";

/**
 * Fries for the Table brand system (from the brand deck):
 *  Heritage Green on Cream/Ivory, with Sand and Brass as warm accents and Tomato as the pop colour.
 *  Display: Caprasimo (Cooper-style, matches the logo). Editorial serif: Libre Caslon Text.
 *  UI: DM Sans. Script ("Swipe in person"): Allison.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: "#1E3A2B", soft: "#2E5240", deep: "#13271C", ink: "#0D1C14" },
        cream: { DEFAULT: "#F3EAD7", light: "#FBF6EB", dark: "#E8DCC2" },
        sand: { DEFAULT: "#CDB28C", light: "#E3D2B8" },
        brass: { DEFAULT: "#A97A3F", light: "#C99A5B" },
        tomato: { DEFAULT: "#B4432F", light: "#D0624C" },
      },
      fontFamily: {
        display: ['"Caprasimo"', '"Cooper Black"', "Georgia", "serif"],
        serif: ['"Libre Caslon Text"', "Georgia", "serif"],
        sans: ['"DM Sans"', "system-ui", "sans-serif"],
        script: ['"Allison"', "cursive"],
      },
      letterSpacing: { caps: "0.22em" },
      backgroundImage: {
        // Brand checkerboard (green/cream), used as a thin accent strip.
        checker:
          "repeating-conic-gradient(#1E3A2B 0% 25%, #F3EAD7 0% 50%)",
        paper:
          "radial-gradient(120% 80% at 50% 0%, #FBF6EB 0%, #F3EAD7 60%, #EEE3CC 100%)",
        candle:
          "radial-gradient(90% 60% at 50% 0%, rgba(201,154,91,.22) 0%, rgba(19,39,28,0) 70%)",
      },
      backgroundSize: { checker: "24px 24px" },
      boxShadow: {
        card: "0 1px 0 rgba(255,255,255,.6) inset, 0 12px 30px -18px rgba(19,39,28,.45)",
        lift: "0 24px 48px -24px rgba(13,28,20,.55)",
      },
    },
  },
  plugins: [],
};
export default config;
