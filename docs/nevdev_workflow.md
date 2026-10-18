# NevDev Development Workflow

**Version:** 1.0  
**Status:** Active  
**Applies to:** All NevDev development projects  
**Tools:** ChatGPT, Codex and the project management environment (Marco)

## 1. Purpose

This agreement defines how we plan, implement, review and verify development work across NevDev projects.

Our priorities are:

- Build what the user actually wants.
- Maintain clear visibility of what is happening and why.
- Work in small, manageable increments.
- Minimise unnecessary implementation, rework, AI expenditure and administrative overhead.
- Preserve useful functionality and existing project context.

**Technical completion is not the same as successful delivery. The user's intended experience is the ultimate measure of success.**

## 2. Roles and responsibilities

**User — Product owner**

- Defines goals and wants in their own words.
- Approves scope, priorities and material changes in direction.
- Verifies the actual user experience.
- Makes final acceptance decisions.

**ChatGPT — Planning and independent review**

- Helps clarify user intent without silently redefining it.
- Translates agreed outcomes into focused Codex implementation briefs.
- Reviews actual repository changes independently when requested.
- Distinguishes technical correctness from product suitability.
- Helps assess evidence and recommend the next checkpoint.

**Codex — Technical implementation**

- Investigates the existing repository and architecture.
- Implements the smallest appropriate solution for the agreed checkpoint.
- Runs relevant automated tests.
- Reports actual changes, limitations and verification evidence.
- Does not independently expand the agreed product scope.

**Marco — Project coordination**

- Maintains goals, evolving wants, current work and delivery history.
- Tracks decisions, implementation evidence and unresolved findings.
- Supports handoffs without becoming the authority on product intent.
- Does not treat completed implementation tasks as automatic proof of goal achievement.

## 3. Goal-driven development

Development begins with a **user-generated goal statement**, expressed in ordinary language.

The original statement must be preserved.

Goals may evolve through additional user-generated **Wants** — things the user discovers they would like as development progresses.

New wants do not automatically become implementation commitments.

Use this model:

**Goal → Wants → Current Step → Evidence → Direction Check**

- **Goal:** The experience or outcome the user wants to achieve.
- **Wants:** Additional user-expressed desires associated with that goal.
- **Current Step:** The single agreed implementation checkpoint being worked on.
- **Evidence:** What has actually been implemented, tested or observed.
- **Direction Check:** An assessment of whether the work moves us towards the goal and what should happen next.

AI may suggest refinements or new possibilities, but must distinguish suggestions from approved user requirements.

## 4. Rolling-wave planning

Plan the destination clearly, but only the immediate work precisely.

- Define the overarching goal and observable indicators of success.
- Optionally estimate the number of steps or outline a rough journey.
- Treat future steps as provisional, not commitments.
- Fully define only the next agreed checkpoint.
- Do not generate large, detailed implementation sequences by default.
- Reassess direction after each accepted checkpoint.

Avoid speculative dependencies, premature acceptance criteria and unnecessary architecture.

A change in estimated steps is not inherently a failure. An implementation drifting away from user intent is.

## 5. Implementation checkpoints

Each checkpoint should have:

1. **User intent:** What the user wants to achieve.
2. **Expected experience:** What should be observable when complete.
3. **Scope boundaries:** What is deliberately excluded.
4. **Verification:** How we will establish that it works.

The definition should be concise and proportional to the work.

Codex must inspect relevant existing code before implementing changes, reuse established infrastructure where appropriate, and avoid unrelated refactoring.

Do not implement future checkpoints early.

If significant architectural obstacles arise, explain the smallest viable options before undertaking materially broader work.

## 6. Implementation completion and code review

The default workflow is:

**Agree checkpoint → Codex implements → Independent code review → Fix blockers → User verification → Accept or correct → Direction check**

Codex should report:

- What changed and where.
- Commit reference.
- Tests actually executed and their results.
- Known limitations.
- Deployment or configuration requirements.
- Remaining manual verification.

Independent code review must inspect actual changes and relevant integration paths rather than relying solely on Codex's completion summary.

Review should address:

- Correctness against the agreed checkpoint.
- Security, data integrity and access boundaries.
- Meaningful regression risks.
- Scope compliance.
- Adequacy of automated evidence.

**The purpose of code review is to establish whether the implementation is safe and credible enough for user verification — not to pursue unlimited perfection.**

## 7. Review findings and correction limits

Classify findings as:

- **Blocking:** A security, data-loss, significant correctness or regression issue that must be resolved before acceptance or meaningful user verification.
- **Non-blocking defect:** A genuine issue that does not prevent verifying or accepting the current experience.
- **Enhancement:** A desirable improvement beyond the agreed checkpoint.
- **Unverified risk:** A concern requiring further evidence before corrective work is justified.

Every finding must be resolved, explicitly deferred or dismissed with a reason.

Deferred findings must retain enough context to revisit them, including the affected feature, severity, relevant evidence and source commit where known.

Prefer one independent full review followed by one focused re-review of corrective changes.

If serious issues remain after that, reassess the approach instead of automatically initiating further correction cycles.

Never ignore unresolved critical issues merely to satisfy a review limit.

Do not turn minor findings into unrelated refactoring or unapproved feature work.

## 8. User verification and acceptance

Passing automated tests does not prove that the intended experience is useful or satisfactory.

After code review clears blocking issues, the user verifies the implemented experience against the original checkpoint.

Verification instructions must be specific to the functionality delivered.

Do not produce generic instructions such as "test the workflow" or "confirm the expected behaviour."

Where useful, each manual test should identify:

- The action to perform.
- The observable expected result.
- Any relevant preconditions.

Only request manual testing that provides meaningful evidence not already established through automated testing.

A checkpoint is accepted when:

- Its agreed intended experience has been demonstrated.
- No unresolved blocking issues remain.
- Outstanding non-blocking findings are recorded.
- The user approves the result.

**Code reviewed** and **User accepted** are separate states.

## 9. Checkpoint closeout

When a checkpoint is accepted:

- Record what was delivered.
- Preserve relevant implementation and verification evidence.
- Record unresolved findings and their disposition.
- Compare the result with the overarching goal and agreed wants.
- Consider any newly discovered wants.
- Recommend the next smallest useful checkpoint.

Do not automatically generate the next implementation card.

Periodically review deferred findings and group related, justified corrections into a focused hardening task when appropriate.

Do not create large cleanup sequences by default.

**No orphan findings. No automatic progression merely because a commit was completed.**

## 10. Cost and complexity discipline

- Prefer concise, outcome-oriented implementation briefs.
- Avoid supplying excessive project history when repository context is available.
- Do not invoke paid AI operations unnecessarily or without the required authorisation.
- Use targeted reviews for corrective commits rather than repeatedly reviewing unchanged code.
- Prefer existing infrastructure over parallel systems.
- Avoid speculative capabilities, abstraction and orchestration.
- Choose the simplest implementation that credibly satisfies the current checkpoint.

Optimise for useful delivered outcomes, not the number of cards, commits, tests or AI executions.

## 11. Source of truth

Use the following hierarchy:

1. **User-approved goal and checkpoint:** Product intent and agreed scope.
2. **Current repository:** Actual implemented behaviour and technical architecture.
3. **Verified evidence:** Test results, observed behaviour and documented findings.
4. **Project management records:** Decisions, status, history and outstanding work.

Where these disagree, surface the discrepancy rather than silently choosing an interpretation.

Do not present assumptions, AI-generated suggestions or unverified claims as established facts.

## 12. Applying and changing this agreement

This agreement applies across NevDev projects unless the user explicitly approves a project-specific exception.

Project-specific technical instructions remain valid alongside this agreement.

Changes to the agreement should be deliberate, versioned and propagated to participating projects.

**Guiding principle:**

*Build one useful thing, verify that it's the right thing, understand what we've learned, and only then decide what comes next.*