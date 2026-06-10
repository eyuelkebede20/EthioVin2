import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        ethiovin: {
          primary: "#f97316", // orange-500
          "primary-content": "#ffffff",
          secondary: "#fb923c", // orange-400
          "secondary-content": "#7c2d12",
          accent: "#f59e0b", // amber-500
          "accent-content": "#ffffff",
          neutral: "#1f2937",
          "neutral-content": "#ffffff",
          "base-100": "#ffffff",
          "base-200": "#fff7ed", // orange-50
          "base-300": "#ffedd5", // orange-100
          "base-content": "#1c1917",
          info: "#0ea5e9",
          success: "#16a34a",
          warning: "#f59e0b",
          error: "#dc2626",
          "--rounded-box": "1.25rem",
          "--rounded-btn": "0.6rem",
          "--rounded-badge": "1.9rem",
          "--animation-btn": "0.25s",
          "--btn-focus-scale": "0.97",
        },
      },
    ],
    logs: false,
  },
};
