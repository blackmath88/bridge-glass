# Generate Bridgeboard Template

> Creates a new Bridgeboard JSON template from a workshop concept.

You are generating a Bridgeboard template for the Bridge Work AI Lab.

Create a JSON template for a dark-mode glassboard facilitation canvas, following the schema at `bridgeboard/schema/bridgeboard-template.schema.json`.

**Style**
- black background (`#050505`)
- premium minimal consulting aesthetic
- thin luminous lines, restrained colours (cream `#f0ebe3`, teal `#1a7a6d`, cyan `#2a8fa0`, grey `#8a8a8a`)
- rose `#d4416b` only for warnings / "question hard"
- no childish whiteboard style, no generic SaaS dashboard feel

**Rules**
- all coordinates normalized `0..1`
- geometry rationed, not scattered
- accent (cyan) used only on the one element that matters most

**Purpose:**
[INSERT PURPOSE]

**The template should help explain:**
[INSERT CONCEPT]

Return only valid JSON following the Bridgeboard template schema.
