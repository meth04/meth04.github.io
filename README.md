# Math in Motion

A personal mathematics publication at [meth04.github.io](https://meth04.github.io/):
long-form essays on the mathematics behind machine learning, with interactive
visualizations that are part of the argument rather than decoration.

## Principles

- Static HTML first. No framework runtime, no hydration, no analytics, no cookies.
- Light mode only, serif for prose, sans-serif for interface.
- Every figure works with the keyboard, on touch, and under `prefers-reduced-motion`;
  every article remains complete and readable with JavaScript switched off.
- Animation runs only while a figure is on screen and the tab is visible.

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Site generator | Astro (static output) | Zero client JS by default; MDX and content collections built in |
| Content | MDX + content collections | Interactive components inside prose, with a typed frontmatter schema |
| Maths | KaTeX (`remark-math`, `rehype-katex`) | Rendered at build time; no client-side maths engine |
| Visualizations | Hand-written TypeScript, SVG (Canvas only for the particle field) | ~20 kB gzipped total, loaded per figure on demand |
| Search | Build-time JSON index + ~2 kB of client code | No hosted search service |
| Images | `sharp` at build time for Open Graph cards | Build-time only; nothing reaches the browser |
| Deployment | GitHub Actions → GitHub Pages | Free, static, no server |

## Commands

```bash
npm install       # install dependencies
npm run dev       # development server on http://localhost:4321
npm run check     # astro check (TypeScript + .astro diagnostics)
npm run build     # production build into dist/
npm run preview   # serve the production build
npm run format    # prettier
```

## Languages

Articles declare their own language. The archive can be filtered, and each
language has its own statically generated page:

- `/blog/` — every article, with EN / VI filter chips
- `/blog/lang/en/`, `/blog/lang/vi/` — one language each

Filtering is done with links to real pages rather than a client-side toggle, so
it works without JavaScript and can be bookmarked. The search page additionally
offers a language filter, and search is diacritic-insensitive: "xac suat" finds
"xác suất".

An article's `lang` drives `<html lang>`, the date format, the reading-time
label, the article-level interface text (`src/lib/i18n.ts`) and the Vietnamese
serif stack. Interactive figures receive the language too and label their own
controls accordingly.

Two articles that are translations of each other share a `translationKey`; each
then links to the other, `hreflang` alternates are emitted, and listings that
show one entry per piece of writing (the homepage, topic pages) collapse them to
a single card.

The global navigation stays in English because it is shared by both archives;
topics are English labels for the same reason, so a topic page aggregates
articles in either language.

## Writing an article

Create `src/content/blog/<slug>.mdx`. The frontmatter schema lives in
`src/content.config.ts`:

```yaml
---
title: 'Article title'
description: 'One or two sentences, used for search results and social cards.'
pubDate: 2026-08-18
updatedDate: 2026-09-01 # optional
lang: vi # 'en' (default) or 'vi'
translationKey: some-shared-key # optional, links the versions of one article
tags: ['gradient descent']
topics: ['optimization']
draft: false
featured: false
---
```

Drafts are visible in `npm run dev` and excluded from the production build.

Article components available inside MDX:

- `Callout` — `note`, `insight`, `warning`, `misconception`
- `Definition`, `Theorem` (`kind`, `number`, `name`), `Proof`
- `Exercise` — a numbered problem whose solution sits in a collapsed `<details>`
- `Equation` (`number`, `id`) and `EqRef` for numbered, cross-referenced display maths
- `Figure` for static graphics, `InteractiveFigure` for interactive ones

An interactive figure names a module from `src/lib/visualization/registry.ts`:

```mdx
<InteractiveFigure
  id="fig-contour"
  label="Figure 4"
  title="Gradient descent on a contour map"
  hint="Drag anywhere on the map to move the starting point."
  viz="contour"
>
  <strong>What to notice.</strong> …
</InteractiveFigure>
```

The caption is mandatory in spirit as well as in markup: it must state the result the
figure demonstrates, so the article stays complete without it.

## Adding a visualization

1. Write `src/lib/visualization/figures/<name>.ts` exporting
   `mount(host: HTMLElement, options: Record<string, unknown>): void`.
2. Register it in `src/lib/visualization/registry.ts`. The module is code-split and
   fetched only when its figure approaches the viewport.
3. Build on the shared helpers: `panel.ts` (resize-aware SVG with axes and clipping),
   `plot.ts` (coordinate transforms, formatting), `controls.ts` (sliders, buttons,
   readouts, legends), `lifecycle.ts` (visibility-gated `requestAnimationFrame`,
   reduced-motion detection), `interaction.ts` (pointer/touch dragging).
4. Under reduced motion, replace playback with step-based controls — see any existing
   figure for the pattern.

## Deployment

`.github/workflows/deploy.yml` type-checks, builds and publishes `dist/` to GitHub
Pages on every push to `main`. In the repository settings, set **Pages → Build and
deployment → Source** to **GitHub Actions**.

The site is a GitHub *user* site, so it is served from the domain root and
`astro.config.mjs` uses `base: '/'`. Pages are emitted as `directory/index.html` so
that deep links such as `/blog/gradient-descent-visualization/` work on a host with no
rewrite rules.

## Troubleshooting

If you delete or rename a content file and the build then fails with
`UnknownContentCollectionError`, remove the stale content cache and rebuild:

```bash
rm -rf node_modules/.astro .astro dist && npm run build
```
