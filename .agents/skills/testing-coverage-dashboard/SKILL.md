---
name: testing-coverage-dashboard
description: Test the coverage dashboard UI end-to-end. Use when verifying chart changes, layout, or data rendering on the dashboard.
---

# Testing the Coverage Dashboard

## Local Dev Setup

```bash
cd coverage-dashboard
npm install          # if not already done via blueprint maintenance
npm run build        # build WITHOUT BASE_PATH for local serving
npx serve dist -l 3000
```

> The production build uses `BASE_PATH=/bank-of-devin/` which breaks local serving at `/`. Only use `BASE_PATH` when building for GitHub Pages deployment.

## Navigating the Dashboard

The dashboard is a slide-based SPA. Key slides:
- **Slide 1** — Coverage dashboard (hero stats)
- **Slide 2** — Trend / "Coverage over time" (the main line chart, `Zone1Hero.tsx`)
- **Slide 3** — Attribution
- **Slide 4** — Program health
- **Slide 5** — Activity
- **Slide 6** — Coverage debt
- **Slide 7** — Risk & rework

Use the arrow buttons at the bottom or the dot navigation to switch slides.

## Chart Components

- **Hero chart** (`Zone1Hero.tsx`): The main coverage-over-time line chart using `recharts`. Series are toggled via chip buttons above the chart. Supports "Daily" vs "Per merge" X-axis modes and projection toggle.
- **Creative views** (`CreativeViews.tsx`): Contains an `AreaChart` (burndown) — this is a separate chart type from the hero line chart.

## Key Testing Points for Chart Changes

1. **Compare production vs local**: Open https://kellyneil098.github.io/bank-of-devin/ in one tab and localhost in another. Navigate both to slide 2.
2. **Series toggling**: Click chip buttons to toggle series on/off. Verify lines/dots appear/disappear.
3. **Hover behavior**: Hover over data points to verify tooltips and active dots.
4. **X-axis modes**: Switch between "Daily" and "Per merge" to verify chart re-renders correctly.
5. **Metric toggle**: Switch between "Line" and "Branch" coverage at the top bar.

## Commands

- Lint: `cd coverage-dashboard && npm run lint`
- Typecheck: `cd coverage-dashboard && npm run typecheck`
- Test: `cd coverage-dashboard && npm test`
- Build (local): `cd coverage-dashboard && npm run build`
- Build (deploy): `cd coverage-dashboard && BASE_PATH=/bank-of-devin/ npm run build`

## Devin Secrets Needed

None — the dashboard is a static site with bundled data. No auth or API keys required.
