# Fitbot — Harden Whole-Program Exercise Resolution State

**Card:** ROB-PROGRAM-04 — Resolve Unmatched Exercises Without Losing Whole-Program Proposals  
**Priority:** High  
**Baseline commit:** `6f07cbf`

## Objective

Protect user matching decisions against late asynchronous search results, and make exercise replacement non-destructive.

Preserve the existing resolution architecture, provider identity validation and executable program proposal contract.

## 1. Prevent stale asynchronous results

Review `src/App.jsx` and `src/services/rob/robProgramResolution.js`.

Currently, search operations can replace the resolution session using a snapshot captured before the request began.

Implement request/session freshness safeguards.

Requirements:

- A response from an older candidate must never overwrite the current candidate.
- A response from an earlier search must not overwrite a newer search for the same exercise.
- A pending search must not overwrite a selection or replacement made while it was running.
- The initial automatic matching scan must not overwrite newer matching decisions.
- Editing intake requirements or starting over must invalidate pending operations.
- Late failures must not overwrite newer successful results.
- Matching decisions made for other exercises must be preserved when a search completes.
- Avoid duplicate provider requests where practical.

Prefer request IDs, candidate fingerprints and functional state updates, following the existing Rob lifecycle conventions.

Do not silently rebase selections from an old candidate onto a new one.

## 2. Make exercise replacement non-destructive

Currently, opening Change exercise clears the existing valid selection.

Change this behaviour:

- Opening the search interface retains the current selection.
- Cancelling or closing search leaves the original match intact.
- Searching without selecting a replacement leaves the original match intact.
- Only selecting a verified replacement changes the exercise identity.
- The original candidate suggestion remains visible.
- The sets, reps, rest, notes, order and valid superset membership remain unchanged.

An explicit Clear selection action may remain available where useful, but it must not be triggered merely by opening the replacement interface.

## 3. Preserve existing trust boundaries

Do not weaken:

- Provider-backed exercise identity verification.
- Candidate fingerprints.
- Strict exercise validation.
- Program proposal validation.
- Fitbot-owned identity creation.
- Full-resolution requirement before materialisation.

Incomplete matching must not produce an executable proposal.

No draft, program, active workout or schedule may be modified.

## 4. Regression tests

Add behavioural tests for:

1. Two searches for the same exercise completing out of order.
2. A search completing after the user selects a match.
3. A search completing after the candidate changes.
4. A search completing after intake is restarted.
5. Initial matching completing after relevant state changes.
6. Search failure arriving after a newer successful search.
7. Decisions for other exercises being preserved.
8. Opening Change exercise without clearing the current match.
9. Cancelling replacement without changing the exercise.
10. Selecting a genuine replacement and preserving prescriptions.
11. Forged library IDs still being rejected.
12. Completed resolution still passing `validateProgramProposal()`.
13. Existing single-routine matching remaining functional.

Test actual asynchronous orchestration where practical, not only isolated helper functions.

## 5. Verification

Run:

- Full application tests.
- Functions tests where relevant.
- Root and Functions lint.
- Production build.

Update technical documentation if lifecycle behaviour changes.

Commit, push and deploy only after verification.

**Suggested commit:** `fix: preserve Rob exercise matches across async searches`

## Out of scope

Do not implement full-program preview, approval, saving, conversational swaps or prescription editing.

Keep this focused on protecting the existing Card 04 matching workflow.