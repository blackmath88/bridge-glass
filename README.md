# Bridgeboard (app)

Dark-glass strategy board for the Bridge Work AI Lab. React + Vite + TypeScript, deploys to Cloudflare Pages. Templates load live from the [`bridge-glass`](https://github.com/blackmath88/bridge-glass) content repo — the single source of truth.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. Draw with mouse, touch or Samsung S Pen.

## Build

```bash
npm run build      # → dist/
npm run preview    # preview the production build
```

## Deploy — Cloudflare Pages

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Route | `/lab/bridgeboard` |

`public/_redirects` handles SPA routing. `base: '/'` is set in `vite.config.ts`.

## Templates

The Template panel fetches `index.json` from `bridge-glass_content/bridgeboard/templates/` and renders each on demand. Coordinates are normalized `0..1` in the repo and scaled to the live stage size on load, so the same template renders correctly on phone, notebook and projector.

To point at a different template source, set `VITE_TEMPLATE_BASE` (see `.env.example`).

## Structure

```
src/
├── components/   Board, Toolbar, TemplatePanel, SignalMark
├── lib/          types, canvas engine, template loader
└── styles/       Bridge Work tokens (cyan accent)
```

## Roadmap

- **Phase 1 (now)** — board, templates from repo, PNG/JSON export ✓
- **Phase 2** — remote S Pen / QR join via Cloudflare Worker + Durable Object (`/host`, `/remote/:id`)
- **Phase 3** — Control Center at `/admin`

---
© 2026 bridge-work.ai · Basel
