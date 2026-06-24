import type { Config } from "tailwindcss";

// Tailwind is wired ENTIRELY to the CSS-variable tokens in app/globals.css.
// Never hard-code a hex here — add/adjust a token in globals.css instead, so the
// design system stays a single source of truth.
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: rgb("--brand-50"),
          100: rgb("--brand-100"),
          200: rgb("--brand-200"),
          300: rgb("--brand-300"),
          400: rgb("--brand-400"),
          500: rgb("--brand-500"),
          600: rgb("--brand-600"),
          700: rgb("--brand-700"),
          800: rgb("--brand-800"),
          900: rgb("--brand-900"),
        },
        accent: {
          400: rgb("--accent-400"),
          500: rgb("--accent-500"),
          600: rgb("--accent-600"),
        },
        bg: rgb("--bg"),
        surface: rgb("--surface"),
        "surface-2": rgb("--surface-2"),
        border: rgb("--border"),
        fg: rgb("--fg"),
        "fg-muted": rgb("--fg-muted"),
        success: rgb("--success"),
        warning: rgb("--warning"),
        error: rgb("--error"),
        info: rgb("--info"),
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow)",
        lg: "var(--shadow-lg)",
        brand: "var(--shadow-brand)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        // Type scale (1.25 ratio), step names map to usage.
        caption: ["0.75rem", { lineHeight: "1rem" }],
        body: ["0.9375rem", { lineHeight: "1.5rem" }],
        lead: ["1.125rem", { lineHeight: "1.75rem" }],
        title: ["1.5rem", { lineHeight: "2rem", fontWeight: "700" }],
        display: ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.02em", fontWeight: "800" }],
        hero: ["3.25rem", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "800" }],
      },
      transitionTimingFunction: {
        brand: "var(--ease)",
      },
      transitionDuration: {
        fast: "var(--dur-fast)",
        DEFAULT: "var(--dur)",
        slow: "var(--dur-slow)",
      },
    },
  },
  plugins: [],
};

export default config;
