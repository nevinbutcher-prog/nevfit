# NevFit — Tactile Rep-Range Controls in Routine Builder

**Checkpoint:** 2 of the agreed three-change rotation: mobile-friendly routine rep-range editing.  
**Suggested implementation commit:** `feat: add tactile rep range controls to routine editor`

## User intent

The routine builder currently uses a single `Reps` text input with `inputMode="numeric"` and a string such as `8-12`. On a mobile keyboard the hyphen may be inaccessible, so deleting a range leaves the user unable to replace it. Make this a tactile, intuitive control that works without typing a hyphen.

## Required experience

- Replace the rep-range string editor in the **existing routine/program builder** with **Min reps** and **Max reps** numeric controls, each featuring thumb-friendly **− / +** buttons and a visible number.
- Display the resulting range clearly (e.g. `8–12 reps`); allow a fixed target when min = max.
- Permit tapping/editing the numbers through a numeric keypad for larger changes; no typed hyphen required.
- Enforce whole positive rep counts and min ≤ max. Steppers must not generate invalid ranges: when increasing min above max, bring max along; when decreasing max below min, bring min along (or an equally intuitive, clearly indicated policy). Prevent negatives, zero, NaN and obviously unreasonable entries; avoid arbitrary constraints on ordinary high-rep exercises.
- Existing saved routines should initialize the controls from their current valid stored rep ranges. Preserve the **existing `repRange` string contract** (e.g. `"8-12"`, fixed target `"10-10"`) when saving, so workout tracking, feedback, history, program generation and Firestore require no migration. If legacy data contains a nonstandard or invalid string, do not silently overwrite it on render; handle it safely and make it editable.
- Continue respecting the current **draft-only editing and explicit Save Program commit** behaviour; the stepper must not trigger Firestore writes for every tap.

## Scope boundaries

Target the existing routine builder's `Reps` input; reuse existing update pathways and layout conventions. Keep the surrounding sets, rest, supersets, exercise selection and workout logger unchanged. No new presets library, per-set rep targets, schema redesign, authentication, or dashboard work. This checkpoint does not authorize starting the subsequent email/password authentication change.

## Verification

- On a narrow mobile viewport, setting `8–12`, changing to `10–15` and setting `10–10` should require no hyphen entry.
- Verify existing routine ranges load accurately; rapid taps and manual numeric entry keep min ≤ max; Save Program retains values after reload; unsaved edits retain existing behaviour.
- Verify no changes to workout logging/rep feedback from the stored range format.
- Reuse relevant existing routine editor/program validation tests. Add only a small focused test for parsing/formatting and boundary adjustments if meaningful. Run the relevant checks, lint/build as appropriate. **No broad suites, Computer Use, live AI calls or unrelated tests**; visual/mobile acceptance is performed by the user after deployment.

Follow `AGENTS.md` and `docs/nevdev_workflow.md`: implement one checkpoint, update directly relevant docs if needed, archive to the next sequential brief, clear `briefs/nextbrief.md`, commit/push, verify Vercel deployment and hand off for independent review and user acceptance. Stop; do not implement email/password yet.
