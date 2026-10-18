# Repository Agent Instructions

## Shared NevDev development workflow

Follow `docs/nevdev_workflow.md` alongside these repository-specific instructions.

The shared agreement governs goal-driven planning, incremental checkpoints, implementation scope, code review, user acceptance and deferred findings.

Each approved brief represents **one implementation checkpoint** unless the user explicitly authorises otherwise.

Implement only the agreed checkpoint. Do not automatically generate subsequent cards, expand the scope or begin the next step.

These repository instructions govern operational permissions, brief lifecycle, Git actions and deployment. The shared workflow agreement does not revoke the standing authorisations below.

## Brief implementation

When the user says "next brief", review `briefs/nextbrief.md`.

Seek clarification only when an ambiguity materially affects the intended outcome or implementation boundaries. Otherwise, proceed.

Before implementation, review relevant material under `docs/` and inspect the existing architecture as necessary.

Prefer the smallest change that satisfies the agreed checkpoint. Reuse existing infrastructure and avoid speculative functionality or unrelated refactoring.

Following implementation:

- Make necessary freshness updates to `docs/`.
- Rename `nextbrief.md` using the suggested commit message, with a sequential numerical prefix so archived briefs remain in implementation order.
- Leave a blank `briefs/nextbrief.md` ready for subsequent approved work.

Completing one brief does not authorise implementation of another.

## Git and frontend deployment

When a brief changes deployable production behaviour, complete and verify the implementation, then commit the work using the brief's suggested commit message.

Git commit and push authorisation is standing and explicit for repository work. Commit and push completed changes without requesting separate approval.

Use the repository's Git integration as the frontend/Vercel deployment path. Do not deploy directly to Vercel.

If Git-triggered deployment fails, report exactly what remains rather than describing deployment as complete.

## Firebase deployment

Firebase deployment authorisation is standing and explicit for changes required to make an approved brief function in production.

After verification, deploy all in-scope Firebase changes required by the brief, including:

- Cloud Functions.
- Firestore rules and indexes.
- Storage rules.
- Other non-destructive Firebase configuration.

Do not request separate approval for these authorised changes.

Use the Firebase CLI against the repository's configured Firebase project, deploy only the necessary resources and verify the resulting deployed state.

This authorisation does **not** cover deleting production data, removing Firebase resources, changing billing, broad IAM changes or creating/replacing secret values. Those actions require explicit user approval.

Never describe a Firebase-dependent implementation as deployed while its required Firebase resources remain undeployed.

## Completion and handoff

After implementing a brief, provide a concise report covering:

- What the user can now do.
- What changed technically.
- Commit reference.
- Tests executed and their results.
- Deployment status and any remaining configuration.
- Known limitations and unresolved findings.
- Specific user behaviours still requiring verification.

Distinguish clearly between implementation, automated verification, deployment and user acceptance.

Do not declare the checkpoint accepted or the overarching goal achieved. Those decisions occur after independent code review and user verification.

Do not automatically initiate the next implementation checkpoint.

## Documentation continuity

As the project grows, if new standalone documentation seems necessary for AI continuity and does not fit under the existing product strategy umbrella, suggest its creation for user approval.

Avoid duplicating the shared workflow agreement in project-specific documentation.