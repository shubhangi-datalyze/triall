# Datalyze

Marketing site for Datalyze (analytics & growth partner). Next.js 15 App Router + TypeScript, deployed on Vercel.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in values
npm run dev
```

Open **http://localhost:3000**.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run Next.js ESLint |
| `npm run typecheck` | Type-check without emitting |

## Structure

- **`app/`** - App Router routes, layouts, route handlers, and private `_components/`.
- **`lib/`** - Fonts (`next/font`), analytics helper, data files, API helpers (BigQuery / Resend / Ghost / download tokens).
- **`public/`** - Static assets (logos, fonts, videos, images).
- **`next.config.ts`** - Framework config (image optimization, etc.).

## Key routes

- `/` - Homepage
- `/about`, `/contact`, `/faqs`, `/resources`
- `/case-studies` (listing from `lib/data/case-studies.ts`; each card links out to `blog.joindatalyze.com`)
- `/tools` + `/tools/[toolId]` (SSG'd from `lib/data/tools.ts`)
- `/tools/analytics-maturity-grader` + `/results` (interactive quiz)
- `/api/health`, `/api/tool-downloads`, `/api/tool-downloads/file/[token]` (Vercel Functions)

## Environment

Copy `.env.example` to `.env.local` for local development. On Vercel, set the same keys via `vercel env add` for the Production, Preview, and Development scopes.

## Design system

Hand-written CSS in `app/globals.css` built on the tokens in the `:root` block. Three fonts via `next/font`:

- **Cooper Md BT** - display headlines (`--font-display`). Not licensed for the web here, so a locally installed copy wins where one exists and **Fraunces** is the fallback almost everyone sees.
- **Poppins** - body copy (`--font-body`), set at 300/1.7
- **JetBrains Mono** - numbers, code, mono labels (`--font-mono`)

Wine rose `#e1607a` leads and is reserved for actions. Sapphire `#5b7fff` carries structure and icon strokes, amber `#e0a458` carries result figures, and champagne gold `#d9b871` handles small premium details. Layered near-black surfaces, translucent hairline borders, rounded corners and pill buttons.

## Deploy

```bash
vercel link
vercel env add   # for every key in .env.example
vercel deploy           # preview
vercel deploy --prod    # production
```
