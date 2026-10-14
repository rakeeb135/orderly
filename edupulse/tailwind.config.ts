import type { Config } from "tailwindcss";

// Colours are CSS variables (see globals.css) so light/dark follow the approved prototype palette.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        card: "var(--card)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        brand: "var(--brand)",
        "brand-fg": "var(--brand-fg)",
        soft: "var(--soft)",
        warn: "var(--warn)",
        danger: "var(--danger)",
      },
    },
  },
  plugins: [],
};
export default config;
