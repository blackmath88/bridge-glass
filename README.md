<!-- BEGIN public-repo-header -->
<div align="center">

# Bridgeboard (app)

<a href="https://github.com/blackmath88/bridge-glass"><img alt="Primary language: TypeScript" src="https://img.shields.io/badge/language-TypeScript-526078?style=flat"></a>
<a href="https://github.com/blackmath88/bridge-glass#readme"><img alt="README" src="https://img.shields.io/badge/docs-readme-16796f?style=flat"></a>
<a href="https://github.com/blackmath88/bridge-glass/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/blackmath88/bridge-glass?style=flat&amp;color=737373"></a>

</div>
<!-- END public-repo-header -->

Dark-glass strategy board for the Bridge Work AI Lab. React + Vite + TypeScript, deploys to Cloudflare Pages. Templates load live from the [`bridge-glass_content`](https://github.com/blackmath88/bridge-glass_content) content repo — the single source of truth.

## Run locally

```bash
npm install
npm run dev
```

Open the printed localhost URL. Draw with mouse, touch or Samsung S Pen.
Use the wheel or pinch to zoom, Space-drag or two-finger drag to pan, and `0` to reset the viewport.

## Build

```bash
npm run build      # → dist/
npm run preview    # preview the production build
npm test           # dependency-free core regression suite
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
├── lib/          types, canvas engine, object/viewport geometry, history, storage, templates
└── styles/       Bridge Work tokens (cyan accent)
```

## Roadmap

Board persistence is local-first in Phase 1. All storage access is isolated in `src/lib/store.ts`, whose API can be backed by a Phase 2 Worker + D1/Durable Objects without changing UI components.

- **Phase 1 (complete)** — object selection/move/delete, command undo/redo, sticky notes and inline text, multiple autosaved local boards, object eraser/restyling, controlled template application, pan/zoom, PNG/JSON export ✓
- **Phase 2** — remote S Pen / QR join via Cloudflare Worker + Durable Object (`/host`, `/remote/:id`)
- **Phase 3** — Control Center at `/admin`

---
© 2026 bridge-work.ai · Basel
