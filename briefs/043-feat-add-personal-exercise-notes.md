
**Nevfit — Personal Exercise Notes**

**User intent:** Allow users to record arbitrary personal notes against exercises, particularly machine settings such as seat height, angles and preferred positioning, and easily reference them during subsequent workouts.

**Expected experience:**
- Each exercise can have an optional free-text personal note.
- Notes are accessible and editable directly from the active workout interface.
- Notes persist across sessions and routines for the same exercise.
- Notes belong to the authenticated user, not the shared exercise catalogue.
- Existing workout logging remains uncluttered and unaffected.

**Scope:**
- Reuse existing exercise identity and user-data persistence architecture.
- Support multiline text, editing and clearing notes.
- Preserve notes during workout resume and existing sync flows.
- No equipment catalogue, machine profiles, photos, AI interpretation or new workout-history features.

**Validation:**
- Notes survive navigation, refresh and subsequent workouts.
- Same exercise in different routines displays the same note.
- Clearing a note persists correctly.
- Another user's notes remain independent.
- Existing exercise logging and completion behaviour remain unchanged.

Inspect the relevant repository code and project instructions before implementation. Follow `docs/nevdev_workflow.md`. Report changes, tests, commit and any remaining verification requirements for independent review.