PROJECT: Fitbot

CARD:
Streamline exercise search and repeated adding

PHASE:
Exercise Discovery

PRIORITY:
High

OBJECTIVE:
Rework the Add Exercise flow into a fast, search-first experience for adding several exercises to a routine in one session.

The user should be able to:

* search quickly
* understand results at a glance
* add an exercise with one clear action
* get immediate confirmation that it was added
* continue searching and adding without the picker closing
* understand when an exercise is already in the routine
* exit cleanly back to the routine

Preserve provider-neutral search and stable exercise IDs.

CURRENT ARCHITECTURE:
Exercise discovery is routed through:

`src/services/exerciseProvider.js`

The provider exposes:

* `searchExercises(query, filters)`
* `getExerciseById(id)`
* `normalizeExercise(sourceExercise)`

Current results are wger-backed and normalized into a provider-neutral shape including stable IDs, name, muscle/equipment metadata, instructions and image data.

The existing Add Exercises flow already stays open after add-mode selections and resets search for the next addition, while swap mode closes after selection. Preserve that distinction.

Current exercise search is search-first, includes a small alias layer, and intentionally hides equipment filtering because provider metadata can be incomplete.

PROBLEM:
The current Add Exercise experience is too clunky for repeated routine building.

Observed friction:

* result cards contain too much information
* add state is not obvious enough
* there is insufficient confirmation after adding
* repeated-add flow feels uncertain
* already-added exercises are not communicated clearly enough
* search failure/empty states are not polished

TARGET EXPERIENCE:
The Add Exercise surface should feel more like a fast picker than an exercise-detail browser.

Suggested interaction:

```text
Add Exercises

[ Search exercises... ]

Dumbbell Bench Press
Chest · Dumbbell
[ Add ]

Incline Dumbbell Press
Chest · Dumbbell
[ Added ✓ ]

Cable Chest Fly
Chest · Cable
[ Add ]
```

After tapping Add:

* the exercise is added immediately to the routine draft
* the action visibly changes to `Added ✓`
* a brief confirmation may appear
* the picker stays open
* the user can continue searching or add another result

A clear Done/Close action returns to the routine.

IMPLEMENTATION REQUIREMENTS:

1. Inspect the existing Add Exercises flow
   Review:

* Add/Swap mode branching in `src/App.jsx`
* current exercise picker/modal state
* search query state
* result rendering
* add handler
* swap handler
* duplicate behavior
* selected routine exercise state
* search loading/error handling

Preserve the existing provider and data model unless a small UI-state helper is needed.

2. Keep Add and Swap behavior distinct
   Add mode:

* picker remains open after adding
* user can add several exercises in one session

Swap mode:

* selecting a replacement may continue closing the picker as today

Do not merge the two interaction models.

3. Simplify result cards
   Each search result should prioritize:

* exercise name
* primary muscle where available
* equipment where available
* clear Add/Added action

Do not show by default:

* long instructions
* large images
* image credits
* secondary-muscle detail
* verbose provider metadata

If an existing details affordance exists, preserve access without cluttering the default result.

4. Add obvious action state
   Each result should have a clearly actionable control.

Normal state:
`Add`

After that exercise has been added to the current routine:
`Added ✓`

Requirements:

* state updates immediately in the UI
* prevent ambiguous double taps
* prevent accidental duplicate insertion where the same exact stable `exerciseId` is already present, unless current product semantics intentionally permit duplicates

Important:
Do not assume duplicate exercises are always invalid.

Inspect current routine semantics first.

If the same exercise is intentionally allowed multiple times in a routine, distinguish:

* “already added this session”
  from
* “cannot be added again”

Do not silently impose a new product rule.

5. Immediate feedback after add
   Provide clear confirmation.

Acceptable patterns:

* Add button changes to `Added ✓`
* small toast such as `Dumbbell Bench Press added`
* both, if lightweight

Keep feedback brief and non-blocking.

Do not require modal dismissal or confirmation dialogs.

6. Repeated adding
   After a successful Add:

* keep picker open
* do not lose the existing routine draft
* allow the user to search again immediately
* preserve or reset search according to the current intended interaction

Current notes indicate Add mode currently resets the search after a selection.

Preserve that behavior unless the current implementation proves awkward.

If resetting:

* maintain a visible Added confirmation long enough to avoid ambiguity
* return focus to the search field where practical

7. Search field behavior
   The search input should:

* be prominent
* use the current alias/provider normalization behavior
* avoid firing obviously unnecessary calls
* preserve current debounce behavior if one exists
* remain responsive on mobile

Do not redesign provider ranking in this card.

8. Loading state
   While a search is in progress:

* show a clear lightweight loading state
* do not leave stale results looking selectable if they no longer match the current query
* avoid full-screen blocking loaders

9. Empty state
   When no results match:
   show a concise state such as:

`No exercises found for "xyz"`

Optionally suggest:

* trying a simpler term
* checking spelling

Do not invent local fallback exercises in this card.

10. Provider failure state
    If wger/provider search fails:

* keep the picker usable
* show a clear non-destructive error state
* allow Retry
* do not lose already-added draft exercises
* do not close the picker
* do not expose raw API errors to the user

Development logging may retain the actual error for diagnosis.

11. Preserve stable exercise IDs
    Adding a result must continue using the provider-normalized stable `exerciseId`.

Do not use display name as identity.

Do not alter:

* exercise provider normalization
* Firestore routine schema
* workout snapshot semantics

12. Preserve routine draft/save semantics
    Adding exercises should continue updating routine draft state according to the existing builder contract.

Do not introduce per-keystroke persistence.

Save Program remains the persistence boundary unless the existing structural-action logic already persists additions intentionally.

Preserve current behavior consistently.

13. Preserve routine order
    Newly-added exercises should be inserted using the existing ordering semantics, normally at the end of the routine.

Do not reorder existing exercises.

If the user adds several exercises:

* preserve addition order

14. Already-added state
    Determine added state from stable exercise identity and current routine draft state, not transient UI state alone.

If the user:

* adds an exercise
* closes picker
* reopens picker

the picker should correctly understand whether that exercise already exists in the current routine.

If duplicates are supported, the state should still avoid misleading “Added” semantics.

15. Keep provider-neutral copy
    Do not expose wger branding throughout the picker.

Maintain provider-neutral labels such as:

* Add Exercise
* Search exercises
* Exercise details

Attribution belongs in Settings/About and existing image-credit locations.

16. Mobile interaction
    Optimize for phone use.

Prefer:

* compact rows
* large enough Add buttons
* minimal vertical padding
* sticky or obvious close/done action
* search field visible near the top
* no nested horizontal scrolling

17. Accessibility
    Ensure:

* buttons have clear text or accessible labels
* Added state is not communicated by color alone
* loading/error state is readable
* touch targets are adequate

TEST REQUIREMENTS:

Add/update focused tests where practical.

At minimum cover:

A. Search rendering

* query returns results
* compact result cards show expected fields
* missing equipment/muscle does not break rendering

B. Add

* tap Add
* correct stable exercise ID is inserted
* button/state updates to Added
* picker remains open

C. Multiple additions

* add three exercises sequentially
* all appear in the routine draft
* order matches addition order
* picker never closes unexpectedly

D. Reopen picker

* add an exercise
* close picker
* reopen
* existing routine state is reflected accurately

E. Duplicate behavior

* exercise already present in current routine
* UI follows current product semantics correctly
* no accidental double insertion caused by rapid taps

F. Search reset/continuation

* after Add, search behavior matches intended flow
* next exercise can be found without leaving the picker

G. Empty state

* query with no matches
* clear empty state shown
* no crash/stale-action issue

H. Provider failure

* simulated provider error
* error state shown
* retry available
* existing routine draft preserved

I. Swap regression

* swap mode still selects replacement
* swap-specific close behavior remains unchanged

J. Persistence safety

* Save Program still persists added exercises correctly
* reload restores added exercises

MANUAL VALIDATION FLOW:

1. Open a routine.
2. Open Add Exercise.
3. Search `bench`.
4. Confirm results are compact and easy to distinguish.
5. Add one exercise.
6. Confirm immediate Added feedback.
7. Confirm picker remains open.
8. Search for another exercise.
9. Add two more exercises.
10. Return to the routine.
11. Confirm all three were added in the expected order.
12. Reopen Add Exercise.
13. Search for one already in the routine and confirm state is understandable.
14. Test a nonsense query and confirm empty state.
15. Simulate or observe provider failure and confirm error/retry state.
16. Save Program.
17. Reload.
18. Confirm added exercises persist.
19. Test Swap separately and confirm it still behaves as before.

OUT OF SCOPE:
Do not implement:

* provider/ranking overhaul
* custom exercise creation
* local exercise catalog fallback
* focused exercise configuration redesign
* superset workflow redesign
* AI routine generation
* AI proposal contract
* workout tracker changes
* Firestore schema changes

SUCCESS CRITERIA:
This card is complete when:

* Add Exercise feels fast and search-first
* result cards are compact
* Add actions are obvious
* successful adds provide immediate feedback
* repeated adding works without closing the picker
* already-added state is understandable
* empty/loading/error states are handled cleanly
* stable exercise IDs are preserved
* Save Program/persistence behavior remains intact
* Swap behavior is not regressed

DELIVERABLE REPORT:
At completion, report:

* files changed
* search-result layout changes
* Add/Added feedback behavior
* duplicate-handling decision
* search reset behavior
* error/loading/empty-state handling
* tests added/updated
* manual validation performed
* any limitations deferred to future cards
