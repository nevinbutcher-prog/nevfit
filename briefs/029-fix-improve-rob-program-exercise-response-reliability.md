
# Fitbot — Fix Rob Program Candidate Exercise Validation Failures

**Priority:** High  
**Scope:** Whole-program generation reliability  
**Observed production failure:** `candidate_validation / exercise`

## Confirmed evidence

A live four-day generation returned:

- Model: `openai/gpt-4o-mini`
- Finish reason: `stop`
- Output tokens: 755
- Requested output budget: 4,000
- Routine count: 4
- Failure category: `candidate_validation`
- Validation reason: `exercise`

The response was completed, but at least one exercise failed strict validation.

## Required work

### 1. Identify the precise validation failure

Review `parseProgramCandidate()` in `functions/src/rob/robProgramGeneration.js`.

Improve safe diagnostics to identify:

- Routine index.
- Exercise index.
- Invalid field name.
- Reason category, such as missing, wrong type, unsupported format or unexpected field.

Log structural diagnostics only. Do not log exercise names, notes, prompts, constraints or raw model output.

Do not pretend that existing logs can reveal the specific invalid field retrospectively.

### 2. Improve the generation instructions

Give the model a clear and explicit exercise schema.

Specify:

- `exerciseRef`: non-empty string containing the exercise name.
- `sets`: integer within supported limits.
- `repRange`: string formatted as `8-12` or `10`.
- `restSeconds`: integer, in seconds.
- `note`: string or null.
- `proposalGroupKey`: valid group-key string or null.

Clarify that all exercises must conform to the same schema and must not include trusted Fitbot IDs or unsupported fields.

Consider passing a complete example with multiple exercises instead of the current minimal single-exercise example.

### 3. Investigate provider structured-output support

Determine whether the existing OpenRouter GPT-4o mini integration can reliably request JSON-schema-constrained output.

If supported, introduce it for whole-program generation only, without breaking advice or single-routine proposals.

Keep server-side candidate validation authoritative regardless of provider format controls.

Avoid substantial dependency or architectural changes.

### 4. Preserve strict validation

Do not solve the issue by broadly accepting malformed exercise data.

Do not silently discard exercises or partially accept a four-day program.

Preserve all existing limits, identity restrictions and persistence boundaries.

### 5. Test the complete path

Cover valid multi-exercise program responses and specific invalid fields.

Confirm diagnostics identify the affected routine/exercise position without disclosing user data.

Ensure existing AI operations remain unaffected.

Run tests, lint and production build.

## Completion

Report:

1. The precise validation weakness identified.
2. Whether provider-supported structured output was implemented.
3. What changes prevent the same failure.
4. Test results.
5. Any limitations requiring another live generation test.

**Suggested commit:** `fix: improve Rob program exercise response reliability`