# Nevfit — Checkpoint 052A: Muscle Workload Polish

**Base:** Checkpoint 052, commit `2174d55`
**Scope:** Three targeted refinements. No dashboard redesign.

## 1. Default to Last 7 Days

- Initialise Muscle Workload reporting to `last-seven-days` rather than `this-week`.
- Keep This Week and Last Week available.
- Preserve the user's current selection while navigating between Dashboard and detail.
- Keep existing date-window calculations and completed-workout-only rules unchanged.
- Do not change the separate weekly workout, run or step metrics.

## 2. Attribute historical hack-squat calf raises

Historical exercise: `wger-1466`, Calf Raise using Hack Squat Machine.

- Add a narrowly scoped, explicitly documented legacy muscle-attribution mapping for workload analytics.
- Attribute each completed working set to calves at primary weighting (1.0).
- Do not alter its WGER ID, saved name, historical sets, catalogue identity or previous-performance linkage.
- Do not introduce a general fallback that guesses muscle groups from exercise names.
- Ensure this movement no longer contributes to the unattributed count.
- Retain genuine unattributed exercises in the detailed view.
- Remove the prominent yellow unattributed warning from the Dashboard preview.
- Use a compact, neutral disclosure in the detail view only when other unattributed exercises remain.

## 3. Improve the interactive body map

Replace the existing blocky, robotic SVG figures with more natural anatomical silhouettes.

Requirements:

- Recognisable human front and back figures.
- More natural shoulders, torso, arms and leg proportions.
- Distinct, selectable muscle regions.
- Existing 13 muscle workload groups remain supported.
- Preserve the current heatmap intensity calculations.
- Maintain keyboard accessibility and screen-reader labels.
- Responsive at both Dashboard preview and detailed-view sizes.
- Use original SVG paths rather than static raster artwork or externally hosted assets.

Aim for clean, stylised fitness anatomy rather than medical-illustration complexity.

Do not change workload calculations or muscle grouping beyond the explicitly requested calf-raise attribution.

## Validation

Add tests for:

- Last 7 Days as default.
- `wger-1466` attributing completed sets to calves.
- Other unmatched legacy IDs remaining unattributed.
- No changes to historical identity or persistence.
- SVG region interaction and accessibility.
- Existing workload calculation regressions.

Run tests, lint and build.

## Deliverables

Commit and push the focused changes. Report test results and provide updated Dashboard and detailed-view screenshots.

**Do not implement unrelated dashboard changes or begin another checkpoint.**