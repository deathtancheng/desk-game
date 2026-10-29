import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#171310",
        panel: "#211b16",
        panel2: "#2a231d",
        line: "#3d3127",
        neon: "#d97757",
        mint: "#9aa88a",
        ember: "#c9563f",
        muted: "#a29382",
        paper: "#f1e6d4",
        white: "#f3ead9",
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', "system-ui", "sans-serif"],
        serif: ['"Songti SC"', '"STSong"', '"Noto Serif SC"', "serif"],
        mono: ['"SFMono-Regular"', "Consolas", "monospace"],
      },
      boxShadow: {
        neon: "0 20px 50px rgba(0,0,0,0.38)",
        ember: "0 20px 50px rgba(201,86,63,0.14)",
        paper: "0 2px 0 rgba(243,234,217,0.06), 0 18px 40px rgba(0,0,0,0.32)",
      },
    },
  },
  plugins: [],
};

export default config;
