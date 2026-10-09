**Title:** Improve Rob Exercise Matching Accuracy and Library Coverage

**Phase:** Exercise Resolution  
**Priority:** High  
**Dependency:** Resolve unmatched exercises without losing whole-program proposals

**Description:**

Investigate why approximately 50% of Rob-generated exercises require manual matching against Fitbot's WGER exercise library, including common movements.

Audit the entire matching pipeline before introducing another exercise database.

Determine whether failures originate from:
- Rob's generated exercise terminology.
- WGER's naming conventions and aliases.
- Exercise search coverage or indexing.
- Deterministic matching thresholds.
- Missing exercises in the provider catalogue.

Improve automatic matching without introducing unsafe guesses.

Evaluate persistent user-specific mappings and curated shared aliases so successfully resolved terminology can be recognised in future generations. Distinguish genuine synonyms from personal exercise substitutions.

Consider an additional exercise provider only if evidence demonstrates material catalogue gaps.

**Acceptance:**
- Common exercises match reliably.
- Ambiguous movements still require confirmation.
- Unsupported matches are never silently accepted.
- Matching improvements have measurable regression coverage.
- Existing manual resolution remains functional.
- No additional paid AI generation is required.
- Findings establish whether persistent mappings or another provider are warranted.

**Out of scope:** Program approval, program saving, conversational refinement and broad matching UI redesign.