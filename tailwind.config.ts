import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        coral: {
          DEFAULT: "#D85A30",
          50: "#FDF1EC",
          100: "#FCE3D9",
          200: "#F7C1AC",
          300: "#F19E7E",
          400: "#E97C51",
          500: "#D85A30",
          600: "#B84826",
          700: "#93381E",
          800: "#6E2916",
          900: "#491B0E",
        },
        teal: {
          DEFAULT: "#1F6F6B",
          50: "#EAF4F3",
          100: "#D0E6E4",
          200: "#A1CDC9",
          300: "#72B4AE",
          400: "#439A93",
          500: "#1F6F6B",
          600: "#195A57",
          700: "#134441",
          800: "#0C2D2B",
          900: "#061716",
        },
      },
    },
  },
};

export default config;
