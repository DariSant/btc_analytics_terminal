---
name: explain
description: Generate a clear, visually structured, beginner-friendly HTML explanation with diagrams for any topic (or the last discussed topic if omitted).
---

# `/explain [topic]` Command Workflow

When the user invokes `/explain` (with an optional topic, e.g., `/explain session CVD backfill`) or asks for a visual explanation using this workflow:

## 1. Determine the Topic & Scope
- If a topic is provided after `/explain`, explain that exact topic in the context of this project.
- If no topic is provided, explain the **most recent topic** discussed in the conversation (or the active section/file in focus).
- Assume the user **may lack deep technical background**: translate jargon, acronyms, and implementation details into plain, intuitive language using concrete analogies where helpful, without losing factual accuracy.

## 2. Choose the Diagram Strategy
Visuals are central to `/explain`. Decide how each diagram, schema, chart, or visual element should be built:
- **Coded Diagrams (Default when clean & structured)**: Inline SVG or crisp HTML/CSS flowcharts, architecture schemas, timelines, and data-flow diagrams. If a coded diagram style is visually appealing, keep it consistent across future `/explain` outputs in this project.
- **Image Generation (`image-generator` subagent)**: Use when a conceptual illustration or richer visual metaphor is clearly better served by a generated image rather than a geometric/structural diagram.
- **Ask When Unsure**: If you are unsure whether a diagram, placeholder, schema, chart, or visual element will look better **via coding** or **via the image-generation subagent**, **stop and ask the user** how they want it designed before generating the file.

## 3. Output Format & Storage
- **Format**: Prefer a standalone, single-file **`.html`** document (fast-loading, lightweight, zero external build dependencies, works offline). Only use another format if the user explicitly requests it or another format is strictly better for the content.
- **Location**: Save inside a dedicated, self-explanatory subfolder at the workspace root:
  - `explanations/<self-explanatory-slug>.html` (e.g., `explanations/black-76-gamma-exposure.html`).
  - If any generated images are used, store them alongside in `explanations/assets/` and reference them with relative paths.

## 4. Visual & Editorial Standards ("Zero AI-Slop")
- **Strong Typography Hierarchy**: Clear, bold section headers, scannable subheadings, and short, concise body paragraphs (or crisp bullet points). Prioritize headers and visual blocks over walls of text for quick comprehension.
- **Technical & Professional Palette**: Use a calibrated, high-contrast editorial/institutional palette (e.g., slate/charcoal surfaces `#0f1419` or clean off-white `#f8fafc`, crisp `1px` hairline borders, muted steel/slate text, and 1–2 purposeful accent colors such as cyan/blue and amber/emerald for semantic states).
- **Anti-Slop Rules**:
  - **No** generic purple/pink/neon gradients, **no** `backdrop-filter` glassmorphism, **no** heavy drop-shadow cards, **no** decorative emoji clutter, and **no** vague filler prose or buzzwords.
  - Keep CSS and inline SVG clean, lightweight, and responsive.

## 5. Deliver to the User
- Write the file to `explanations/<self-explanatory-slug>.html`.
- Reply concisely with a clickable `file:///` link to the generated file and a brief 1–2 sentence summary of what the explanation covers.
