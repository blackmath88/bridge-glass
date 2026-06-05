# bridge-glass

**Bridgeboard** — the Bridge Work AI Lab session system. A dark-glass strategy board for live AI adoption explanation, plus the versioned template library that turns each good session into a reusable practice asset.

This repo is the **single source of truth** for Bridgeboard templates, prompts and archived sessions. The board app and the Control Center both read from here. JSON-first, GitHub-backed, LLM-friendly, portable across devices and agents.

```
bridge-glass/
└── bridgeboard/
    ├── schema/                 # template JSON schema (the contract)
    ├── templates/              # reusable facilitation canvases (JSON)
    │   └── index.json          # discoverable manifest
    ├── template-packs/         # curated sets with a facilitation arc
    ├── prompts/                # copy-ready system prompts (Markdown)
    └── sessions/exported/      # archived board exports (intent only)
```

## The model

Three layers, only the first two of which need code today:

| Layer | What it is | Backend? |
|---|---|---|
| **Board** | Dark glass canvas, tools, present mode, export | No — static |
| **Control Center** | Sessions, template library, prompt clipboard, lifecycle | No — static, reads this repo |
| **Realtime** | Remote S Pen, QR join, live sync | Yes — Cloudflare Worker + Durable Object (Phase 2) |

Templates and archived sessions live here in Git. Only *live* session state needs a backend. That keeps the whole practice asset free, versioned, and independent of any running service.

## Templates

Each template is one JSON file validated against [`schema/bridgeboard-template.schema.json`](bridgeboard/schema/bridgeboard-template.schema.json). Coordinates are **normalized 0..1** so any screen — phone, notebook, projector — renders the same board.

Six starters ship in [`templates/`](bridgeboard/templates/):

| File | Name | Category |
|---|---|---|
| `ai-adoption-flywheel.json` | AI Adoption Flywheel | adoption |
| `people-work-data-governance.json` | People / Work / Data / Governance | adoption |
| `risk-value-matrix.json` | Risk / Value Matrix | governance |
| `m365-readiness-map.json` | M365 / Copilot Readiness Map | m365 |
| `human-in-the-loop-flow.json` | Human-in-the-loop Flow | governance |
| `ai-decision-layers.json` | AI Decision Layers | leadership |

[`templates/index.json`](bridgeboard/templates/index.json) is the manifest apps fetch to list the library without crawling the folder.

## Palette (locked)

`black #050505` · `cream #f0ebe3` · `teal #1a7a6d` · `cyan #2a8fa0` (Bridgeboard accent) · `grey #8a8a8a` · `purple #3d1f47` · `rose #d4416b` (warnings only).

Accent is **earned** — it appears on the one element that matters, never as decoration.

## Lifecycle

Sessions are temporary by default. Export what you need. Archive only what should become part of the lab knowledge base.

- Temporary live session — 24h
- Saved lab session — 30d
- Archived — manual
- Template — permanent

## Prompts

Five copy-ready system prompts in [`prompts/`](bridgeboard/prompts/) keep template generation, summaries and content on-brand: generate template, convert slide, summarise session, LinkedIn from board, style check.

---

© 2026 bridge-work.ai · Basel, Switzerland
