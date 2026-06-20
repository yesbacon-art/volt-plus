import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        graphite: "#172026",
        ember: "#ffb703",
        volt: "#00a7c4",
        moss: "#4f8f46",
        signal: "#f35555"
      },
      boxShadow: {
        "soft-panel": "0 18px 50px rgba(20, 35, 45, 0.10)"
      }
    }
  },
  plugins: []
};

export default config;
