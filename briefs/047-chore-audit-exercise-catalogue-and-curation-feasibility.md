# Nevfit — Checkpoint 047: Exercise Catalogue Audit & Curation Feasibility

**Repository:** `nevinbutcher-prog/nevfit`  
**Workflow:** `docs/nevdev_workflow.md`  
**Type:** Investigation / analysis only  
**Starting point:** Current `main`, following checkpoint 046 (`e3c594b`).

## Goal

Determine whether the existing WGER-derived exercise catalogue can reliably support:

1. Muscle-group workload tracking.
2. Intelligent exercise selection and substitutions.
3. Future adaptive programming through Rob.

The catalogue has previously demonstrated inconsistent naming, unusual exercises, questionable search results and potentially unreliable classification.

We need concrete evidence before deciding whether to curate a subset, enrich existing entries or change catalogue strategy.

**Do not implement a catalogue replacement or change production behaviour.**

## Investigation 1 — Catalogue inventory

Inspect the actual exercise catalogue consumed by Nevfit, including its generation/import pipeline and any existing normalization, filtering, aliases or override rules.

Report:

- Total exercise entries and unique IDs.
- Primary language coverage and naming consistency.
- Equipment coverage and missing classifications.
- Primary and secondary muscle metadata coverage.
- Exact and probable duplicates.
- Entries with questionable or implausible classifications.
- Common exercises that are missing or difficult to locate.
- Unusual, specialist or low-value movements disproportionately appearing in search or Rob generation.

Distinguish measured counts from heuristics and subjective assessments.

Avoid presenting name similarity alone as proof of duplication.

## Investigation 2 — Existing exercise intelligence

Inspect the existing Rob exercise taxonomy, planning exceptions, selection logic, search and substitution pathways.

Identify:

- Which muscle classifications are sourced directly from catalogue metadata.
- Which classifications are inferred.
- Which are manually reviewed.
- Where broad categories combine muscles that should be distinct for workload analysis.
- Whether variants are being treated as equivalent without adequate evidence.
- Which existing components could be reused.
- Which components are unsuitable for estimating training stimulus.

Specifically assess the ability to distinguish:

- Chest
- Back, including lats versus upper back where feasible
- Anterior, lateral and posterior deltoids
- Biceps
- Triceps
- Quadriceps
- Hamstrings
- Glutes
- Calves
- Abdominals/core

Do not fabricate precision where the metadata cannot support it.

## Investigation 3 — Real-world exercise coverage

Inspect existing sample programs, routine definitions, test fixtures and any available local development data.

Determine how many exercises actually used by the application can be mapped confidently to the intended muscle groups.

**Do not access private production-user Firestore data or export personal training history.**

If real production usage cannot be assessed from available repository evidence, explicitly report that limitation.

Identify representative commonly used movements across:

- Commercial gym machines
- Free weights
- Cables
- Bodyweight exercises

Highlight any gaps affecting machine-based hypertrophy training.

## Investigation 4 — Stable identities and historical compatibility

Determine how exercises are identified across:

- Catalogue entries
- Saved programs and routines
- Active workouts
- Completed workout snapshots
- Rob's generation and substitution workflows

Identify risks if we introduce curated entries, aliases or corrected muscle mappings.

Recommend how to maintain compatibility with existing IDs and historical records.

No migrations or changes to production records.

## Investigation 5 — Prototype mapping

Develop a **small, isolated, non-production prototype** covering approximately 20–30 representative exercises.

Include common compound and isolation movements, including machine variations.

For each exercise, record:

- Stable catalogue ID
- Display name
- Equipment type
- Primary muscle or muscles
- Secondary muscle involvement
- Mapping provenance
- Confidence level
- Ambiguities requiring manual review

Prefer explicit mappings grounded in existing metadata and documented anatomy rather than speculative string matching.

Clearly distinguish direct training stimulus from secondary participation.

Do not introduce arbitrary fractional set-credit coefficients as established scientific facts.

The prototype must not change the live catalogue or be consumed by production code.

## Investigation 6 — Strategy comparison

Compare three realistic options:

**A. Enrich the existing full catalogue**

Maintain WGER breadth while improving classification and metadata.

**B. Curated Nevfit core with full-catalogue fallback**

Prioritise common, verified exercises while retaining access to unusual movements.

**C. Alternative exercise data source or catalogue strategy**

Assess whether another source offers materially better classification, licensing, maintenance or coverage.

Evaluate each on:

- Development effort
- Maintenance burden
- Exercise coverage
- Data reliability
- Muscle-workload suitability
- Search and Rob-generation quality
- Historical compatibility
- Licensing and attribution implications
- Scalability to future users

Do not recommend a wholesale migration without substantive evidence.

## Deliverables

Create:

1. `evaluation/exercise-catalogue-audit.md` — findings, counts, coverage, limitations and representative examples.
2. `evaluation/exercise-curation-prototype.json` — isolated sample mapping with provenance.
3. `evaluation/exercise-catalogue-recommendation.md` — comparative options, recommendation and proposed smallest implementation checkpoint.

Include reproducible commands or scripts if needed for inventory analysis.

Keep generated reports readable and avoid dumping thousands of raw catalogue records into Markdown.

## Scope restrictions

- No production UI changes.
- No live exercise-search changes.
- No Rob prompt, selection or generation changes.
- No Firestore changes or migrations.
- No external paid AI calls.
- No replacement of existing exercise IDs.
- No large-scale manual curation.
- No implementation of muscle workload charts.
- No implementation of recovery estimates.

If investigation reveals significant issues, document them rather than expanding scope.

## Validation

- Confirm all inventory counts are reproducible.
- Verify prototype IDs against the real catalogue.
- Check that prototype mappings aren't silently inferred from names alone.
- Run relevant validation for any analysis scripts.
- Ensure existing tests, lint and build are unaffected.

## Delivery and checkpoint status

Follow `docs/nevdev_workflow.md`.

Commit and push the investigation deliverables.

Provide a short completion report covering:

- Catalogue size and quality findings.
- Primary and secondary muscle mapping coverage.
- Most concerning issues.
- Recommended catalogue strategy.
- Approximate effort for the first useful implementation.
- Validation results.
- Commit SHA.

**Stop after the investigation.**

Do not begin the recommended implementation without user approval.

The purpose of this checkpoint is to give us reliable information for tomorrow's decision, not to make that decision tonight.