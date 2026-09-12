
PROJECT: Fitbot

CARD:
Validate the rebuilt builder end to end

PHASE:
QA and Polish

PRIORITY:
High

OBJECTIVE:
Run focused end-to-end validation across the rebuilt program/routine builder and fix only issues directly uncovered by that validation.

The goal is to prove that the rebuilt builder is reliable enough to treat as complete before moving into the later AI integration sequence.

Validation must cover:

* multi-routine program lifecycle
* compact routine editing
* focused exercise configuration
* exercise search and repeated adding
* swap/remove/reorder
* superset creation/change/removal
* proposal-contract safety
* program persistence
* local fallback behavior
* workout snapshot compatibility
* mobile usability

This card is QA/polish, not another redesign.

CURRENT ARCHITECTURE:
Fitbot program definitions persist at:

`users/{uid}/programs/{programId}`

Firestore is the source of truth when cloud programs exist, with `nevfit_programs` retained as a local cache/fallback.

Routine exercises use stable structured data including:

```js
{
  exerciseId,
  sets,
  repRange,
  restSeconds,
  displayNameOverride,
  note,
  supersetGroupId,
}
```

Workout sessions snapshot the selected routine when started, and completed workout history remains append-only.

The rebuilt builder sequence should now include:

* reliable multi-routine management
* compact routine list
* focused exercise configuration
* streamlined search/repeated add
* focused superset pairing
* AI-ready proposal contract

VALIDATION PRINCIPLE:
Test realistic user workflows rather than isolated buttons only.

Where a defect is found:

* diagnose root cause
* apply the smallest appropriate fix
* add/update regression coverage
* rerun the affected workflow

Do not use this card as justification for unrelated refactoring.

1. Establish current baseline
   Before changing code:

* inspect current branch/worktree
* identify implementation commits associated with the builder sequence
* run the existing relevant automated test suite
* run lint/build
* record any pre-existing failures separately

Do not silently fix unrelated pre-existing failures unless they block builder validation.

2. Validate program lifecycle
   Test creation and management of programs containing multiple routines.

At minimum:

A. Existing program

* load an existing single-routine program
* confirm it still renders and edits correctly

B. Add routines

* add at least two additional routines
* verify unique IDs
* verify all routines remain accessible

C. Rename

* rename multiple routines
* verify IDs remain stable

D. Switch

* switch repeatedly between routines
* verify draft data remains attached to the correct routine

E. Duplicate

* duplicate a populated routine
* verify copied exercise configuration
* verify independent mutation after duplication

F. Remove/archive

* remove/archive a routine
* verify surviving routine ordering and selection remain valid

G. Reload

* save and reload
* confirm complete structure persists

3. Validate compact routine editor
   Use a realistic routine with at least 6–8 exercises.

Confirm:

* default view is compact
* exercise order is immediately understandable
* effective exercise names render correctly
* sets × reps and rest display correctly
* optional metadata does not create broken/empty rows
* only one exercise configuration surface is active at once
* Add Exercise remains easy to reach

Check mobile height/density using a narrow viewport.

4. Validate focused exercise configuration
   For multiple exercises, test:

* change sets
* change rep range
* change rest
* enable custom display name
* disable custom display name
* swap exercise
* remove exercise
* cancel/close editor
* reopen editor

Confirm:

* changes affect the intended routine entry only
* stable exercise ID remains unchanged except on Swap
* draft values survive editor close/reopen
* Save Program remains the persistence boundary
* rich instructions/images do not obstruct routine configuration

5. Validate exercise search
   Test the Add Exercise flow with realistic searches such as:

* bench
* curl
* row
* pulldown

Confirm:

* results are compact
* names are understandable
* useful muscle/equipment context appears where available
* Add actions are clear
* result cards do not contain unnecessary instruction/image clutter

Do not redesign search ranking in this QA card.

6. Validate repeated adding
   From one Add Exercise session:

* add at least three exercises
* confirm immediate add feedback
* confirm picker remains open
* confirm search remains usable
* confirm additions appear in the expected order
* close and reopen picker
* verify existing routine state is reflected accurately

Rapidly tap Add where practical and confirm no accidental duplicate caused by double execution.

7. Validate duplicate-exercise semantics
   Determine and document the current intended behavior when the same underlying stable `exerciseId` is added more than once to one routine.

Test it explicitly.

If duplicates are allowed:

* ensure individual routine entries remain independently editable
* ensure superset targeting does not confuse them

If duplicates are prevented:

* ensure UI communicates that clearly

Do not silently change the established product behavior during QA unless it is objectively broken.

8. Validate search states
   Test:

Loading:

* lightweight visible feedback
* stale results do not appear actionable incorrectly

Empty:

* no-result search produces clear empty state
* picker remains usable

Provider failure:

* simulate/match provider failure
* clear error shown
* retry works
* picker does not close
* routine draft is preserved

Provider recovery:

* retry after failure
* results return normally

9. Validate reorder behavior
   Using a populated routine:

* move first exercise down
* move middle exercise up/down
* move grouped superset exercise
* reorder after adding/removing exercises

Confirm:

* configuration stays attached to correct routine entry
* stable identity remains correct
* order persists after Save Program/reload
* superset grouping remains intact

10. Validate superset workflow
    Run full lifecycle testing.

A. Create

* pair two eligible exercises
* verify shared group semantics

B. Display

* compact routine list clearly communicates pairing

C. Change

* change one pairing to a different partner
* verify previous grouping cleans correctly

D. Remove

* remove superset
* verify both entries normalize correctly

E. Delete grouped member

* delete one member
* verify no orphan group remains

F. Reorder

* reorder grouped exercises
* verify grouping survives

G. Save/reload

* persist and reload
* verify grouping survives

H. Duplicate underlying exercise
If same `exerciseId` appears twice:

* confirm correct routine instance is targeted

11. Validate proposal contract
    The AI-ready proposal layer must remain inert and deterministic.

Test:

* valid create-routine proposal
* valid modify-routine proposal
* add/remove/update/reorder operations
* superset proposal/group translation
* malformed proposal
* conflicting operations
* nonexistent target

Confirm:

* validation returns structured results
* application creates cloned draft data
* original input remains untouched
* no Firestore/localStorage writes occur from proposal application alone
* no active/completed workout state changes

This is contract validation only.

Do not implement any AI calls/UI.

12. Validate persistence
    Test authenticated Firestore behavior for the rebuilt builder.

For a multi-routine program:

* modify several routines
* Save Program
* verify expected program document
* reload browser
* verify state restored correctly

Confirm:

* routine IDs
* order
* exercise IDs
* configuration
* display-name overrides
* supersets

all persist.

13. Validate local cache/fallback
    Where practical, simulate Firestore failure/unavailability.

Confirm:

* local program state remains intact
* existing non-blocking sync warning appears
* no silent data loss
* subsequent recovery does not unexpectedly overwrite valid newer data

Do not redesign sync architecture here.

14. Validate save failure safety
    Simulate or instrument a program-save failure.

Confirm:

* draft is not silently discarded
* local/cache behavior follows existing architecture
* error is visible enough to explain that cloud sync/save failed
* completed workout history is untouched

15. Regression test existing program data
    Load representative existing programs including:

* one routine
* multiple routines
* custom display names
* wger-backed exercise IDs
* supersets
* older optional fields absent
* legacy `groupId` where supported

Confirm normalization remains safe and non-destructive.

16. Validate workout snapshot compatibility
    For at least two different routines in the same program:

17. Save builder changes.

18. Start a workout.

19. Inspect active workout snapshot.

Verify:

* correct routine selected
* correct exercise order
* correct `exerciseId`
* effective `exerciseName`
* sets
* `repRange`
* `restSeconds`
* `supersetGroupId`

Repeat from another routine.

17. Validate completed-history safety
    Before builder QA, record completed workout count/content.

After:

* add routines
* rename routines
* reorder exercises
* swap exercises
* remove exercises
* create/remove supersets
* use proposal transformations
* Save Program

Confirm completed workout history remains unchanged.

Historical workout snapshots must not be rewritten by program editing.

18. Validate active workout isolation
    If an active workout already exists:

* avoid allowing builder operations to mutate its snapshot unexpectedly

Confirm changes made to the program after workout start do not silently rewrite the already-created active workout unless that is explicitly existing product behavior.

19. Mobile usability pass
    Test at representative narrow phone widths.

Focus on actual workflow friction:

Program/routine navigation:

* no clipped routine controls
* routine switching clear

Compact list:

* readable without excessive scrolling
* no text overlap
* controls remain tappable

Focused editor:

* bottom sheet/modal fits viewport
* keyboard does not make essential actions unreachable
* Done/Close obvious
* Remove not too easy to hit accidentally

Exercise picker:

* search remains accessible with keyboard open
* Add buttons have adequate touch targets
* result rows do not overflow

Superset selector:

* candidates readable
* selection obvious
* existing group state understandable

20. Keyboard and viewport validation
    Specifically test mobile inputs for:

* sets
* reps
* rest
* custom display name
* search

Confirm:

* appropriate keyboard types
* focused field remains visible
* bottom sheets do not become trapped behind keyboard
* closing keyboard does not lose draft edits
* no significant viewport jumping/regression

21. Accessibility/basic interaction polish
    Check:

* important state is not represented by color alone
* Add/Added distinguishable in text/iconography
* destructive actions clearly styled
* buttons have useful accessible labels
* disabled states understandable
* touch targets reasonable

Keep changes minimal.

22. Error/logging hygiene
    Ensure expected user errors do not expose raw provider/Firebase exceptions in UI.

Development console logging may retain diagnostic details.

Remove temporary QA logs/debug UI before completion.

23. Automated tests
    Expand the automated suite to cover the most important regression-prone paths.

Prioritize logic tests for:

* multi-routine lifecycle
* routine duplication independence
* reorder
* search Add state
* repeated add
* superset lifecycle/orphan cleanup
* proposal validation/application
* workout snapshot generation
* persistence normalization

Do not attempt to create an enormous end-to-end framework solely for this card if the project does not already have one.

Use the existing testing stack.

24. Build/lint validation
    At final completion run:

* relevant automated tests
* lint
* production build

All must pass, or remaining unrelated failures must be explicitly documented.

25. Fix policy
    Fix issues found when they are directly related to the rebuilt builder or regressions introduced by this sequence.

Examples in scope:

* broken layout
* incorrect routine selection
* stale Added state
* incorrect grouping cleanup
* persistence mismatch
* lost draft
* wrong workout snapshot

Examples out of scope:

* dashboard redesign
* progress analytics
* unrelated workout-tracker enhancements
* new exercise provider
* AI coach integration
* new program features

26. No speculative scope
    Do not introduce:

* new AI functionality
* new Firestore schema
* new exercise taxonomy
* new drag/drop library unless required to fix an actual regression
* broad component architecture rewrite
* aesthetic redesign unrelated to observed mobile issues

MANUAL ACCEPTANCE SCENARIO:
Complete one realistic end-to-end flow:

1. Sign in.
2. Create a new program.
3. Create three routines.
4. Rename all three.
5. Add 6+ exercises to Routine A using repeated Add.
6. Configure sets/reps/rest on multiple exercises.
7. Set one custom display name.
8. Reorder exercises.
9. Create a superset.
10. Change that superset partner.
11. Remove/recreate a superset.
12. Swap one exercise.
13. Remove one exercise.
14. Duplicate Routine A.
15. Modify the duplicate independently.
16. Save Program.
17. Reload.
18. Verify all program/routine state.
19. Start a workout from Routine A.
20. Confirm workout snapshot.
21. Close/discard as appropriate.
22. Start a workout from another routine.
23. Confirm the second snapshot.
24. Confirm historical workouts have not changed.
25. Confirm no silent sync/data-loss errors occurred.

SUCCESS CRITERIA:
This card is complete when:

* realistic multi-routine workflows function end to end
* existing programs still load correctly
* compact routine editing remains usable
* focused exercise configuration works without data loss
* repeated exercise adding is clear and reliable
* search loading/empty/error states are safe
* ordering remains stable
* supersets create/change/remove safely
* proposal transformations remain inert until explicitly applied/saved
* Firestore persistence works
* local fallback remains safe
* saved routines survive reload
* active workouts accurately snapshot saved routine data
* completed workout history remains unchanged by builder edits
* mobile usability has been validated and obvious regressions fixed
* automated tests/lint/build pass

DELIVERABLE REPORT:
At completion, report:

* QA scenarios executed
* defects discovered
* defects fixed
* files changed
* automated tests added/updated
* Firestore/local persistence results
* workout snapshot validation results
* mobile issues found/fixed
* any remaining known limitations
* lint/test/build results
* confirmation that completed workout history remained intact
* final commit/push status
