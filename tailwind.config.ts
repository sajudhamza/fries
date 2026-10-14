import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: { 950: "#0B0A10", 900: "#13111B", 800: "#1C1927", 700: "#2A2638", 600: "#3B3650" },
        haze: { 100: "#F4F1FA", 300: "#C9C3D9", 500: "#8E87A3" },
        rose: { 300: "#FF9DB0", 400: "#FF7A93", 500: "#F2557A", 600: "#D23D63" },
        citrus: { 400: "#FFC56B" },
      },
      fontFamily: {
        display: ['"Fraunces"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      backgroundImage: {
        glow: "radial-gradient(60% 50% at 50% 0%, rgba(242,85,122,.28) 0%, rgba(11,10,16,0) 70%)",
      },
    },
  },
  plugins: [],
};
export default config;
