# Repository Agent Instructions

## Shared NevDev development workflow

Follow `docs/nevdev_workflow.md` alongside these repository-specific instructions when that document is available. The shared agreement governs goal-driven planning, incremental checkpoints, implementation scope, code review, user acceptance and deferred findings. If it is missing, report the gap; do not invent its contents.

Each approved brief represents **one implementation checkpoint** unless the user explicitly authorises otherwise. Implement only the approved checkpoint; do not automatically generate subsequent cards, expand scope or begin the next step.

These instructions govern operational permissions, brief lifecycle, Git actions and deployment. The shared workflow agreement does not revoke the standing authorisations below.

## Brief implementation

When the user says **"next brief"**, use the approved implementation brief committed directly to `briefs/nextbrief.md` on `main` by ChatGPT. Do not rely on a pasted copy if the committed brief differs:

1. Check branch, working tree, remote and upstream.
2. If the tree is clean and an upstream is configured, synchronise via fetch and fast-forward only (`git pull --ff-only`) **before** reading `briefs/nextbrief.md`. If already current, proceed.
3. Never reset, discard, auto-stash, commit or overwrite local changes to allow synchronisation. If the tree is dirty, the branch diverged, upstream is missing, or synchronisation fails, stop and report the blocker instead of implementing a potentially outdated brief.
4. Read the freshly synchronised `briefs/nextbrief.md`. If empty or missing, do not implement.

Safe fast-forward synchronisation is authorised without additional approval.

Seek clarification only when ambiguity materially affects the intended outcome or scope. Review relevant `docs/` material and existing architecture before implementation. Make the smallest coherent change that satisfies the checkpoint, reusing infrastructure and avoiding speculative features or unrelated refactoring.

Testing must be proportional to change impact and risk. Reuse existing test coverage; add a small number of focused tests only where they provide meaningful evidence. Do not create large suites, exhaustive matrices, or extensive stress testing for minor changes. Run the relevant existing checks, and expand coverage only for justified high-risk behaviours or regressions. Report what was and was not tested.

After implementation, update relevant `docs/` as necessary; archive `briefs/nextbrief.md` with a sequential numeric prefix and a filename based on the suggested commit message; leave a blank `briefs/nextbrief.md` for later approved work. Completing one brief does not authorise another.

## Git and frontend deployment

When a brief changes deployable production behaviour, implement and verify, then commit using the brief's suggested commit message. Git commit and push authorisation is standing and explicit; no separate approval is needed. Use Git-triggered frontend/Vercel deployment, not direct Vercel deployment. Report any failed deployment accurately.

## Firebase deployment

Firebase deployment authorisation is standing and explicit for approved, required, non-destructive production changes including Cloud Functions, Firestore rules/indexes, Storage rules, and other non-destructive configuration. Use the Firebase CLI against the configured project; deploy only required resources and verify deployment.

Destructive data/resource changes, billing, broad IAM changes and creating/replacing secrets require explicit user approval. Never claim production deployment is complete when necessary Firebase resources remain undeployed.

## Completion and handoff

Report: user-visible capability, technical changes, commit reference, tests/results, deployment/configuration state, unresolved findings and precise user verification needed. Distinguish implementation, code review, deployment and user acceptance. Do not declare the checkpoint or overarching goal achieved; those decisions follow independent code review and user verification. Do not automatically begin the next checkpoint.

## Documentation continuity

Propose additional standalone documentation for user approval only when existing product strategy or other documents cannot hold the relevant knowledge. Avoid duplicating the shared workflow agreement.
