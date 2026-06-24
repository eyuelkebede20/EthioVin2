# EthioVin — Design System

A single source of truth for the product's look. **All tokens live as CSS variables
in `app/globals.css`** and are exposed to Tailwind in `tailwind.config.ts`. Never
hard-code a hex value in a component — use a token (Tailwind class) so the system
stays consistent and themeable.

## Why CSS variables + Tailwind
Colors are stored as RGB channel triplets (`--brand-500: 249 115 22`) so Tailwind can
apply opacity (`bg-brand-500/40`). Change a token once in `globals.css` and every
screen updates. This is the "pure design system" the milestone asked for.

## Color
Warm orange/amber brand to match EthioVin.

| Token | Tailwind | Use |
|-------|----------|-----|
| `--brand-500` | `brand-500` | primary action / brand |
| `--brand-600` | `brand-600` | primary hover |
| `--brand-100` | `brand-100` | tinted chips / badges |
| `--accent-500` | `accent-500` | secondary highlight (amber) |
| `--surface` | `surface` | page background |
| `--bg` | `bg` | card / panel background |
| `--border` | `border` | hairlines |
| `--fg` / `--fg-muted` | `fg` / `fg-muted` | primary / secondary text |
| `--success` `--warning` `--error` `--info` | same | semantic states |

## Type scale (1.25 ratio)
`text-caption` · `text-body` · `text-lead` · `text-title` · `text-display` · `text-hero`.
Body copy defaults to `text-body`; headings use `title`/`display`/`hero`.

## Radius
`rounded-sm` (.375) · `rounded` (.75) · `rounded-lg` (1) · `rounded-xl` (1.5) · `rounded-full`.

## Elevation
`shadow-sm` · `shadow` · `shadow-lg` · `shadow-brand` (orange glow for primary CTAs).

## Motion
`duration-fast` (150ms) · `duration` (250ms) · `duration-slow` (400ms), eased with
`ease-brand`. Keep interactions snappy; never animate slower than `duration-slow`.

## Component primitives (in `globals.css` `@layer components`)
- `.btn-brand` — primary CTA (orange, brand shadow).
- `.btn-ghost` — secondary (bordered, neutral).
- `.card` — bordered, elevated surface.

## Accessibility
`:focus-visible` shows a brand outline ring (keyboard nav). Maintain AA contrast:
brand-600+ on white, white on brand-500+.

## Run it
```
cd web && npm install && npm run dev
```
(The app is authored but dependencies are not installed in the build loop.)
