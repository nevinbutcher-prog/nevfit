PROJECT: NevFit

TASK:
Fix previous-performance lookup so exercise history is recognised across different routines.

PROBLEM:
If the same exercise appears in multiple routines, NevFit currently does not reliably show previous performance from another routine.

Example:

* Routine A contains Leg Press
* Routine C contains the same Leg Press exercise
* User completes Leg Press in Routine A
* Later starts Routine C
* Routine C does not show that prior Leg Press performance

EXPECTED BEHAVIOUR:
Previous performance should be based on the stable exercise ID across all completed workout history, not restricted by routine, schedule slot, day, or program.

Use the most recent completed workout occurrence where:

`completedExercise.exerciseId === currentExercise.exerciseId`

Do not require the previous record to belong to the same routine.

REQUIREMENTS:

* Inspect the existing previous-performance lookup before changing it.
* Remove any routine/program/schedule scoping that prevents cross-routine history from being found.
* Search completed workout history globally for the most recent matching `exerciseId`.
* Preserve chronological behaviour: return the latest valid completed occurrence.
* Continue ignoring blank/non-meaningful historical sessions according to existing history semantics.
* Match by stable `exerciseId`, not exercise display name.
* `displayNameOverride` must not create separate history.
* Do not merge genuinely different exercises merely because their names are similar.
* Do not change workout history persistence or historical snapshot structure unless genuinely necessary.
* Keep the implementation focused; avoid unrelated refactoring.

EXAMPLE ACCEPTANCE CASE:

1. Add the same Leg Press exercise ID to Routine A and Routine C.
2. Complete Routine A with Leg Press at 100 kg × 10.
3. Start Routine C later.
4. Leg Press should show the Routine A performance as its previous performance.
5. Complete Routine C with a newer result.
6. The next Leg Press workout in either routine should use the newer Routine C result.

REGRESSION CHECKS:

* Same-routine previous performance still works.
* Different exercises with similar names do not share history.
* Custom display names do not break history matching.
* Existing completed workout history remains unchanged.
* Active/blank workout sessions do not become previous-performance sources.

VALIDATE:
Run the existing lint/build/test suite relevant to the project and report:

* root cause found
* files changed
* validation performed
* any edge cases discovered
