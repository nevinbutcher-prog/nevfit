# Proposed next checkpoint — reviewed metadata overlay (approval required)

Implement a small Nevfit metadata overlay for a human-reviewed subset of master rows, keyed by **current WGER runtime IDs**. Prefer rows with a unique identity and clear equipment/movement. Retain full WGER search and lookup. Keep user-supplied preferred IDs as non-runtime review metadata. Do not add Nevfit IDs, rewrite saved records, bridge differing IDs, or merge variants in this step.

Acceptance criteria for a future approved brief:

1. The included exercise rows and source/reviewer evidence are explicitly listed and approved; each has verified movement, equipment, primary and secondary classifications or an explicit unknown.
2. Search and selected-exercise display use the overlay for reviewed IDs, while unreviewed and legacy IDs still resolve through the existing WGER path.
3. Existing routines, active workouts, completed snapshots, backups and previous-performance exact-ID results remain unchanged; exercise notes and Rob authorisation remain keyed correctly.
4. Automated tests cover overlay priority, legacy fallback, saved/active/completed history compatibility, and no ID rewrite. A rollback to the previous overlay version restores prior display/selection behaviour without data migration.
5. The user checks actual routine names and previous-performance cards for at least one renamed exercise and confirms the catalogue experience before acceptance.

This is a proposal for planning, not an automatically authorised implementation brief.
