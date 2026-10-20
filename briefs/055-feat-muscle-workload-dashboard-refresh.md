# Nevfit â€” Checkpoint 052: Muscle Workload + Dashboard Refresh

**Repository:** `nevinbutcher-prog/nevfit`
**Workflow:** `docs/nevdev_workflow.md`
**Status:** Ready for implementation
**Reference:** Approved dashboard mockup from this conversation

## Objective

Refresh the Dashboard and introduce a visually compelling Muscle Workload feature showing how completed strength workouts distribute training stimulus across muscle groups.

Use the approved mobile mockup as the visual reference, while retaining responsive desktop support.

**Build this as one focused checkpoint. No unrelated features.**

## 1. Dashboard layout â€” top to bottom

### Header

- Replace the oversized welcome/account card with a compact NevFit header.
- Move Settings to the top-right cog.
- Retain sign-out functionality within Settings or its existing account controls.
- Preserve the Dashboard / Week / Programs / Rob navigation.

### Today card

- Compact, prominent summary of today's training/activity.
- Distinguish strength workout scheduling from cardio.
- On a cardio day, show the completed run where available without misleadingly calling the entire day a Rest Day.
- For example, â€œ5.0 km runâ€ alongside â€œRest from strength training.â€
- Do not fabricate run distance, pace or duration.
- Retain existing workout start/resume actions on strength-training days.

### Current Plan

Reduce to one compact card/row:

**PCYC 1** Â· Week 7 of 12 Â· View/edit affordance

Keep the actual plan name, cycle progress and access to editing. Avoid unnecessary vertical space.

### This Week

Retain:

- Workouts completed / target.
- Runs completed / target.
- Average steps.
- Log Run action.
- Add Steps action.

Display metrics in a compact horizontal group on mobile, with two adjacent action buttons.

Preserve existing data sources and behaviour.

### Muscle Workload

Replace the existing Progress Highlights placeholder entirely.

The new card contains:

- Muscle Workload title.
- Period selector, defaulting to This Week (Mondayâ€“Sunday).
- Small front/back muscle body maps.
- Ranked top muscle-group workload.
- Clearly labelled weighted/effective set values.
- View Muscle Workload action to open the detailed experience.

Do not overload the Dashboard with all the detailed analytics.

## 2. Detailed Muscle Workload experience

Provide a dedicated expanded view accessible from the dashboard card.

The detailed view should include:

- Larger front/back muscle maps.
- All supported muscle groups ranked by workload.
- Muscle selection or expandable rows showing contributing exercises.
- Number of completed sets and calculated stimulus contribution.
- Selected period context.
- Helpful empty states.

Make the body regions interactive if practical and accessible; the ranked list must provide an equivalent way to select muscles.

Period options:

- **This Week:** current Monday through Sunday, counting activity completed so far.
- **Last 7 Days:** rolling seven local calendar days including today.
- **Last Week:** previous completed Mondayâ€“Sunday week.

No custom date-range UI in this checkpoint.

## 3. Workload calculation

Calculate workload from completed strength workout history only.

- Exclude planned sets, unfinished sets, steps and runs.
- Use saved completed set data and stable exercise identities.
- Use existing Nevfit catalogue muscle metadata and/or reviewed planning taxonomy where appropriate.
- Primary muscle contribution: 1.0 weighted set.
- Secondary muscle contribution: 0.5 weighted set.
- Prevent duplicate muscles, hierarchy overlaps and accidental double-counting.
- Exclude non-muscle-specific or insufficiently classified exercises from attributed workload rather than inventing their anatomy.
- Keep unmatched legacy WGER exercise references readable and explicitly disclose any unattributed workload.
- Use historical logged sets; do not recalculate using current routine prescriptions.

Document the weighting methodology and limitations. Weighted stimulus sets are an estimate, not a clinically validated measure of muscle growth, training adequacy or recovery.

Do not label an individual's weekly workload as good, bad or optimal based solely on these totals.

## 4. Body map asset contract

Implement a simplified original front/back anatomical body map.

Requirements:

- Front and back orientations.
- Transparent or theme-compatible backgrounds.
- Individual highlightable muscle regions.
- Stable region identifiers matching the workload UI taxonomy.
- Three to four clearly differentiated workload intensities, including zero.
- Correct side symmetry and region alignment.
- Responsive rendering at dashboard and detail sizes.

Preferred implementation: reusable React SVG component using controlled paths or groups.

Do not depend on externally hosted images or embed the generated dashboard mockup as UI.

If accurate, maintainable region paths cannot be created confidently, implement the workload bars and detail interactions first, and explicitly flag the body map as an asset dependency. Do not substitute misleading anatomy.

## 5. UX and integration

- Match existing Nevfit dark theme, spacing, typography and teal accent.
- Mobile-first but responsive.
- Preserve existing navigation, logging and cycle editing functions.
- Show clear loading, empty and error states.
- A Monday reset is a change in the reporting window, not deletion of historical data.
- Avoid unnecessarily querying or processing the entire workout history on each render.
- Use the existing application architecture and persistence services.
- This feature is read-only with respect to workout records; no Firestore schema migration.

## 6. Tests

Cover:

- Correct Mondayâ€“Sunday and rolling-seven-day date boundaries, including local timezone.
- Completed working sets only.
- Primary and secondary weighting.
- Muscle taxonomy rollups and overlap prevention.
- Missing metadata and retained WGER identity handling.
- Historical post-migration exercise IDs.
- Empty weeks and incomplete set data.
- Accurate per-exercise contribution breakdown.
- Body-map region lookup and highlight mapping.
- Dashboard metrics, buttons and existing workout actions remaining functional.

Run tests, lint and build.

## 7. Out of scope

Do not implement:

- Planned versus completed workload.
- Recovery/fatigue scores.
- Muscle growth predictions.
- Rob coaching or generation changes.
- New exercise catalogue records.
- Exercise media enrichment.
- Advanced analytics and long-term trend graphs.
- New Firestore collections or production data migration.

## Deliverables

- Refreshed Dashboard.
- Muscle Workload summary card.
- Detailed Muscle Workload view.
- Tested, reusable workload calculation service.
- Reusable anatomical SVG component.
- Brief methodology documentation.
- Commit SHA, validation results, deployment status and screenshots.

## Acceptance criteria

The Dashboard follows the approved layout, retains all existing essential actions, and presents completed-training workload clearly. The body map and ranked workload are consistent, with accurate drill-down into contributing exercises.

No exercise history or workout values are modified.

**Implementation principle: correct calculations first, coherent UI second, body-map polish third.**

Please implement the body map as an interactive SVG component, not a static image. Use the approved mockup as visual direction. If creating anatomically sensible SVG regions proves difficult, report that rather than substituting a crude graphic.